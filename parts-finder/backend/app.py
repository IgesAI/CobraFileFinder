from flask import Flask, request, jsonify, send_from_directory, session
from flask_cors import CORS
import os
import shutil
from datetime import datetime, timedelta
from pathlib import Path
import logging
import logging.handlers
from concurrent.futures import ThreadPoolExecutor
from functools import partial, wraps
import threading
import time
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import getpass
import ctypes
import sys
import json
import hashlib
import secrets
from dotenv import load_dotenv
from config import get_config

# Load environment variables
load_dotenv()

# Get configuration
config = get_config()

# Initialize Flask app
app = Flask(__name__, static_folder='../frontend')
app.config.from_object(config)
app.secret_key = app.config.get('SECRET_KEY', 'dev-key-change-in-production')
app.config['SESSION_TYPE'] = 'filesystem'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)
CORS(app)

# Configure logging
log_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'logs')
os.makedirs(log_dir, exist_ok=True)
log_file = os.path.join(log_dir, 'app.log')

handler = logging.handlers.RotatingFileHandler(
    log_file, maxBytes=10485760, backupCount=5)  # 10MB per file, keep 5 backups
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
handler.setFormatter(formatter)

logger = app.logger
logger.setLevel(logging.INFO if not app.config['DEBUG'] else logging.DEBUG)
logger.addHandler(handler)

# Configure rate limiting
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=[app.config['RATE_LIMIT_DEFAULT']]
)

# Configure base directories for different categories
DIRECTORIES = app.config['DIRECTORIES']

# Define valid file extensions
VALID_EXTENSIONS = set(app.config['VALID_EXTENSIONS'])

# File cache for performance
file_cache = {
    'data': {},
    'timestamp': {}
}
CACHE_TTL = app.config['CACHE_TTL']
cache_lock = threading.Lock()

# Thread-local storage
local_data = threading.local()

# Version information
APP_VERSION = "1.0.0"

# Search history
search_history = {
    'entries': [],
    'max_entries': 20
}
search_history_lock = threading.Lock()

# User preferences
user_preferences = {}
preferences_lock = threading.Lock()
preferences_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'user_preferences.json')

# Load user preferences from file
def load_preferences():
    global user_preferences
    try:
        if os.path.exists(preferences_file):
            with open(preferences_file, 'r') as f:
                user_preferences = json.load(f)
                logger.info(f"Loaded user preferences from {preferences_file}")
    except Exception as e:
        logger.error(f"Error loading user preferences: {str(e)}")
        user_preferences = {}

# Save user preferences to file
def save_preferences():
    try:
        with open(preferences_file, 'w') as f:
            json.dump(user_preferences, f, indent=2)
            logger.info(f"Saved user preferences to {preferences_file}")
    except Exception as e:
        logger.error(f"Error saving user preferences: {str(e)}")

# User authentication
users = {}
users_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'users.json')

# Load users from file
def load_users():
    global users
    try:
        if os.path.exists(users_file):
            with open(users_file, 'r') as f:
                users = json.load(f)
                logger.info(f"Loaded users from {users_file}")
        
        # If no users exist, create a default admin user
        if not users:
            default_password = secrets.token_urlsafe(8)  # Generate a random password
            salt = secrets.token_hex(8)
            password_hash = hashlib.sha256((default_password + salt).encode()).hexdigest()
            
            users = {
                "admin": {
                    "password_hash": password_hash,
                    "salt": salt,
                    "role": "admin",
                    "created_at": datetime.now().isoformat()
                }
            }
            
            # Save the users file
            save_users()
            
            logger.info(f"Created default admin user with password: {default_password}")
            print(f"Created default admin user with password: {default_password}")
    except Exception as e:
        logger.error(f"Error loading users: {str(e)}")
        users = {}

# Save users to file
def save_users():
    try:
        with open(users_file, 'w') as f:
            json.dump(users, f, indent=2)
            logger.info(f"Saved users to {users_file}")
    except Exception as e:
        logger.error(f"Error saving users: {str(e)}")

# Authentication decorator
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('logged_in'):
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated_function

# Admin role required decorator
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('logged_in'):
            return jsonify({'error': 'Authentication required'}), 401
        if session.get('role') != 'admin':
            return jsonify({'error': 'Admin privileges required'}), 403
        return f(*args, **kwargs)
    return decorated_function

# Load users at startup
load_users()

# Load preferences at startup
load_preferences()

