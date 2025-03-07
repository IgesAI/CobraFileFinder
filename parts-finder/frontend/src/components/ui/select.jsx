const Select = ({ value, onValueChange, children }) => {
  return React.createElement('select', {
    value: value,
    onChange: (e) => onValueChange(e.target.value),
    className: 'border rounded-md px-3 py-2 bg-white'
  }, children);
};

const SelectTrigger = ({ className, children }) => (
  <div className={`relative ${className}`}>{children}</div>
);

const SelectContent = ({ children }) => (
  <div className="absolute mt-1 w-full bg-white border rounded-md shadow-lg">
    {children}
  </div>
);

const SelectItem = ({ value, children }) => (
  <option value={value}>{children}</option>
);

const SelectValue = ({ placeholder }) => placeholder;

window.Select = Select;
window.SelectTrigger = SelectTrigger;
window.SelectContent = SelectContent;
window.SelectItem = SelectItem;
window.SelectValue = SelectValue; 