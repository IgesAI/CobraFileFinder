#!/usr/bin/env python
"""
Parts Finder Launcher Script
----------------------------
This script launches the Parts Finder application.
It handles environment setup and configuration.
"""

import os
import sys
import subprocess
import webbrowser
from pathlib import Path
import time

# Determine the application root directory
APP_ROOT = Path(__file__).resolve().parent
BACKEND_DIR = APP_ROOT / 'backend'

def setup_environment():
    """Set up the environment for the application."""
    # Add the backend directory to the Python path
    sys.path.insert(0, str(BACKEND_DIR))
    
    # Check for .env file and create from example if it doesn't exist
    env_file = BACKEND_DIR / '.env'
    env_example = BACKEND_DIR / '.env.example'
    
    if not env_file.exists() and env_example.exists():
        print("Creating .env file from .env.example...")
        with open(env_example, 'r') as example:
            with open(env_file, 'w') as env:
                env.write(example.read())
        print("Created .env file. Please edit it with your configuration.")

def check_dependencies():
    """Check if all required dependencies are installed."""
    try:
        # Try to import Flask to check if dependencies are installed
        import flask
        return True
    except ImportError:
        print("Flask not found. Installing dependencies...")
        try:
            subprocess.check_call([sys.executable, '-m', 'pip', 'install', '-r', 
                                  str(BACKEND_DIR / 'requirements.txt')])
            return True
        except subprocess.CalledProcessError:
            print("Failed to install dependencies. Please install them manually:")
            print(f"pip install -r {BACKEND_DIR / 'requirements.txt'}")
            return False

def run_application():
    """Run the Flask application."""
    os.chdir(BACKEND_DIR)
    
    # Import the app from the backend
    from app import app
    
    # Get the host and port from environment variables or use defaults
    host = os.environ.get('FLASK_HOST', '127.0.0.1')
    port = int(os.environ.get('FLASK_PORT', 5000))
    
    print(f"Starting Parts Finder on http://{host}:{port}")
    
    # Open the browser after a short delay
    def open_browser():
        time.sleep(1.5)  # Give the server a moment to start
        webbrowser.open(f'http://{host}:{port}')
    
    import threading
    browser_thread = threading.Thread(target=open_browser)
    browser_thread.daemon = True
    browser_thread.start()
    
    # Run the Flask app
    app.run(host=host, port=port)

if __name__ == '__main__':
    print("Initializing Parts Finder...")
    setup_environment()
    
    if check_dependencies():
        run_application()
    else:
        print("Failed to start Parts Finder due to missing dependencies.")
        sys.exit(1) 