# Helper Functions
def get_cached_files(directory):
    """Get or update cached files for a directory"""
    with cache_lock:
        current_time = time.time()
        if (directory not in file_cache['data'] or 
            current_time - file_cache['timestamp'].get(directory, 0) > CACHE_TTL):
            file_cache['data'][directory] = []
            try:
                for root, _, files in os.walk(directory):
                    for file in files:
                        if os.path.splitext(file)[1].lower() in VALID_EXTENSIONS:
                            file_cache['data'][directory].append(os.path.join(root, file))
                file_cache['timestamp'][directory] = current_time
                logger.info(f"Cache updated for {directory}: {len(file_cache['data'][directory])} files")
            except Exception as e:
                logger.error(f"Error updating cache for {directory}: {str(e)}")
                # Return empty list if directory is inaccessible
                file_cache['data'][directory] = []
                file_cache['timestamp'][directory] = current_time
        return file_cache['data'][directory]

def process_directory(root, search_terms, file_type, base_dir):
    """Process a directory for files matching search terms and file type"""
    results = []
    try:
        for file in os.listdir(root):
            file_path = os.path.join(root, file)
            if os.path.isfile(file_path):
                if any(term in file.lower() for term in search_terms):
                    file_ext = os.path.splitext(file)[1].lower()
                    if file_ext in VALID_EXTENSIONS:
                        if file_type and file_ext != f'.{file_type.lower()}':
                            continue
                            
                        results.append({
                            'path': file_path,
                            'relative_path': os.path.relpath(file_path, base_dir),
                            'name': file,
                            'type': file_ext[1:].upper(),
                            'size': os.path.getsize(file_path),
                            'modified': os.path.getmtime(file_path)
                        })
    except Exception as e:
        logger.error(f"Error processing directory {root}: {str(e)}")
    return results

def search_files(category, search_term, file_type=None, latest_only=False):
    """Search for files matching criteria in the specified category"""
    results = []
    base_dir = DIRECTORIES.get(category, '')
    
    logger.debug(f"Searching in category: {category}")
    logger.debug(f"Base directory: {base_dir}")
    logger.debug(f"Search term: {search_term}")
    
    try:
        if not base_dir or not os.path.exists(base_dir):
            logger.error(f"Directory not found or not accessible: {base_dir}")
            raise ValueError(f"Directory not found or not accessible for category: {category}")

        search_terms = [term.strip() for term in search_term.lower().replace(',', '\n').split('\n') if term.strip()]
        
        # Use cached files
        valid_files = get_cached_files(base_dir)
        
        for file_path in valid_files:
            file_name = os.path.basename(file_path)
            if any(term in file_name.lower() for term in search_terms):
                file_ext = os.path.splitext(file_name)[1].lower()
                if file_type and file_ext != f'.{file_type.lower()}':
                    continue
                    
                results.append({
                    'path': file_path,
                    'relative_path': os.path.relpath(file_path, base_dir),
                    'name': file_name,
                    'type': file_ext[1:].upper(),
                    'size': os.path.getsize(file_path),
                    'modified': os.path.getmtime(file_path)
                })

    except Exception as e:
        logger.error(f"Error in search_files: {str(e)}")
        raise

    if latest_only:
        by_name = {}
        for file in results:
            name_without_version = file['name'].split('_v')[0]
            if name_without_version not in by_name or file['modified'] > by_name[name_without_version]['modified']:
                by_name[name_without_version] = file
        results = list(by_name.values())

    return sorted(results, key=lambda x: x['modified'], reverse=True)

def is_admin():
    """Check if the current process has admin rights"""
    try:
        return ctypes.windll.shell32.IsUserAnAdmin()
    except:
        return False

def run_as_admin(target_dir):
    """Re-run the program with admin rights"""
    if not is_admin():
        # Re-run the program with admin rights
        ctypes.windll.shell32.ShellExecuteW(
            None, 
            "runas", 
            sys.executable, 
            f'"{sys.argv[0]}" --create-dir "{target_dir}"', 
            None, 
            1
        )
        return True
    return False

def check_drive_availability():
    """Check if all configured network drives are available"""
    for category, path in DIRECTORIES.items():
        if not os.path.exists(path):
            logger.error(f"Drive for {category} is not accessible: {path}")
            return False
    return True

