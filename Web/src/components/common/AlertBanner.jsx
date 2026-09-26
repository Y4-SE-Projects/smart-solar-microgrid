/* File: AlertBanner.jsx
 * Purpose: Full-width feedback banner for the result of an action or a failed data load. 
 *          One component covers both cases so success and error messages stay visually consistent across screens.
 *
 *          Props:
 *              variant     - 'success' | 'error' (default 'success')
 *              message     - the text to show
 *              actionLabel - optional trailing button label (e.g. "Retry")
 *              onAction    - handler for that button
 *              onDismiss   - when provided, renders a close button instead of an action
 * 
 * Author: IT23218512
 */

export default function AlertBanner({
  variant = 'success',
  message,
  actionLabel,
  onAction,
  onDismiss,
}) {
  if (!message) return null;

  const isError = variant === 'error';

  return (
    <div
      role={isError ? 'alert' : 'status'}
      className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${
        isError ? 'bg-error-container border-error/30' : 'bg-mint-surface border-secondary/30'
      }`}
    >
      <div className={`flex items-center gap-2.5 ${isError ? 'text-on-error-container' : 'text-primary'}`}>
        <span className={`material-symbols-outlined text-[20px] ${isError ? '' : 'text-secondary'}`}>
          {isError ? 'error' : 'check_circle'}
        </span>
        <span className="text-body-md font-medium">{message}</span>
      </div>

      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="shrink-0 px-4 py-2 rounded-full bg-surface-container-lowest border border-border-slate text-on-surface text-body-sm font-semibold hover:bg-surface-container-low transition-colors"
        >
          {actionLabel}
        </button>
      )}

      {!actionLabel && onDismiss && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-container-lowest/60 ${
            isError ? 'text-on-error-container' : 'text-primary'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      )}
    </div>
  );
}