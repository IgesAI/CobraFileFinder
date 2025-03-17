// MultiViewerContainer component - Manages multiple ModelViewer instances
window.MultiViewerContainer = function MultiViewerContainer({ initialFilePath }) {
  const containerRef = React.useRef(null);
  const [viewers, setViewers] = React.useState([]);
  const [activeViewerIndex, setActiveViewerIndex] = React.useState(0);
  const [showCompactSearch, setShowCompactSearch] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState([]);
  const [searchError, setSearchError] = React.useState(null);
  const [searchLoading, setSearchLoading] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchType, setSearchType] = React.useState('all');
  
  // Define handleAddAnotherView before registering it globally
  const handleAddAnotherView = React.useCallback((e) => {
    console.log('MultiViewerContainer: Add another view event received', e);
    console.log('MultiViewerContainer: Event detail:', e.detail);
    
    // Check if we have a filePath in the event detail
    if (e && e.detail && e.detail.filePath) {
      console.log('MultiViewerContainer: Adding view with file path from event:', e.detail.filePath);
      
      // Add a new viewer with the file path from the event
      setViewers(prev => {
        if (prev.length >= 4) {
          alert('Maximum of 4 viewers allowed. Please close one first.');
          return prev;
        }
        return [...prev, { id: Date.now(), filePath: e.detail.filePath }];
      });
    } else {
      // If no file path in the event, show the search overlay
      console.log('MultiViewerContainer: No file path in event, showing search overlay');
      setShowCompactSearch(true);
    }
  }, []);
  
  // Register this instance globally - IMMEDIATELY after component mounts
  React.useEffect(() => {
    console.log('MultiViewerContainer: Registering instance globally');
    
    // Create the global instance object
    window.multiViewerInstance = {
      handleAddAnotherView: handleAddAnotherView,
      setShowCompactSearch: setShowCompactSearch,
      addViewer: (filePath) => {
        console.log('MultiViewerContainer: Adding viewer via global method:', filePath);
        setViewers(prev => {
          if (prev.length >= 4) {
            alert('Maximum of 4 viewers allowed. Please close one first.');
            return prev;
          }
          return [...prev, { id: Date.now(), filePath: filePath }];
        });
      }
    };
    
    console.log('MultiViewerContainer: Global instance registered:', window.multiViewerInstance);
    
    // Test the global instance
    if (window.multiViewerInstance && typeof window.multiViewerInstance.handleAddAnotherView === 'function') {
      console.log('MultiViewerContainer: Global instance registered successfully');
    } else {
      console.error('MultiViewerContainer: Failed to register global instance');
    }
    
    return () => {
      console.log('MultiViewerContainer: Unregistering global instance');
      window.multiViewerInstance = null;
    };
  }, [handleAddAnotherView]);
  
  // Initialize with the first viewer if a file path is provided
  React.useEffect(() => {
    if (initialFilePath) {
      console.log('MultiViewerContainer: Initializing with file path:', initialFilePath);
      setViewers([{ id: Date.now(), filePath: initialFilePath }]);
    }
  }, [initialFilePath]);
  
  // Set up event listener for the addAnotherView event
  React.useEffect(() => {
    console.log('MultiViewerContainer: Setting up event listeners for addAnotherView');
    
    // Function to handle the event
    const handleAddAnotherViewEvent = (e) => {
      console.log('MultiViewerContainer: addAnotherView event received', e);
      handleAddAnotherView(e);
    };
    
    // Add event listeners at multiple levels
    if (containerRef.current) {
      console.log('MultiViewerContainer: Adding event listener to container');
      containerRef.current.addEventListener('addAnotherView', handleAddAnotherViewEvent);
    }
    
    // Also listen at document level
    console.log('MultiViewerContainer: Adding event listener to document');
    document.addEventListener('addAnotherView', handleAddAnotherViewEvent);
    
    // Also listen at window level
    console.log('MultiViewerContainer: Adding event listener to window');
    window.addEventListener('addAnotherView', handleAddAnotherViewEvent);
    
    // Add a direct click handler to the document for debugging
    const handleDirectClick = (e) => {
      if (e.target && (e.target.id === 'add-another-view-button' || 
          (e.target.parentElement && e.target.parentElement.id === 'add-another-view-button'))) {
        console.log('MultiViewerContainer: Direct click on add-another-view-button detected');
        handleAddAnotherView({ detail: { filePath: null } });
      }
    };
    
    document.addEventListener('click', handleDirectClick);
    
    return () => {
      // Clean up all event listeners
      if (containerRef.current) {
        containerRef.current.removeEventListener('addAnotherView', handleAddAnotherViewEvent);
      }
      document.removeEventListener('addAnotherView', handleAddAnotherViewEvent);
      window.removeEventListener('addAnotherView', handleAddAnotherViewEvent);
      document.removeEventListener('click', handleDirectClick);
    };
  }, [handleAddAnotherView]);
  
  // Log when the component mounts to verify it's working
  React.useEffect(() => {
    console.log('MultiViewerContainer: Component mounted');
    
    // Debug log to check if the add view button should be visible
    console.log('Should show add view button:', !showCompactSearch);
    
    return () => {
      console.log('MultiViewerContainer: Component unmounted');
    };
  }, []);
  
  // Log when viewers change
  React.useEffect(() => {
    console.log('MultiViewerContainer: Viewers updated:', viewers);
  }, [viewers]);
  
  // Log when showCompactSearch changes
  React.useEffect(() => {
    console.log('MultiViewerContainer: showCompactSearch updated:', showCompactSearch);
  }, [showCompactSearch]);
  
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchError('Please enter a search term');
      return;
    }
    
    setSearchLoading(true);
    setSearchError(null);
    
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          searchTerm: searchQuery,
          category: 'motorcycle', // Default to motorcycle category
          fileType: searchType === 'all' ? null : searchType,
        }),
      });
      
      const data = await response.json();
      
      if (data.error) {
        setSearchError(data.error);
        setSearchResults([]);
      } else {
        setSearchResults(data.results || []);
        if (data.results.length === 0) {
          setSearchError('No results found');
        }
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchError('Failed to search. Please try again.');
    } finally {
      setSearchLoading(false);
    }
  };
  
  // Close the search overlay
  const handleCloseSearch = () => {
    console.log('MultiViewerContainer: Closing search overlay');
    setShowCompactSearch(false);
    setSearchResults([]);
    setSearchQuery('');
    setSearchError(null);
  };
  
  // Handle selecting a search result
  const handleSelectResult = (result) => {
    console.log('Selected result:', result);
    
    // Add a new viewer with the selected file
    setViewers(prev => {
      if (prev.length >= 4) {
        alert('Maximum of 4 viewers allowed. Please close one first.');
        return prev;
      }
      return [...prev, { id: Date.now(), filePath: result.path }];
    });
    
    // Close the search overlay
    handleCloseSearch();
  };
  
  const handleCloseViewer = (index) => {
    console.log('Closing viewer at index:', index);
    
    setViewers(prev => {
      const newViewers = [...prev];
      newViewers.splice(index, 1);
      return newViewers;
    });
    
    // Update active viewer index if needed
    if (activeViewerIndex >= index && activeViewerIndex > 0) {
      setActiveViewerIndex(prev => prev - 1);
    }
  };
  
  const handleViewerClick = (index) => {
    console.log('Setting active viewer to index:', index);
    setActiveViewerIndex(index);
  };
  
  // Get the grid class based on the number of viewers
  const getGridClass = () => {
    switch (viewers.length) {
      case 1: return 'grid-cols-1 grid-rows-1';
      case 2: return 'grid-cols-2 grid-rows-1';
      case 3: return 'grid-cols-2 grid-rows-2';
      case 4: return 'grid-cols-2 grid-rows-2';
      default: return 'grid-cols-1 grid-rows-1';
    }
  };
  
  // Get the file name from the path
  const getFileName = (path) => {
    if (!path) return '';
    const parts = path.split(/[\/\\]/);
    return parts[parts.length - 1];
  };
  
  // Compact search overlay
  const compactSearchOverlay = showCompactSearch && React.createElement('div', {
    className: 'fixed inset-0 bg-black/50 flex items-center justify-center z-50'
  },
    React.createElement('div', {
      className: 'bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-3/4 max-h-3/4 overflow-auto'
    }, [
      React.createElement('div', {
        key: 'header',
        className: 'flex justify-between items-center mb-4'
      }, [
        React.createElement('h3', {
          className: 'text-lg font-semibold dark:text-white'
        }, 'Search for Parts'),
        React.createElement('button', {
          onClick: handleCloseSearch,
          className: 'text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white text-2xl font-bold'
        }, '×')
      ]),
      React.createElement('div', {
        key: 'search-form',
        className: 'mb-4'
      }, [
        React.createElement('div', {
          key: 'search-input',
          className: 'flex gap-2 mb-2'
        }, [
          React.createElement('input', {
            type: 'text',
            value: searchQuery,
            onChange: (e) => setSearchQuery(e.target.value),
            placeholder: 'Enter part number or name...',
            className: 'flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white',
            onKeyDown: (e) => {
              if (e.key === 'Enter') {
                handleSearch();
              }
            }
          }),
          React.createElement('select', {
            value: searchType,
            onChange: (e) => setSearchType(e.target.value),
            className: 'px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white'
          }, [
            React.createElement('option', { value: 'all' }, 'All Files'),
            React.createElement('option', { value: 'stl' }, 'STL Only'),
            React.createElement('option', { value: '3mf' }, '3MF Only')
          ]),
          React.createElement('button', {
            onClick: handleSearch,
            disabled: searchLoading,
            className: `px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
              transition-colors ${searchLoading ? 'opacity-75 cursor-not-allowed' : ''}`
          }, searchLoading ? 'Searching...' : 'Search')
        ])
      ]),
      searchError && React.createElement('div', {
        key: 'search-error',
        className: 'mb-4 p-3 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-lg'
      }, searchError),
      searchResults.length > 0 && React.createElement('div', {
        key: 'search-results',
        className: 'overflow-auto max-h-[400px]'
      },
        React.createElement('table', {
          className: 'min-w-full divide-y divide-gray-200 dark:divide-gray-700'
        }, [
          React.createElement('thead', {
            key: 'thead',
            className: 'bg-gray-50 dark:bg-gray-800'
          },
            React.createElement('tr', null, [
              React.createElement('th', {
                key: 'name-header',
                className: 'px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'
              }, 'Name'),
              React.createElement('th', {
                key: 'type-header',
                className: 'px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'
              }, 'Type'),
              React.createElement('th', {
                key: 'size-header',
                className: 'px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'
              }, 'Size'),
              React.createElement('th', {
                key: 'actions-header',
                className: 'px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'
              }, 'Actions')
            ])
          ),
          React.createElement('tbody', {
            key: 'tbody',
            className: 'bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800'
          },
            searchResults.map((result) =>
              React.createElement('tr', {
                key: result.path,
                className: 'hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors'
              }, [
                React.createElement('td', {
                  key: 'name-cell',
                  className: 'px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white'
                }, result.name),
                React.createElement('td', {
                  key: 'type-cell',
                  className: 'px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400'
                },
                  React.createElement('span', {
                    className: 'px-2 py-1 text-xs font-medium rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-sm'
                  }, result.type)
                ),
                React.createElement('td', {
                  key: 'size-cell',
                  className: 'px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400'
                }, `${Math.round(result.size / 1024)} KB`),
                React.createElement('td', {
                  key: 'actions-cell',
                  className: 'px-6 py-4 whitespace-nowrap text-right text-sm font-medium'
                },
                  React.createElement('button', {
                    onClick: () => handleSelectResult(result),
                    className: 'text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300'
                  }, 'Select')
                )
              ])
            )
          )
        ])
      )
    ])
  );

  return React.createElement('div', {
    ref: containerRef,
    className: 'h-screen w-screen bg-gray-900 relative'
  }, [
    // Viewers grid
    React.createElement('div', {
      key: 'viewers-grid',
      className: `h-full w-full grid ${getGridClass()}`
    },
      viewers.map((viewer, index) =>
        React.createElement('div', {
          key: `viewer-${viewer.id}`,
          className: `relative border border-gray-800 ${index === activeViewerIndex ? 'ring-2 ring-blue-500' : ''}`,
          onClick: () => setActiveViewerIndex(index)
        }, [
          React.createElement('div', {
            key: 'model-viewer',
            className: 'h-full w-full'
          }, 
            React.createElement(window.ModelViewer, {
              filePath: viewer.filePath
            })
          ),
          React.createElement('div', {
            key: 'viewer-controls',
            className: 'absolute top-2 right-2 flex gap-2'
          }, [
            React.createElement('button', {
              key: 'close-button',
              onClick: (e) => {
                e.stopPropagation();
                handleCloseViewer(index);
              },
              className: 'p-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors'
            }, '×')
          ]),
          React.createElement('div', {
            key: 'file-info',
            className: 'absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 truncate'
          }, getFileName(viewer.filePath))
        ])
      )
    ),
    
    // Add view button
    viewers.length < 4 && React.createElement('button', {
      key: 'add-view-button',
      id: 'add-another-view-button',
      onClick: () => handleAddAnotherView({ detail: { filePath: null } }),
      className: 'absolute bottom-4 right-4 p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-lg'
    },
      React.createElement('svg', {
        width: 24,
        height: 24,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round'
      }, [
        React.createElement('line', { key: 'line1', x1: 12, y1: 5, x2: 12, y2: 19 }),
        React.createElement('line', { key: 'line2', x1: 5, y1: 12, x2: 19, y2: 12 })
      ])
    ),
    
    // Compact search overlay
    compactSearchOverlay
  ]);
} 