# API Routes
@app.route('/api/search', methods=['POST'])
@limiter.limit(app.config['RATE_LIMIT_SEARCH'])
@login_required
def api_search():
    """API endpoint for searching files"""
    try:
        data = request.json
        logger.debug(f"Search request received: {data}")
        
        category = data.get('category', '')
        search_term = data.get('searchTerm', '')
        file_type = data.get('fileType')
        latest_only = data.get('latestOnly', False)
        
        # Validate required parameters
        if not search_term:
            logger.error("Missing search term")
            return jsonify({'error': 'Search term is required'}), 400
        if not category:
            logger.error("Missing category")
            return jsonify({'error': 'Category is required'}), 400
        if category not in DIRECTORIES:
            logger.error(f"Invalid category: {category}")
            return jsonify({'error': f'Invalid category: {category}'}), 400
            
        # Check if directory exists and is accessible
        base_dir = DIRECTORIES.get(category)
        if not os.path.exists(base_dir):
            logger.error(f"Directory not accessible: {base_dir}")
            return jsonify({'error': 'Network drive not accessible. Please check connection.'}), 500
            
        logger.info(f"Starting search in {category} for '{search_term}'")
        start_time = time.time()
        
        # Get valid files first
        valid_files = get_cached_files(DIRECTORIES[category])
        
        # Then search
        results = search_files(category, search_term, file_type, latest_only)
        
        search_time = int((time.time() - start_time) * 1000)
        logger.info(f"Search complete. Found {len(results)} results in {search_time}ms")
        
        # Add to search history
        with search_history_lock:
            # Add new entry at the beginning
            search_history['entries'].insert(0, {
                'timestamp': datetime.now().isoformat(),
                'category': category,
                'search_term': search_term,
                'file_type': file_type,
                'latest_only': latest_only,
                'results_count': len(results)
            })
            # Trim to max entries
            if len(search_history['entries']) > search_history['max_entries']:
                search_history['entries'] = search_history['entries'][:search_history['max_entries']]
        
        return jsonify({
            'results': results,
            'stats': {
                'total_files': len(valid_files),
                'matched_files': len(results),
                'search_time_ms': search_time
            }
        })
            
    except ValueError as e:
        logger.error(f"Value Error: {str(e)}")
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Unexpected error in api_search: {str(e)}")
        return jsonify({'error': 'An unexpected error occurred. Please try again.'}), 500

@app.route('/api/copy', methods=['POST'])
@login_required
def api_copy():
    """API endpoint for copying files to downloads folder"""
    try:
        data = request.json
        files = data.get('files', [])
        
        if not files:
            return jsonify({'error': 'No files selected'}), 400
            
        # Create a dated folder in Downloads
        today = datetime.now().strftime('%Y-%m-%d')
        # Use current user's Downloads folder
        downloads_path = os.path.join(os.path.expanduser('~'), 'Downloads')
            
        target_dir = os.path.join(downloads_path, f'PartFiles_{today}')
        
        # Create directory if it doesn't exist
        if not os.path.exists(target_dir):
            try:
                os.makedirs(target_dir, exist_ok=True)
            except Exception as e:
                return jsonify({'error': f'Failed to create folder: {str(e)}'}), 500
        
        results = []
        for file in files:
            try:
                source_path = file['path']
                if not os.path.exists(source_path):
                    raise FileNotFoundError(f"Source file not found: {source_path}")
                    
                file_name = os.path.basename(source_path)
                target_path = os.path.join(target_dir, file_name)
                
                # Simple copy with overwrite protection
                if os.path.exists(target_path):
                    base, ext = os.path.splitext(file_name)
                    target_path = os.path.join(target_dir, f"{base}_{int(time.time())}{ext}")
                
                shutil.copy2(source_path, target_path)
                results.append({
                    'file': file_name,
                    'success': True,
                    'path': target_path
                })
            except Exception as e:
                results.append({
                    'file': file.get('name', 'unknown'),
                    'success': False,
                    'error': str(e)
                })
        
        successful_copies = sum(1 for r in results if r['success'])
        if successful_copies == 0:
            return jsonify({'error': 'No files were copied successfully'}), 500
            
        return jsonify({
            'results': results,
            'message': f'Successfully copied {successful_copies} files to Downloads/PartFiles_{today}'
        })
            
    except Exception as e:
        return jsonify({'error': f'Copy failed: {str(e)}'}), 500

