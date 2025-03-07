import os
import sys
import webbrowser
import threading
import time
import logging
import argparse
from flask import Flask
from werkzeug.serving import make_server
from dotenv import load_dotenv

# Add the backend directory to Python path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

from app import app

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('launcher')

class ServerThread(threading.Thread):
    def __init__(self, app, host='127.0.0.1', port=5000):
        threading.Thread.__init__(self)
        self.daemon = True  # Make thread exit when main thread exits
        self.host = host
        self.port = port
        self.server = make_server(host, port, app)
        self.ctx = app.app_context()
        self.ctx.push()

    def run(self):
        logger.info(f"Starting server on {self.host}:{self.port}...")
        self.server.serve_forever()

    def shutdown(self):
        logger.info("Shutting down server...")
        self.server.shutdown()

def start_server(host='127.0.0.1', port=5000):
    global server
    server = ServerThread(app, host, port)
    server.start()
    logger.info(f"Server started at http://{host}:{port}")
    return f"http://{host}:{port}"

def open_browser(url):
    try:
        logger.info(f"Opening browser at {url}...")
        webbrowser.open(url)
    except Exception as e:
        logger.error(f"Error opening browser: {e}")

def parse_arguments():
    parser = argparse.ArgumentParser(description='Parts Finder Launcher')
    parser.add_argument('--host', default='127.0.0.1', help='Host to run the server on')
    parser.add_argument('--port', type=int, default=5000, help='Port to run the server on')
    parser.add_argument('--no-browser', action='store_true', help='Do not open browser automatically')
    parser.add_argument('--env', help='Path to .env file')
    return parser.parse_args()

if __name__ == '__main__':
    try:
        # Parse command line arguments
        args = parse_arguments()
        
        # Load environment variables from specified file if provided
        if args.env and os.path.exists(args.env):
            load_dotenv(args.env)
            logger.info(f"Loaded environment from {args.env}")
        
        logger.info("Initializing Parts Finder...")
        url = start_server(args.host, args.port)
        
        # Wait a bit to ensure server is up
        time.sleep(2)
        
        if not args.no_browser:
            open_browser(url)
        
        # Keep the main thread alive
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("\nShutting down...")
        if 'server' in globals():
            server.shutdown()
        sys.exit(0)
    except Exception as e:
        logger.error(f"Error: {e}")
        input("Press Enter to exit...") 