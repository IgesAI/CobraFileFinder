from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import shutil
from datetime import datetime
from pathlib import Path
import logging
from concurrent.futures import ThreadPoolExecutor
from functools import partial
import threading
import time
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import getpass
import ctypes
import sys

app = Flask(__name__, static_folder='../frontend')
CORS(app)

# Configure logging
logging.basicConfig(level=logging.DEBUG)

# Configure base directories for different categories
DIRECTORIES = {
    'motorcycle': r'N:\Drawings',    # Motorcycle parts
    'aerospace': r'X:'              # Aerospace parts
}

local_data = threading.local()

VALID_EXTENSIONS = {'.stl', '.3mf', '.step', '.stp'}
file_cache = {
    'data': {},
    'timestamp': {}
}
CACHE_TTL = 3600  # 1 hour
cache_lock = threading.Lock()

limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

def get_cached_files(directory):
    with cache_lock:
        current_time = time.time()
        if (directory not in file_cache['data'] or 
            current_time - file_cache['timestamp'].get(directory, 0) > CACHE_TTL):
            file_cache['data'][directory] = []
            for root, _, files in os.walk(directory):
                for file in files:
                    if os.path.splitext(file)[1].lower() in VALID_EXTENSIONS:
                        file_cache['data'][directory].append(os.path.join(root, file))
            file_cache['timestamp'][directory] = current_time
        return file_cache['data'][directory]

def process_directory(root, search_terms, file_type, base_dir):
    results = []
    try:
        for file in os.listdir(root):
            file_path = os.path.join(root, file)
            if os.path.isfile(file_path):
                if any(term in file.lower() for term in search_terms):
                    file_ext = os.path.splitext(file)[1].lower()
                    if file_ext in ['.stl', '.3mf']:
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
        app.logger.error(f"Error processing directory {root}: {str(e)}")
    return results

def search_files(category, search_term, file_type=None, latest_only=False):
    results = []
    base_dir = DIRECTORIES.get(category, '')
    
    app.logger.debug(f"Searching in category: {category}")
    app.logger.debug(f"Base directory: {base_dir}")
    app.logger.debug(f"Search term: {search_term}")
    
    try:
        if not base_dir or not os.path.exists(base_dir):
            app.logger.error(f"Directory not found or not accessible: {base_dir}")
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
        app.logger.error(f"Error in search_files: {str(e)}")
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
    try:
        return ctypes.windll.shell32.IsUserAnAdmin()
    except:
        return False

def run_as_admin(target_dir):
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

@app.route('/api/search', methods=['POST'])
@limiter.limit("30 per minute")
def api_search():
    try:
        data = request.json
        app.logger.debug(f"Search request received: {data}")
        
        category = data.get('category', '')
        search_term = data.get('searchTerm', '')
        file_type = data.get('fileType')
        latest_only = data.get('latestOnly', False)
        
        # Validate required parameters
        if not search_term:
            app.logger.error("Missing search term")
            return jsonify({'error': 'Search term is required'}), 400
        if not category:
            app.logger.error("Missing category")
            return jsonify({'error': 'Category is required'}), 400
        if category not in DIRECTORIES:
            app.logger.error(f"Invalid category: {category}")
            return jsonify({'error': f'Invalid category: {category}'}), 400
            
        # Check if directory exists and is accessible
        base_dir = DIRECTORIES.get(category)
        if not os.path.exists(base_dir):
            app.logger.error(f"Directory not accessible: {base_dir}")
            return jsonify({'error': 'Network drive not accessible. Please check connection.'}), 500
            
        app.logger.info(f"Starting search in {category} for '{search_term}'")
        start_time = time.time()
        
        # Get valid files first
        valid_files = get_cached_files(DIRECTORIES[category])
        
        # Then search
        results = search_files(category, search_term, file_type, latest_only)
        
        search_time = int((time.time() - start_time) * 1000)
        app.logger.info(f"Search complete. Found {len(results)} results in {search_time}ms")
        
        return jsonify({
            'results': results,
            'stats': {
                'total_files': len(valid_files),
                'matched_files': len(results),
                'search_time_ms': search_time
            }
        })
            
    except ValueError as e:
        app.logger.error(f"Value Error: {str(e)}")
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        app.logger.error(f"Unexpected error in api_search: {str(e)}")
        return jsonify({'error': 'An unexpected error occurred. Please try again.'}), 500

@app.route('/api/copy', methods=['POST'])
def api_copy():
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

@app.route('/api/cache-refresh', methods=['POST'])
def refresh_cache():
    """Force refresh of the file cache"""
    try:
        file_cache.clear()
        for category, directory in DIRECTORIES.items():
            get_cached_files(directory)
        return jsonify({'message': 'Cache refreshed successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/')
def serve_frontend():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(app.static_folder, path)

@app.route('/assets/<path:filename>')
def serve_assets(filename):
    # Use os.path to handle paths correctly
    import os
    assets_dir = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'public', 'assets')
    return send_from_directory(assets_dir, filename)

# Add error handling for network drives
def check_drive_availability():
    for category, path in DIRECTORIES.items():
        if not os.path.exists(path):
            app.logger.error(f"Drive for {category} is not accessible: {path}")
            return False
    return True

# Add health check endpoint
@app.route('/api/health')
def health_check():
    drives_ok = check_drive_availability()
    return jsonify({
        'status': 'healthy' if drives_ok else 'degraded',
        'drives_ok': drives_ok
    })

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--create-dir', help='Create directory with admin privileges')
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

    app.run(debug=True)