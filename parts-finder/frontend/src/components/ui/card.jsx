const Card = ({ className = '', ...props }) => {
  return React.createElement('div', {
    className: `rounded-lg border bg-card text-card-foreground shadow-sm ${className}`,
    ...props
  });
};

const CardHeader = ({ className = '', ...props }) => {
  return React.createElement('div', {
    className: `flex flex-col space-y-1.5 p-6 ${className}`,
    ...props
  });
};

const CardTitle = ({ className = '', ...props }) => {
  return React.createElement('h3', {
    className: `text-2xl font-semibold leading-none tracking-tight ${className}`,
    ...props
  });
};

const CardContent = ({ className = '', ...props }) => {
  return React.createElement('div', {
    className: `p-6 pt-0 ${className}`,
    ...props
  });
};

window.Card = Card;
window.CardHeader = CardHeader;
window.CardTitle = CardTitle;
window.CardContent = CardContent; 