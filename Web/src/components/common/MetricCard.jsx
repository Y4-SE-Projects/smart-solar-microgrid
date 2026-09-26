/* File: MetricCard.jsx
 * Purpose: Summary figure card used in the metrics row at the top of the account-management screens.
 *
 *          Props:
 *              label    - uppercase heading above the figure
 *              value    - the figure itself
 *              caption  - optional short note beside the figure (e.g. a percentage)
 *              note     - supporting line beneath the figure
 *              icon     - icon name shown top-right (ignored when `emphasis` is set)
 *
 * Author: IT23218512
 */

export default function MetricCard({ label, value, caption, note, icon, emphasis = false }) {
  return (
    <div
      className={`p-6 rounded-2xl bg-surface-container-lowest border shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow ${
        emphasis ? 'border-error/30' : 'border-border-slate'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span
          className={`text-label-sm uppercase font-semibold ${
            emphasis ? 'text-alert-danger' : 'text-on-surface-variant'
          }`}
        >
          {label}
        </span>
        {emphasis ? (
          <span className="px-2.5 py-0.5 rounded-full bg-error-container text-alert-danger text-label-sm font-bold">
            Action Required
          </span>
        ) : (
          <div className="w-8 h-8 rounded-full bg-surface-container-low text-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-[18px]">{icon}</span>
          </div>
        )}
      </div>
      <div>
        <div className="flex items-baseline gap-2">
          <span
            className={`text-metric-num font-bold tabular-nums ${
              emphasis ? 'text-alert-danger' : 'text-on-surface'
            }`}
          >
            {value}
          </span>
          {caption && <span className="text-body-sm font-semibold text-secondary">{caption}</span>}
        </div>
        {note && <span className="text-body-sm text-on-surface-variant block mt-1">{note}</span>}
      </div>
    </div>
  );
}