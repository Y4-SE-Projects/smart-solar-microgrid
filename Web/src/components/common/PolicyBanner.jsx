/* File: PolicyBanner.jsx
 * Purpose: The "rules this screen operates under" panel shown under a page heading.
 *          Shared by the staff and prosumer pages so both explain their rules in the same style.
 *
 *          Props:
 *              title    - panel heading, e.g. "Account Policy"
 *              children - the explanation text
 *              icon     - Material Symbols icon name ( defaults to "gavel" )
 *
 * Author: IT23218512
 */

// Rounded panel with an icon, a title and the screen's rules underneath.
export default function PolicyBanner({ title, children, icon = 'gavel' }) {
  return (
    <div className="p-5 rounded-2xl bg-surface-container-low/70 border border-border-slate flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-start sm:items-center gap-3.5">
        <div className="w-9 h-9 rounded-full bg-surface-container-highest text-primary flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[20px] text-secondary" aria-hidden="true">
            {icon}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-title-md text-primary font-semibold">{title}</span>
          <p className="text-body-sm text-on-surface-variant mt-0.5">{children}</p>
        </div>
      </div>
    </div>
  );
}
