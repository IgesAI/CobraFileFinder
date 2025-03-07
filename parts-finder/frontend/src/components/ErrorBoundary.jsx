window.ErrorBoundary = class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return React.createElement('div', {
        className: 'min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900'
      },
        React.createElement('div', {
          className: 'text-center p-8 rounded-lg bg-white dark:bg-gray-800 shadow-xl'
        }, [
          React.createElement('h2', {
            key: 'error-title',
            className: 'text-2xl font-bold text-red-600 mb-4'
          }, 'Something went wrong'),
          React.createElement('button', {
            key: 'refresh-button',
            onClick: () => window.location.reload(),
            className: 'px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600'
          }, 'Refresh Page')
        ])
      );
    }

    return this.props.children;
  }
} 