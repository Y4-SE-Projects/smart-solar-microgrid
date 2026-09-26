/* File: FilterPills.jsx
 * Purpose: Segmented control for filtering a directory table. 
 *          Options are passed in rather than hardcoded. 
 *          So, the same component serves a status filter on one screen and a role filter on another.
 *          
 *          Props:
 *              options  - [{ key, label, count }]; `count` is optional
 *              value    - the currently selected key
 *              onChange - called with the key of the clicked option
 * 
 * Author: IT23218512
 */

export default function FilterPills({ options, value, onChange }) {
  return (
    <div className="inline-flex p-1 rounded-full bg-surface-container-low border border-border-slate text-body-sm">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
          className={`px-4 py-1 rounded-full transition-colors tabular-nums ${
            value === option.key
              ? 'bg-surface-container-lowest text-primary font-semibold shadow-sm'
              : 'text-on-surface-variant hover:text-on-surface font-medium'
          }`}
        >
          {option.label}
          {option.count !== undefined && ` (${option.count})`}
        </button>
      ))}
    </div>
  );
}