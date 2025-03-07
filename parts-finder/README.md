# CobraFileFinder

A professional desktop application for searching and managing engineering files (STL, 3MF, and STEP) across network drives.

## Features

- **File Management**
  - Search for 3D model files across multiple network locations
  - Filter by file type (STL, 3MF, STEP)
  - Preview 3D models directly in the application
  - Copy files to local downloads folder
  - Batch processing of multiple files

- **User Experience**
  - Dark/light mode support
  - Latest version filtering
  - Responsive UI design
  - Search history tracking
  - User preferences storage

- **Security**
  - User authentication system
  - Role-based access control (admin/user)
  - API rate limiting
  - Secure file access

- **Professional Features**
  - Configurable via environment variables
  - Detailed logging with rotation
  - Health check endpoint
  - Statistics and monitoring
  - Cached file indexing for performance

## Installation

### Prerequisites
- Python 3.8 or higher
- Node.js and npm (for frontend development)

### Setup

1. Clone the repository:
```
git clone https://github.com/yourusername/CobraFileFinder.git
cd CobraFileFinder
```

2. Set up the Python virtual environment:
```
python -m venv .venv
.venv\Scripts\activate  # On Windows
source .venv/bin/activate  # On Linux/Mac
```

3. Install backend dependencies:
```
cd parts-finder/backend
pip install -r requirements.txt
```

4. Install frontend dependencies:
```
cd ../frontend
npm install
```

5. Configure the application:
```
cp .env.example .env
# Edit .env with your settings
```

## Usage

### Development Mode

1. Start the backend server:
```
cd parts-finder/backend
python launcher.py
```

2. The application will automatically open in your default web browser.

### Command Line Options

The launcher supports several command line options:

```
python launcher.py --help
```

Available options:
- `--host`: Host to run the server on (default: 127.0.0.1)
- `--port`: Port to run the server on (default: 5000)
- `--no-browser`: Do not open browser automatically
- `--env`: Path to .env file

### Building for Distribution

To create a standalone executable:

```
cd parts-finder/backend
pyinstaller PartsFinder.spec
```

The executable will be created in the `dist` directory.

## Configuration

The application can be configured using environment variables or a `.env` file. See `.env.example` for available options.

Network drive paths can be configured by setting the appropriate environment variables:
- `MOTORCYCLE_DIR`: Path to motorcycle parts directory
- `AEROSPACE_DIR`: Path to aerospace parts directory

## Authentication

On first run, the application will create a default admin user with a randomly generated password that will be printed to the console. Use these credentials to log in, then change the password or create additional users.

### User Management

Admins can:
- Create new users
- Delete users
- Reset passwords
- Refresh the file cache

Regular users can:
- Search for files
- Copy files
- View file previews
- Manage their own preferences

## API Documentation

The application provides a RESTful API with the following endpoints:

- `/api/search`: Search for files
- `/api/copy`: Copy files to downloads folder
- `/api/batch-process`: Process multiple files in batch
- `/api/preview/<path>`: Preview file contents
- `/api/file-content/<path>`: Serve file content
- `/api/cache-refresh`: Refresh file cache (admin only)
- `/api/search-history`: Get search history
- `/api/preferences`: Get/update user preferences
- `/api/auth/*`: Authentication endpoints
- `/api/version`: Get application version
- `/api/health`: Health check endpoint
- `/api/stats`: Get application statistics

## License

[MIT License](LICENSE)
