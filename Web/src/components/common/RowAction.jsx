/* File: RowAction.jsx
 * Purpose: Compact icon button for a table row's actions, shared by the staff and prosumer directories.
 *
 *          Props:
 *              icon     - Material Symbols icon name
 *              label    - tooltip and accessible name
 *              onClick  - called when pressed
 *              disabled - greys the button out ( the label then explains why )
 *              danger   - tints the hover state red for a destructive action
 *
 * Author: IT23218512
 */

// Icon-only row button; the label doubles as the tooltip so the action is still named.
export default function RowAction({ icon, label, onClick, disabled = false, danger = false }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        danger
          ? 'text-on-surface-variant hover:text-alert-danger hover:bg-error-container disabled:hover:bg-transparent disabled:hover:text-on-surface-variant'
          : 'text-on-surface-variant hover:text-primary hover:bg-surface-container disabled:hover:bg-transparent disabled:hover:text-on-surface-variant'
      }`}
    >
      <span className="material-symbols-outlined text-[18px]">{icon}</span>
    </button>
  );
}
