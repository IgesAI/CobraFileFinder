window.App = function App() {
  return React.createElement('div', {
    className: 'min-h-screen bg-white dark:bg-gray-900'
  },
    React.createElement(window.PartsSearch)
  );
};