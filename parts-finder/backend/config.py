import os
from pathlib import Path

# Base directory of the application
BASE_DIR = Path(__file__).resolve().parent

# Default directories for parts - these can be overridden in environment variables
DEFAULT_DIRECTORIES = {
    "motorcycle": os.path.join('N:', 'Drawings'),
    "aerospace": os.path.join('X:', ''),
    "documents": os.path.join('N:', 'Documents'),
}

class Config:
    DEBUG = False
    TESTING = False
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-key-change-in-production')
    
    # Get directories from environment variables or use defaults
    DIRECTORIES = {
        "motorcycle": os.environ.get('MOTORCYCLE_DIR', DEFAULT_DIRECTORIES["motorcycle"]),
        "aerospace": os.environ.get('AEROSPACE_DIR', DEFAULT_DIRECTORIES["aerospace"]),
        "documents": os.environ.get('DOCUMENTS_DIR', DEFAULT_DIRECTORIES["documents"]),
    }
    
    # Ensure directories exist
    @classmethod
    def validate_directories(cls):
        for name, path in cls.DIRECTORIES.items():
            if not os.path.exists(path):
                try:
                    os.makedirs(path, exist_ok=True)
                    print(f"Created directory: {path}")
                except Exception as e:
                    print(f"Warning: Could not create directory {path}: {e}")
    
class DevelopmentConfig(Config):
    DEBUG = True
    
class ProductionConfig(Config):
    DEBUG = False
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'production-key-must-be-set'
    
class TestingConfig(Config):
    TESTING = True
    
# Configuration dictionary
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}

# Get configuration based on environment variable
def get_config():
    env = os.environ.get('FLASK_ENV', 'default')
    return config.get(env, config['default']) 