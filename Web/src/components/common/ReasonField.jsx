/* File: ReasonField.jsx
 * Purpose: Optional free-text reason box with a live character count, shared by the decline and deactivate dialogs.
 *          Stops accepting input at the limit, rather than letting the user type past it and then refusing the submission.
 *
 *          Props:
 *              id          - input id ( also used for the counter's id )
 *              label       - field label; "(optional)" is added after it
 *              value       - current text
 *              onChange    - called with the new text
 *              placeholder - example text
 *              maxLength   - character limit ( defaults to the API's 500 )
 *
 * Author: IT23218512
 */

// Matches the API's limit on deactivation and decline reasons.
export const MAXIMUM_REASON_LENGTH = 500;

// Labelled textarea plus a "n / 500" counter that turns red at the limit.
export default function ReasonField({ id, label, value, onChange, placeholder, maxLength = MAXIMUM_REASON_LENGTH }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-label-md font-medium text-on-surface" htmlFor={id}>
        {label} <span className="text-outline font-normal">(optional)</span>
      </label>
      <textarea
        id={id}
        rows={3}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={maxLength}
        aria-describedby={`${id}-count`}
        placeholder={placeholder}
        className="px-3 py-2 rounded bg-surface-container-lowest text-body-md text-on-surface placeholder:text-outline border border-border-slate focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all resize-none"
      />
      <span
        id={`${id}-count`}
        className={`self-end text-body-sm tabular-nums ${
          value.length >= maxLength ? 'text-alert-danger' : 'text-outline'
        }`}
      >
        {value.length} / {maxLength}
      </span>
    </div>
  );
}
