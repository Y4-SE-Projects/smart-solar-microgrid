/* File: SearchInput.jsx
 * Purpose: Icon-prefixed search field used in directory toolbars.
 *          Controlled by the parent, which owns the search term and decides what the text is matched against.
 * 
 * Author: IT23218512
 */

export default function SearchInput({ value, onChange, placeholder = 'Search...' }) {
  return (
    <div className="relative flex-1 min-w-55 max-w-md">
      <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-outline pointer-events-none">
        search
      </span>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full h-9 pl-10 pr-4 rounded-full bg-surface-container-low border border-border-slate text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest focus:border-secondary transition-all"
      />
    </div>
  );
}