@app.route('/api/batch-process', methods=['POST'])
@login_required
def batch_process():
    """API endpoint for batch processing multiple files"""
    try:
        data = request.json
        files = data.get('files', [])
        operation = data.get('operation', '')
        
        if not files:
            return jsonify({'error': 'No files selected'}), 400
            
        if not operation or operation not in ['copy', 'analyze']:
            return jsonify({'error': 'Invalid or missing operation'}), 400
        
        # For copy operation, use the existing copy functionality
        if operation == 'copy':
            return api_copy()
        
        # For analyze operation, gather metadata about the files
        if operation == 'analyze':
            results = []
            
            # Use ThreadPoolExecutor for parallel processing
            with ThreadPoolExecutor(max_workers=min(10, len(files))) as executor:
                # Define the analysis function
                def analyze_file(file):
                    try:
                        file_path = file['path']
                        if not os.path.exists(file_path):
                            return {
                                'file': file.get('name', 'unknown'),
                                'success': False,
                                'error': 'File not found'
                            }
                            
                        file_name = os.path.basename(file_path)
                        file_ext = os.path.splitext(file_name)[1].lower()
                        
                        # Basic metadata
                        result = {
                            'file': file_name,
                            'path': file_path,
                            'success': True,
                            'size': os.path.getsize(file_path),
                            'modified': datetime.fromtimestamp(os.path.getmtime(file_path)).isoformat(),
                            'type': file_ext[1:].upper(),
                            'metadata': {}
                        }
                        
                        # Additional metadata based on file type could be added here
                        # For example, parsing STL files for triangle count, etc.
                        
                        return result
                    except Exception as e:
                        return {
                            'file': file.get('name', 'unknown'),
                            'success': False,
                            'error': str(e)
                        }
                
                # Submit all files for analysis
                future_to_file = {executor.submit(analyze_file, file): file for file in files}
                
                # Collect results as they complete
                for future in future_to_file:
                    results.append(future.result())
            
            successful_analyses = sum(1 for r in results if r.get('success', False))
            
            return jsonify({
                'results': results,
                'message': f'Successfully analyzed {successful_analyses} of {len(files)} files'
            })
        
    except Exception as e:
        logger.error(f"Error in batch_process: {str(e)}")
        return jsonify({'error': f'Batch processing failed: {str(e)}'}), 500

