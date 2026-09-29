/* File: SearchInput.jsx
 * Purpose: Icon-prefixed search field used in directory toolbars.
 *          Controlled by the parent, which owns the search term and decides what the text is matched against.
 * 
 * Author: IT23218512
 */

export default function SearchInput({ value, onChange, placeholder = 'Search...' }) {
  return (
    <div className="relative w-full min-w-0 max-w-sm">
      <span className="material-symbols-outlined pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[17px] text-outline" aria-hidden="true">
        search
      </span>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={placeholder}
        placeholder={placeholder}
        className="h-10 w-full rounded-full border border-border-slate bg-canvas-bg pl-9 pr-4 text-xs text-on-surface outline-none transition-colors placeholder:text-on-surface-variant focus:border-secondary focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary/20"
      />
    </div>
  );
}
