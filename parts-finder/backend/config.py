import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Config:
    """Base configuration class"""
    DEBUG = False
    TESTING = False
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-key-change-in-production')
    
    # File settings
    VALID_EXTENSIONS = os.getenv('VALID_EXTENSIONS', '.stl,.3mf,.step,.stp').lower().split(',')
    CACHE_TTL = int(os.getenv('CACHE_TTL', '3600'))  # 1 hour by default
    
    # Directory settings
    DIRECTORIES = {
        'motorcycle': os.getenv('MOTORCYCLE_DIR', r'N:\Drawings'),
        'aerospace': os.getenv('AEROSPACE_DIR', r'X:')
    }
    
    # API settings
    RATE_LIMIT_DEFAULT = os.getenv('RATE_LIMIT_DEFAULT', '200 per day')
    RATE_LIMIT_SEARCH = os.getenv('RATE_LIMIT_SEARCH', '30 per minute')
    
class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    
class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False
    
class TestingConfig(Config):
    """Testing configuration"""
    TESTING = True
    DEBUG = True
    
# Configuration dictionary
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}

def get_config():
    """Get the current configuration based on environment"""
    env = os.getenv('FLASK_ENV', 'development')
    return config.get(env, config['default']) 