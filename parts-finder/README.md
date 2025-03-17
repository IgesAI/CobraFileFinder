# Parts Finder

A sophisticated engineering parts management and visualization system designed for efficient part discovery, preview, and manipulation.

![Parts Finder](https://via.placeholder.com/800x400?text=Parts+Finder)

## Overview

Parts Finder is a modern web application that enables engineers, designers, and technical staff to quickly locate, preview, and interact with 3D models of engineering parts. The application combines powerful search capabilities with an advanced 3D model viewer, allowing users to examine parts in detail before physical retrieval or manufacturing.

## Key Features

- **Powerful Search**: Quickly find parts by name, category, or file type
- **3D Model Visualization**: Preview STL files directly in the browser
- **Interactive Model Manipulation**: Rotate, scale, and translate 3D models
- **Measurement Tools**: Measure distances between points on 3D models
- **Coordinate System**: Industry-standard coordinate system (X: left/right, Y: forward/backward, Z: up/down)
- **Dark/Light Mode**: User interface adapts to your preference
- **Responsive Design**: Works on desktop and tablet devices
- **Portable Configuration**: Easy setup across different environments using environment variables

## Technology Stack

- **Frontend**: React, Three.js, Tailwind CSS
- **Backend**: Flask (Python)
- **3D Rendering**: Three.js with custom controls
- **File Formats**: STL support (with placeholder for 3MF)

## Installation

### Prerequisites

- Python 3.7+
- Modern web browser (Chrome, Firefox, Edge recommended)
- Git (optional, for cloning the repository)

### Quick Start

1. Clone or download the repository:
   ```bash
   git clone https://github.com/yourusername/parts-finder.git
   cd parts-finder
   ```

2. Run the application using the launcher script:
   ```bash
   python run.py
   ```

   The launcher will:
   - Create a `.env` file from the `.env.example` if it doesn't exist
   - Install required dependencies if they're missing
   - Start the application and open it in your default browser

3. Access the application at `http://localhost:5000`

### Manual Setup

If you prefer to set up the application manually:

1. Set up a Python virtual environment (recommended):
   ```bash
   # On Windows
   python -m venv venv
   venv\Scripts\activate

   # On macOS/Linux
   python3 -m venv venv
   source venv/bin/activate
   ```

2. Install dependencies:
   ```bash
   pip install -r backend/requirements.txt
   ```

3. Configure the application:
   - Copy `backend/.env.example` to `backend/.env`
   - Edit the `.env` file to set your parts directories and other settings

4. Run the application:
   ```bash
   cd backend
   python app.py
   ```

## Configuration

The application uses a flexible configuration system that can be adjusted through environment variables or the `.env` file:

### Environment Variables

Key environment variables include:

- `FLASK_ENV`: Set to `development` (default), `production`, or `testing`
- `FLASK_HOST`: The host address to bind to (default: 127.0.0.1)
- `FLASK_PORT`: The port to run on (default: 5000)
- `SECRET_KEY`: Secret key for session management
- `CAD_DIRECTORY`: Directory containing CAD files
- `DRAWINGS_DIRECTORY`: Directory containing drawing files
- `MODELS_DIRECTORY`: Directory containing 3D model files

### Configuration Files

- `.env`: Contains environment-specific settings (created from `.env.example` on first run)
- `config.py`: Defines configuration classes for different environments
- `app.py`: Main application file that uses the configuration

## Usage Guide

### Searching for Parts

1. Use the search bar to enter keywords related to the part you're looking for
2. Filter results by category or file type using the dropdown menus
3. Results will display in a grid with thumbnails (when available)

### Previewing 3D Models

1. Click on any STL file in the results to open the preview modal
2. The 3D model will load automatically in the viewer
3. Use your mouse to interact with the model:
   - Left-click + drag: Rotate the view
   - Right-click + drag: Pan the view
   - Scroll wheel: Zoom in/out

### Manipulating Models

The model viewer supports Blender-like keyboard shortcuts:
- `G`: Grab/move the model
- `R`: Rotate the model
- `S`: Scale the model
- `X`, `Y`, `Z`: Constrain transformation to the specified axis
- `ESC`: Cancel the current transformation

You can also use the on-screen controls to perform these operations.

### Measuring

1. Click the "Measure Distance" button in the model viewer
2. Click on two points on the model to measure the distance between them
3. The measurement will be displayed in model units

## Deployment to Another Machine

To deploy the application to another machine:

1. Copy the entire application directory to the new machine
2. Run the launcher script:
   ```bash
   python run.py
   ```
   
3. Edit the `.env` file to configure paths specific to the new machine

> **Note**: The application will automatically create directories specified in your configuration if they don't exist.

## Troubleshooting

### Common Issues

- **Model doesn't load**: Ensure the file path is correct and the file format is supported
- **Search returns no results**: Check that the directories are properly configured in the `.env` file
- **Performance issues**: Large STL files may cause performance problems on less powerful devices
- **Application won't start**: Check the logs in the `backend/logs` directory for error messages

### Getting Help

If you encounter any issues not covered here, please:
1. Check the console for error messages
2. Ensure all dependencies are installed
3. Contact the development team for support

## Development

### Project Structure

```
parts-finder/
├── run.py             # Launcher script
├── backend/           # Flask server
│   ├── app.py         # Main server application
│   ├── config.py      # Configuration system
│   ├── .env.example   # Example environment variables
│   └── utils/         # Utility functions
├── frontend/          # Web interface
│   ├── index.html     # Main HTML file
│   └── src/           # JavaScript source files
│       ├── components/  # React components
│       └── lib/         # Third-party libraries
└── requirements.txt   # Python dependencies
```

### Dependency Management

#### Python Dependencies

This project uses `requirements.txt` for Python dependency management:

1. **Adding a new dependency**:
   ```bash
   pip install new-package
   pip freeze > requirements.txt
   ```

2. **Updating requirements.txt after installing multiple packages**:
   ```bash
   pip freeze > requirements.txt
   ```

3. **Best practices**:
   - Keep `requirements.txt` up to date
   - Use virtual environments during development
   - Specify version numbers for all dependencies
   - Consider using `pip-compile` for more advanced dependency management

#### Frontend Dependencies

Frontend dependencies are loaded from CDNs in the `index.html` file. To update a frontend dependency:

1. Update the URL in the `<script>` tag in `frontend/index.html`
2. Increment the version query parameter (e.g., `?v=2`) to ensure browsers load the new version

### Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Three.js for 3D rendering capabilities
- React for the user interface framework
- Flask for the backend server
- All contributors who have helped improve this project

---

© 2023 Parts Finder Team. All rights reserved.
