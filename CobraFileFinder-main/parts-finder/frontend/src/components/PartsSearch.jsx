window.PartsSearch = function PartsSearch() {
  const [category, setCategory] = React.useState('motorcycle');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [searchResults, setSearchResults] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [selectedFiles, setSelectedFiles] = React.useState(new Set());
  const [notification, setNotification] = React.useState(null);
  const [fileType, setFileType] = React.useState('all');
  const [latestOnly, setLatestOnly] = React.useState(false);
  const [stats, setStats] = React.useState(null);
  const [isRefreshingCache, setIsRefreshingCache] = React.useState(false);
  const [isDarkMode, setIsDarkMode] = React.useState(
    localStorage.theme === 'dark' || 
    (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
  );
  const [page, setPage] = React.useState(1);
  const [itemsPerPage] = React.useState(10);
  const [previewFile, setPreviewFile] = React.useState(null);
  const [loadingStates, setLoadingStates] = React.useState({
    search: false,
    copy: false,
    preview: false
  });

  const theme = {
    bg: isDarkMode 
      ? 'bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900' 
      : 'bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50',
    card: isDarkMode 
      ? 'bg-gray-900/70 backdrop-blur-sm' 
      : 'bg-white/70 backdrop-blur-sm',
    text: isDarkMode ? 'text-purple-100' : 'text-purple-900',
    textMuted: isDarkMode ? 'text-purple-300' : 'text-purple-600',
    border: isDarkMode ? 'border-purple-800/30' : 'border-purple-200',
    hover: isDarkMode ? 'hover:bg-purple-900/30' : 'hover:bg-purple-50/50',
    selected: isDarkMode ? 'bg-purple-900/30' : 'bg-purple-50/50',
    accent: isDarkMode ? 'text-pink-400' : 'text-pink-600'
  };

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.theme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.theme = 'light';
    }
  };

  const handleSearch = async () => {
    if (!searchTerm) {
      setError('Please enter a search term');
      return;
    }

    setLoadingStates(prev => ({ ...prev, search: true }));
    setError('');
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          searchTerm,
          fileType: fileType === 'all' ? null : fileType,
          latestOnly
        })
      });
      
      let data;
      try {
        data = await response.json();
      } catch (err) {
        throw new Error('Failed to parse server response');
      }
      
      if (!response.ok) {
        throw new Error(data.error || 'Search failed');
      }
      
      setSearchResults(data.results);
      setStats(data.stats);
      setPage(1); // Reset to first page on new search
    } catch (err) {
      console.error('Search error:', err);
      setError(err.message || 'An unexpected error occurred');
      setSearchResults([]);
      setStats(null);
    } finally {
      setLoadingStates(prev => ({ ...prev, search: false }));
    }
  };

  const handleCopy = async () => {
    if (selectedFiles.size === 0) {
      setError('Please select files to copy');
      return;
    }

    setLoadingStates(prev => ({ ...prev, copy: true }));
    try {
      const filesToCopy = searchResults.filter(file => selectedFiles.has(file.path));
      
      const response = await fetch('/api/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: filesToCopy
        })
      });

      const data = await response.json();
      
      if (data.error) throw new Error(data.error);

      const successCount = data.results.filter(r => r.success).length;
      const failedFiles = data.results.filter(r => !r.success);
      
      if (failedFiles.length > 0) {
        const failedMessage = failedFiles.map(f => `${f.file}: ${f.error}`).join('\n');
        setError(`Some files failed to copy:\n${failedMessage}`);
      }
      
      setNotification(`Successfully copied ${successCount} files to Public Downloads folder`);
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      setError(`Copy failed: ${err.message}`);
      console.error('Copy error:', err);
    } finally {
      setLoadingStates(prev => ({ ...prev, copy: false }));
    }
  };

  const toggleFileSelection = (path) => {
    setSelectedFiles(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(path)) {
        newSelected.delete(path);
      } else {
        newSelected.add(path);
      }
      return newSelected;
    });
  };

  const PDFViewer = ({ className, url }) => 
    React.createElement('iframe', {
      src: `${url}#toolbar=0`,
      className: `w-full h-[600px] rounded-lg border ${className}`,
      type: 'application/pdf'
    });

  const paginatedResults = searchResults.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  // Add loading overlay component
  const LoadingOverlay = ({ visible, message }) => {
    if (!visible) return null;
    return React.createElement('div', {
      className: 'absolute inset-0 bg-purple-900/40 flex items-center justify-center z-50 backdrop-blur-sm'
    },
      React.createElement('div', {
        className: 'bg-white/90 dark:bg-gray-800/90 p-8 rounded-lg shadow-xl animate-pulse'
      }, [
        React.createElement('div', {
          key: 'spinner',
          className: 'animate-spin h-12 w-12 border-4 border-purple-500 border-t-transparent rounded-full mx-auto'
        }),
        React.createElement('p', {
          key: 'message',
          className: 'mt-4 text-lg font-medium text-purple-600 dark:text-purple-300'
        }, message || 'Loading...')
      ])
    );
  };

  // Add preview modal component
  const PreviewModal = ({ file, onClose }) => {
    if (!file) return null;
    
    const isModelFile = file.type.toLowerCase() === 'stl' || file.type.toLowerCase() === '3mf';
    
    return React.createElement('div', {
      className: 'fixed inset-0 bg-black/50 flex items-center justify-center z-50'
    },
      React.createElement('div', {
        className: 'bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-3/4 h-3/4'
      }, [
        React.createElement('div', {
          key: 'header',
          className: 'flex justify-between items-center mb-4'
        }, [
          React.createElement('h3', {
            className: 'text-lg font-semibold'
          }, file.name),
          React.createElement('button', {
            onClick: onClose,
            className: 'text-gray-500 hover:text-gray-700'
          }, '×')
        ]),
        React.createElement('div', {
          key: 'content',
          className: 'h-full'
        },
          isModelFile
            ? React.createElement(window.ModelViewer, {
                filePath: file.path
              })
            : React.createElement('iframe', {
                src: `file://${file.path}`,
                className: 'w-full h-full border rounded'
              })
        )
      ])
    );
  };

  // Add copy button and path selection to results container
  const copySection = selectedFiles.size > 0 && React.createElement('div', {
    className: 'mt-4 p-4 border-t border-purple-200/20 dark:border-purple-800/20'
  },
    React.createElement('button', {
      onClick: handleCopy,
      disabled: loadingStates.copy,
      className: `px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 
        transition-colors flex items-center gap-2 dark:bg-green-500 
        dark:hover:bg-green-600 ${loadingStates.copy ? 'opacity-75 cursor-not-allowed' : ''}`
    }, [
      React.createElement(window.CopyIcon, { 
        key: 'copy-icon',
        className: loadingStates.copy ? 'animate-spin' : ''
      }),
      React.createElement('span', { 
        key: 'copy-text' 
      }, loadingStates.copy 
          ? 'Copying...' 
          : `Copy Selected (${selectedFiles.size}) to Downloads`)
    ])
  );

  // Add the loading overlay to the results container
  const resultsContainer = React.createElement('div', {
    className: 'relative mt-6'
  }, [
    loadingStates.search && React.createElement(LoadingOverlay, {
      visible: true,
      message: 'Searching for parts...'
    }),
    searchResults.length > 0 && React.createElement('div', {
      className: 'mt-6 animate-fadeIn'
    },
      React.createElement('div', { 
        className: `rounded-xl border border-purple-200/20 shadow-lg backdrop-blur-sm dark:border-purple-800/20 transition-all duration-300 hover:shadow-purple-500/10` 
      },
        React.createElement('div', { className: 'overflow-x-auto' },
          React.createElement('table', { 
            key: 'table',
            className: `min-w-full divide-y ${theme.border}` 
          }, [
            // Table Header
            React.createElement('thead', { 
              key: 'thead',
              className: `px-6 py-3 text-left text-xs font-medium tracking-wider bg-gradient-to-r from-purple-500/10 to-pink-500/10` 
            },
              React.createElement('tr', null, [
                React.createElement('th', { 
                  key: 'checkbox-header',
                  className: `px-6 py-3 text-left text-xs font-medium ${theme.textMuted} uppercase` 
                },
                  React.createElement('input', {
                    type: 'checkbox',
                    onChange: () => {
                      if (selectedFiles.size === searchResults.length) {
                        setSelectedFiles(new Set());
                      } else {
                        setSelectedFiles(new Set(searchResults.map(f => f.path)));
                      }
                    },
                    checked: selectedFiles.size === searchResults.length && searchResults.length > 0,
                    className: 'rounded border-gray-300'
                  })
                ),
                React.createElement('th', { 
                  key: 'name-header',
                  className: `px-6 py-3 text-left text-xs font-medium ${theme.textMuted} uppercase` 
                }, 'Name'),
                React.createElement('th', { 
                  key: 'type-header',
                  className: `px-6 py-3 text-left text-xs font-medium ${theme.textMuted} uppercase` 
                }, 'Type'),
                React.createElement('th', { 
                  key: 'size-header',
                  className: `px-6 py-3 text-left text-xs font-medium ${theme.textMuted} uppercase` 
                }, 'Size'),
                React.createElement('th', { 
                  key: 'modified-header',
                  className: `px-6 py-3 text-left text-xs font-medium ${theme.textMuted} uppercase` 
                }, 'Modified'),
                React.createElement('th', { 
                  key: 'location-header',
                  className: `px-6 py-3 text-left text-xs font-medium ${theme.textMuted} uppercase` 
                }, 'Location')
              ])
            ),
            // Table Body
            React.createElement('tbody', { 
              key: 'tbody',
              className: `${theme.card} divide-y ${theme.border}` 
            },
              searchResults.map((file) =>
                React.createElement('tr', {
                  key: file.path,
                  className: `${theme.hover} transition-colors cursor-pointer
                    ${selectedFiles.has(file.path) ? theme.selected : theme.card}`,
                  onClick: (e) => {
                    if (e.ctrlKey || e.metaKey) {
                      setPreviewFile(file);
                    } else {
                      toggleFileSelection(file.path);
                    }
                  }
                }, [
                  React.createElement('td', { 
                    key: 'checkbox-cell',
                    className: 'px-6 py-4 whitespace-nowrap' 
                  },
                    React.createElement('input', {
                      key: `checkbox-${file.path}`,
                      type: 'checkbox',
                      checked: selectedFiles.has(file.path),
                      onChange: () => toggleFileSelection(file.path),
                      onClick: (e) => e.stopPropagation(),
                      className: 'rounded border-gray-300'
                    })
                  ),
                  React.createElement('td', { 
                    key: 'name-cell',
                    className: `px-6 py-4 whitespace-nowrap ${theme.text}` 
                  }, file.name),
                  React.createElement('td', { 
                    key: 'type-cell',
                    className: 'px-6 py-4 whitespace-nowrap' 
                  },
                    React.createElement('span', { 
                      className: 'px-2 py-1 text-xs font-medium rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-sm' 
                    }, file.type)
                  ),
                  React.createElement('td', { 
                    key: 'size-cell',
                    className: `px-6 py-4 whitespace-nowrap text-sm ${theme.textMuted}` 
                  }, `${Math.round(file.size / 1024)} KB`),
                  React.createElement('td', { 
                    key: 'modified-cell',
                    className: `px-6 py-4 whitespace-nowrap text-sm ${theme.textMuted}` 
                  }, new Date(file.modified * 1000).toLocaleString()),
                  React.createElement('td', { 
                    key: 'location-cell',
                    className: `px-6 py-4 text-sm ${theme.textMuted}` 
                  }, file.relative_path || file.path)
                ])
              )
            )
          ])
        )
      )
    ),
    copySection
  ]);

  return React.createElement('div', { 
    className: `min-h-screen ${theme.bg} transition-colors duration-200`
  }, [
    // Header with dark mode toggle
    React.createElement('div', {
      key: 'header',
      className: `${theme.card} border-b ${theme.border} shadow-sm`
    }, 
      React.createElement('div', {
        className: 'container mx-auto px-6 py-3 flex items-center justify-between'
      }, [
        React.createElement('div', { 
          key: 'logo-section',
          className: 'flex items-center space-x-3' 
        }, [
          React.createElement('div', {
            key: 'logo',
            className: 'w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center'
          },
            React.createElement('span', {
              className: 'text-white font-bold'
            }, 'PF')
          ),
          React.createElement('span', {
            key: 'title',
            className: `text-lg font-semibold ${theme.text}`
          }, 'Parts Finder')
        ]),
        React.createElement('button', {
          key: 'theme-toggle',
          onClick: toggleDarkMode,
          className: `p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 
            dark:hover:bg-gray-600 transition-colors flex items-center justify-center`
        }, 
          React.createElement(isDarkMode ? window.SunIcon : window.MoonIcon, {
            className: 'text-gray-600 dark:text-gray-200'
          })
        )
      ])
    ),

    // Stats Header
    stats && React.createElement('div', { 
      key: 'stats',
      className: `${theme.card} border-b ${theme.border}`
    },
      React.createElement('div', { 
        className: 'container mx-auto px-6 py-3 flex items-center justify-between' 
      }, [
        React.createElement('div', { 
          key: 'stats-info',
          className: 'flex items-center space-x-4' 
        }, [
          React.createElement('div', { 
            key: 'results-count',
            className: `text-sm ${theme.textMuted}` 
          }, [
            React.createElement('span', { 
              key: 'matched',
              className: `font-medium ${theme.text}` 
            }, stats.matched_files),
            React.createElement('span', { key: 'text1' }, ' results from '),
            React.createElement('span', { 
              key: 'total',
              className: `font-medium ${theme.text}` 
            }, stats.total_files),
            React.createElement('span', { key: 'text2' }, ' files')
          ]),
          React.createElement('div', { 
            key: 'search-time',
            className: `text-sm ${theme.textMuted}` 
          }, [
            React.createElement('span', { key: 'text' }, 'Search completed in '),
            React.createElement('span', { 
              key: 'time',
              className: `font-medium ${theme.text}` 
            }, `${stats.search_time_ms}ms`)
          ])
        ]),
        React.createElement('button', {
          key: 'refresh-button',
          onClick: async () => {
            setIsRefreshingCache(true);
            try {
              const response = await fetch('/api/cache-refresh', { method: 'POST' });
              const data = await response.json();
              setNotification(data.message);
            } catch (err) {
              setError('Failed to refresh cache');
            } finally {
              setIsRefreshingCache(false);
            }
          },
          disabled: isRefreshingCache,
          className: `inline-flex items-center px-3 py-1.5 border ${theme.border} shadow-sm text-sm 
            font-medium rounded-md ${theme.text} ${theme.card} ${theme.hover}
            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
            ${isRefreshingCache ? 'opacity-50 cursor-not-allowed' : ''}`
        }, [
          React.createElement(window.RefreshIcon, { 
            key: 'refresh-icon',
            className: `h-4 w-4 mr-2 ${isRefreshingCache ? 'animate-spin' : ''}` 
          }),
          React.createElement('span', {
            key: 'refresh-text'
          }, isRefreshingCache ? 'Refreshing...' : 'Refresh Cache')
        ])
      ])
    ),

    // Main Content
    React.createElement('div', { 
      key: 'main-content',
      className: 'container mx-auto p-6' 
    },
      React.createElement(window.Card, null,
        React.createElement(window.CardHeader, { className: 'border-b' },
          React.createElement('div', { className: 'flex justify-between items-center' }, [
            React.createElement('div', { 
              key: 'title-section'
            },
              React.createElement(window.CardTitle, null, 'Parts Search'),
              React.createElement('p', { 
                className: `text-sm ${theme.textMuted} mt-1 font-medium`
              },
                'Search for STL, 3MF, and STEP files across motorcycle and aerospace directories'
              )
            ),
            React.createElement(window.Select, {
              key: 'category-select',
              value: category,
              onValueChange: setCategory,
              className: 'w-[180px]'
            }, [
              React.createElement(window.SelectItem, { 
                key: 'motorcycle',
                value: 'motorcycle' 
              }, 'Motorcycle Parts'),
              React.createElement(window.SelectItem, { 
                key: 'aerospace',
                value: 'aerospace' 
              }, 'Aerospace Parts')
            ])
          ])
        ),
        React.createElement(window.CardContent, null,
          React.createElement('div', { className: 'mt-6' },
            React.createElement('div', { className: 'space-y-4' }, [
              // Search Input
              React.createElement('div', { key: 'search-input', className: 'flex-1' },
                React.createElement('textarea', {
                  value: searchTerm,
                  onChange: (e) => setSearchTerm(e.target.value),
                  className: `w-full rounded-lg border ${theme.border} px-4 py-3 h-24 resize-none 
                    ${theme.card} ${theme.text} placeholder-gray-500 dark:placeholder-gray-400
                    focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors`,
                  placeholder: 'Enter part numbers (one per line or comma-separated)...'
                })
              ),

              // Controls
              React.createElement('div', { key: 'controls', className: 'flex gap-4 items-center' }, [
                React.createElement(window.Select, {
                  value: fileType,
                  onValueChange: setFileType,
                  className: 'w-[180px]'
                }, [
                  React.createElement(window.SelectItem, { 
                    key: 'all',
                    value: 'all' 
                  }, 'All Files'),
                  React.createElement(window.SelectItem, { 
                    key: 'stl',
                    value: 'stl' 
                  }, 'STL Only'),
                  React.createElement(window.SelectItem, { 
                    key: '3mf',
                    value: '3mf' 
                  }, '3MF Only'),
                  React.createElement(window.SelectItem, { 
                    key: 'step',
                    value: 'step' 
                  }, 'STEP Only')
                ]),
                React.createElement('label', { 
                  className: `flex items-center gap-2 text-sm ${theme.text} cursor-pointer` 
                }, [
                  React.createElement('input', {
                    key: 'checkbox',
                    type: 'checkbox',
                    checked: latestOnly,
                    onChange: (e) => setLatestOnly(e.target.checked),
                    className: 'rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 transition-colors'
                  }),
                  React.createElement('span', { 
                    key: 'label-text' 
                  }, 'Latest versions only')
                ])
              ]),

              // Search Button
              React.createElement('button', {
                key: 'search-button',
                onClick: handleSearch,
                disabled: loadingStates.search,
                className: `px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 
                  hover:from-purple-600 hover:to-pink-600 text-white rounded-lg 
                  transition-all duration-300 transform hover:scale-[1.02] 
                  active:scale-[0.98] shadow-lg hover:shadow-purple-500/25 
                  animate-glow flex items-center gap-2
                  ${loadingStates.search ? 'opacity-75 cursor-not-allowed' : ''}`
              }, [
                React.createElement('div', {
                  key: 'search-icon',
                  className: `${loadingStates.search ? 'animate-spin' : ''} w-5 h-5`
                }, 
                  React.createElement(window.SearchIcon, {
                    className: 'w-full h-full'
                  })
                ),
                React.createElement('span', {
                  key: 'search-text'
                }, loadingStates.search ? 'Searching...' : 'Search')
              ])
            ])
          ),

          // Error Message
          error && React.createElement(window.Alert, { 
            variant: 'destructive', 
            className: 'mt-4' 
          },
            React.createElement(window.AlertDescription, null, error)
          ),

          // Notification
          notification && React.createElement('div', {
            className: 'fixed bottom-4 right-4 animate-slideIn'
          },
            React.createElement(window.Alert, { className: 'mt-4' },
              React.createElement(window.AlertDescription, null, notification)
            )
          ),

          // Results Table
          resultsContainer
        )
      )
    )
  ]); // Close the main return array
};    // Close the PartsSearch function

// Icon Components
window.FolderIcon = function FolderIcon(props) {
  return React.createElement('svg', {
    xmlns: "http://www.w3.org/2000/svg",
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: props.className || '',
  }, [
    React.createElement('path', {
      key: 'path',
      d: "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
    })
  ]);
};
