const Alert = ({ className = '', variant = "default", ...props }) => {
  const variants = {
    default: "bg-blue-100 text-blue-800",
    destructive: "bg-red-100 text-red-800",
  };

  return React.createElement('div', {
    className: `rounded-lg p-4 ${variants[variant]} ${className}`,
    ...props
  });
};

const AlertDescription = ({ className = '', ...props }) => {
  return React.createElement('div', {
    className: `text-sm [&_p]:leading-relaxed ${className}`,
    ...props
  });
};

window.Alert = Alert;
window.AlertDescription = AlertDescription; 