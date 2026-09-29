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
    <div className="flex max-w-full items-center overflow-x-auto rounded-full border border-border-slate bg-canvas-bg p-1 text-xs text-on-surface-variant">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
          aria-pressed={value === option.key}
          className={`shrink-0 rounded-full px-4 py-1.5 font-medium tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary ${
            value === option.key
              ? 'bg-surface-container-lowest font-bold text-primary shadow-xs'
              : 'hover:text-on-surface'
          }`}
        >
          {option.label}
          {option.count !== undefined && ` (${option.count})`}
        </button>
      ))}
    </div>
  );
}
