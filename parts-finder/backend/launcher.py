import os
import sys
import webbrowser
import threading
import time
from flask import Flask
from werkzeug.serving import make_server

# Add the backend directory to Python path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

from app import app

class ServerThread(threading.Thread):
    def __init__(self, app):
        threading.Thread.__init__(self)
        self.server = make_server('127.0.0.1', 5000, app)
        self.ctx = app.app_context()
        self.ctx.push()

    def run(self):
        print("Starting server...")
        self.server.serve_forever()

    def shutdown(self):
        self.server.shutdown()

def start_server():
    global server
    server = ServerThread(app)
    server.start()
    print("Server started")

def open_browser():
    try:
        print("Opening browser...")
        webbrowser.open('http://127.0.0.1:5000')
    except Exception as e:
        print(f"Error opening browser: {e}")

if __name__ == '__main__':
    try:
        print("Initializing Parts Finder...")
        start_server()
        # Wait a bit to ensure server is up
        time.sleep(2)
        open_browser()
        
        # Keep the main thread alive
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.shutdown()
        sys.exit(0)
    except Exception as e:
        print(f"Error: {e}")
        input("Press Enter to exit...") 