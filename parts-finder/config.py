import os
from pathlib import Path

# Base directory of the application
BASE_DIR = Path(__file__).resolve().parent

# Default directories for parts
DEFAULT_DIRECTORIES = {
    'motorcycle': os.path.join('N:', 'Drawings'),
    'aerospace': os.path.join('X:', ''),
    'documents': os.path.join('N:', 'Documents')
}

# Allow overriding directories with environment variables
DIRECTORIES = {
    'motorcycle': os.environ.get('PARTS_FINDER_MOTORCYCLE_DIR', DEFAULT_DIRECTORIES['motorcycle']),
    'aerospace': os.environ.get('PARTS_FINDER_AEROSPACE_DIR', DEFAULT_DIRECTORIES['aerospace']),
    'documents': os.environ.get('PARTS_FINDER_DOCUMENTS_DIR', DEFAULT_DIRECTORIES['documents'])
}

# Server configuration
HOST = os.environ.get('PARTS_FINDER_HOST', '0.0.0.0')
PORT = int(os.environ.get('PARTS_FINDER_PORT', 5000))
DEBUG = os.environ.get('PARTS_FINDER_DEBUG', 'False').lower() == 'true'

# Rate limiting
RATE_LIMIT = os.environ.get('PARTS_FINDER_RATE_LIMIT', '30 per minute')

# Cache settings
CACHE_SIZE = int(os.environ.get('PARTS_FINDER_CACHE_SIZE', 10))

# File extensions
SUPPORTED_EXTENSIONS = {
    'model': ['stl', '3mf', 'step', 'stp'],
    'drawing': ['pdf', 'dwg', 'dxf'],
    'document': ['pdf', 'docx', 'xlsx']
} 