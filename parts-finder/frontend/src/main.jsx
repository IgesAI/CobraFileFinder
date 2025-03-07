document.addEventListener('DOMContentLoaded', function() {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(
    React.createElement(React.StrictMode, null,
      React.createElement(window.App)
    )
  );
});
