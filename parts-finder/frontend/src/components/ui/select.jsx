const Select = ({ value, onValueChange, children }) => {
  return React.createElement('select', {
    value: value,
    onChange: (e) => onValueChange(e.target.value),
    className: 'border rounded-md px-3 py-2 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-50'
  }, children);
};

const SelectItem = ({ value, children }) => {
  return React.createElement('option', {
    value: value
  }, children);
};

window.Select = Select;
window.SelectItem = SelectItem; 