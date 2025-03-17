window.App = function App() {
  const [darkMode, setDarkMode] = React.useState(
    localStorage.theme === 'dark' || 
    (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
  );
  const [showMultiViewer, setShowMultiViewer] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState(null);
  
  // Toggle dark mode
  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.theme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.theme = 'light';
    }
  };
  
  // Handle file selection for multi-viewer
  const handleFileSelect = (file) => {
    console.log('App: File selected for multi-viewer:', file);
    setSelectedFile(file);
    setShowMultiViewer(true);
  };

  // Listen for addAnotherView events
  React.useEffect(() => {
    const handleAddAnotherViewEvent = (e) => {
      console.log('App: addAnotherView event received', e);
      if (e && e.detail && e.detail.filePath) {
        console.log('App: Setting selected file and showing multi-viewer');
        setSelectedFile({ path: e.detail.filePath });
        setShowMultiViewer(true);
      }
    };
    
    document.addEventListener('addAnotherView', handleAddAnotherViewEvent);
    
    return () => {
      document.removeEventListener('addAnotherView', handleAddAnotherViewEvent);
    };
  }, []);

  // Create components based on current state
  const mainContent = showMultiViewer 
    ? React.createElement(window.MultiViewerContainer, { 
        initialFilePath: selectedFile ? selectedFile.path : null 
      })
    : React.createElement(window.PartsSearch, {
        onFileSelect: handleFileSelect
      });

  // Create global add view button
  const globalAddViewButton = !showMultiViewer 
    ? React.createElement('button', {
        id: 'add-another-view-button',
        className: 'global-add-view-button',
        onClick: () => {
          console.log('App: Global add view button clicked');
          setShowMultiViewer(true);
        },
        style: {
          position: 'fixed',
          bottom: '80px',
          right: '20px',
          zIndex: 9999,
          background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
          color: 'white',
          padding: '12px 16px',
          borderRadius: '8px',
          border: 'none',
          boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px',
          fontWeight: '500',
          transition: 'all 0.3s ease'
        }
      }, [
        React.createElement('svg', {
          width: 16,
          height: 16,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 2,
          strokeLinecap: 'round',
          strokeLinejoin: 'round'
        }, [
          React.createElement('line', { key: 'line1', x1: 12, y1: 5, x2: 12, y2: 19 }),
          React.createElement('line', { key: 'line2', x1: 5, y1: 12, x2: 19, y2: 12 })
        ]),
        'Open Multi-Viewer'
      ]) 
    : null;

  // Create back button when in multi-viewer mode
  const backButton = showMultiViewer
    ? React.createElement('button', {
        className: 'back-button',
        onClick: () => {
          console.log('App: Back button clicked');
          
          // Clean up any active model viewers
          if (window.threeJsCleanup) {
            console.log('App: Cleaning up model viewers');
            window.threeJsCleanup();
          }
          
          setShowMultiViewer(false);
          setSelectedFile(null);
        },
        style: {
          position: 'fixed',
          top: '20px',
          left: '20px',
          zIndex: 9999,
          background: 'rgba(0, 0, 0, 0.5)',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '8px',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px',
          fontWeight: '500',
          transition: 'all 0.3s ease'
        }
      }, [
        React.createElement('svg', {
          width: 16,
          height: 16,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 2,
          strokeLinecap: 'round',
          strokeLinejoin: 'round'
        }, [
          React.createElement('path', { key: 'path', d: 'M19 12H5' }),
          React.createElement('polyline', { key: 'polyline', points: '12 19 5 12 12 5' })
        ]),
        'Back to Search'
      ])
    : null;

  return React.createElement('div', {
    className: 'min-h-screen bg-white dark:bg-gray-900'
  }, [
    mainContent,
    globalAddViewButton,
    backButton
  ]);
};