@app.route('/api/preview/<path:file_path>')
@login_required
def preview_file(file_path):
    """API endpoint for previewing file contents"""
    try:
        # Security check - ensure the file path is within allowed directories
        file_path = os.path.normpath(file_path)
        allowed = False
        
        for directory in DIRECTORIES.values():
            if file_path.startswith(directory):
                allowed = True
                break
                
        if not allowed:
            logger.warning(f"Attempted to access unauthorized file: {file_path}")
            return jsonify({'error': 'Access denied'}), 403
            
        if not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 404
            
        # Get file extension
        _, ext = os.path.splitext(file_path)
        ext = ext.lower()
        
        # Check if file type is supported
        if ext not in VALID_EXTENSIONS:
            return jsonify({'error': 'Unsupported file type'}), 400
            
        # For security, we don't serve the file directly but return metadata
        # The actual file rendering is handled by the frontend
        file_info = {
            'name': os.path.basename(file_path),
            'path': file_path,
            'size': os.path.getsize(file_path),
            'modified': datetime.fromtimestamp(os.path.getmtime(file_path)).isoformat(),
            'type': ext[1:].upper()
        }
        
        return jsonify(file_info)
        
    except Exception as e:
        logger.error(f"Error in preview_file: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/file-content/<path:file_path>')
@login_required
def serve_file_content(file_path):
    """Serve the actual file content for preview"""
    try:
        # Security check - ensure the file path is within allowed directories
        file_path = os.path.normpath(file_path)
        allowed = False
        
        for directory in DIRECTORIES.values():
            if file_path.startswith(directory):
                allowed = True
                break
                
        if not allowed:
            logger.warning(f"Attempted to access unauthorized file: {file_path}")
            return jsonify({'error': 'Access denied'}), 403
            
        if not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 404
            
        # Get file extension
        _, ext = os.path.splitext(file_path)
        ext = ext.lower()
        
        # Check if file type is supported
        if ext not in VALID_EXTENSIONS:
            return jsonify({'error': 'Unsupported file type'}), 400
            
        # Serve the file with appropriate content type
        content_types = {
            '.stl': 'application/vnd.ms-pki.stl',
            '.3mf': 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml',
            '.step': 'application/step',
            '.stp': 'application/step'
        }
        
        return send_from_directory(
            os.path.dirname(file_path),
            os.path.basename(file_path),
            mimetype=content_types.get(ext, 'application/octet-stream')
        )
        
    except Exception as e:
        logger.error(f"Error in serve_file_content: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/cache-refresh', methods=['POST'])
@admin_required
def refresh_cache():
    """Force refresh of the file cache"""
    try:
        file_cache.clear()
        for category, directory in DIRECTORIES.items():
            get_cached_files(directory)
        return jsonify({'message': 'Cache refreshed successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/health')
def health_check():
    """Health check endpoint"""
    drives_ok = check_drive_availability()
    return jsonify({
        'status': 'healthy' if drives_ok else 'degraded',
        'drives_ok': drives_ok
    })

@app.route('/api/version')
def get_version():
    """Return the application version"""
    return jsonify({
        'version': APP_VERSION,
        'server_time': datetime.now().isoformat()
    })

@app.route('/api/config')
def get_config():
    """Return the application configuration (safe values only)"""
    return jsonify({
        'valid_extensions': list(VALID_EXTENSIONS),
        'categories': list(DIRECTORIES.keys())
    })

@app.route('/api/stats')
@login_required
def get_stats():
    """Return statistics about the application"""
    stats = {
        'cache_age': {},
        'file_counts': {},
        'uptime': time.time() - app_start_time
    }
    
    for category, directory in DIRECTORIES.items():
        if directory in file_cache['timestamp']:
            stats['cache_age'][category] = time.time() - file_cache['timestamp'][directory]
        if directory in file_cache['data']:
            stats['file_counts'][category] = len(file_cache['data'][directory])
    
    return jsonify(stats)

@app.route('/api/search-history', methods=['GET'])
@login_required
def get_search_history():
    """Get the search history"""
    try:
        with search_history_lock:
            return jsonify(search_history['entries'])
    except Exception as e:
        logger.error(f"Error retrieving search history: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/search-history/clear', methods=['POST'])
@login_required
def clear_search_history():
    """Clear the search history"""
    try:
        with search_history_lock:
            search_history['entries'] = []
        return jsonify({'message': 'Search history cleared'})
    except Exception as e:
        logger.error(f"Error clearing search history: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/preferences', methods=['GET'])
@login_required
def get_preferences():
    """Get user preferences"""
    try:
        with preferences_lock:
            return jsonify(user_preferences)
    except Exception as e:
        logger.error(f"Error retrieving user preferences: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/preferences', methods=['POST'])
@login_required
def update_preferences():
    """Update user preferences"""
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        with preferences_lock:
            # Update only the provided preferences
            for key, value in data.items():
                user_preferences[key] = value
            
            # Save to file
            save_preferences()
            
        return jsonify({
            'message': 'Preferences updated successfully',
            'preferences': user_preferences
        })
    except Exception as e:
        logger.error(f"Error updating user preferences: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/preferences/reset', methods=['POST'])
@login_required
def reset_preferences():
    """Reset user preferences to defaults"""
    try:
        default_preferences = {
            'theme': 'system',
            'itemsPerPage': 10,
            'defaultCategory': 'motorcycle',
            'defaultFileType': 'all',
            'latestOnly': False
        }
        
        with preferences_lock:
            user_preferences.clear()
            user_preferences.update(default_preferences)
            save_preferences()
            
        return jsonify({
            'message': 'Preferences reset to defaults',
            'preferences': user_preferences
        })
    except Exception as e:
        logger.error(f"Error resetting user preferences: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Frontend Routes
@app.route('/')
def serve_frontend():
    """Serve the main frontend page"""
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    """Serve static files"""
    return send_from_directory(app.static_folder, path)

@app.route('/assets/<path:filename>')
def serve_assets(filename):
    """Serve asset files"""
    # Use os.path to handle paths correctly
    import os
    assets_dir = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'public', 'assets')
    return send_from_directory(assets_dir, filename)

# Main entry point
if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--create-dir', help='Create directory with admin privileges')
    parser.add_argument('--port', type=int, default=5000, help='Port to run the server on')
    parser.add_argument('--host', default='127.0.0.1', help='Host to run the server on')
    parser.add_argument('--debug', action='store_true', help='Run in debug mode')
    args = parser.parse_args()

    if args.create_dir:
        try:
            os.makedirs(args.create_dir, exist_ok=True)
            import stat
            os.chmod(args.create_dir, stat.S_IRWXU | stat.S_IRWXG | stat.S_IRWXO)
            sys.exit(0)
        except Exception as e:
            print(f"Error creating directory: {e}")
            sys.exit(1)

    app_start_time = time.time()
    logger.info(f"Starting Parts Finder v{APP_VERSION}")
    app.run(debug=args.debug, host=args.host, port=args.port)