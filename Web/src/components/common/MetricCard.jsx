/* File: MetricCard.jsx
 * Purpose: Summary figure card used in the metrics row at the top of the account-management screens.
 *
 *          Props:
 *              label    - uppercase heading above the figure
 *              value    - the figure itself
 *              caption  - optional short note beside the figure (e.g. a percentage)
 *              note     - supporting line beneath the figure
 *              icon     - icon name shown top-right
 *              iconBgClass - icon background and foreground colors
 *
 * Author: IT23218512
 */

export default function MetricCard({ label, value, caption, note, icon, iconBgClass = 'bg-mint-surface text-primary' }) {
  return (
    <div
      className="flex flex-col justify-between rounded-2xl border border-border-slate bg-surface-container-lowest p-6 shadow-sm"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-outline">{label}</span>
        <div className={`flex size-9 shrink-0 items-center justify-center rounded-full ${iconBgClass}`}>
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">{icon}</span>
        </div>
      </div>
      <div>
        <div className="flex items-baseline gap-2">
          <span
            className="text-metric-num font-bold tabular-nums text-on-surface"
          >
            {value}
          </span>
          {caption && <span className="text-body-sm font-semibold text-secondary">{caption}</span>}
        </div>
        {note && <span className="mt-2 block text-body-sm text-on-surface-variant">{note}</span>}
      </div>
    </div>
  );
}
