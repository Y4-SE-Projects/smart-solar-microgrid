/* File: ConfirmDialog.jsx
 * Purpose: Modal shell for confirming an action that writes to the API.
 *          Holds the overlay, header, error slot and buttons. 
 *          The caller supplies the body, so screen-specific details stay out of this component.
 *
 *          Props:
 *              title        - heading text
 *              icon         - icon name shown beside the heading
 *              confirmLabel - primary button text (default "Confirm")
 *              isSubmitting - disables both buttons and shows a spinner while the request is in flight, so the action can't be fired twice
 *              error        - message from a failed attempt; the dialog stays open so the user can retry without re-selecting the record
 *              onConfirm / onCancel
 *              children     - the record summary and any explanatory text
 * 
 * Author: IT23218512
 */

export default function ConfirmDialog({
  title,
  icon = 'help',
  confirmLabel = 'Confirm',
  isSubmitting = false,
  error = '',
  onConfirm,
  onCancel,
  children,
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <div className="bg-surface-container-lowest rounded-2xl max-w-lg w-full p-6 shadow-xl flex flex-col gap-4 border border-border-slate">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-primary">
            <div className="w-8 h-8 rounded-full bg-mint-surface flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">{icon}</span>
            </div>
            <h3 className="text-headline-sm font-bold">{title}</h3>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onCancel}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-full flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-container-low disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {children}

        {error && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-error-container text-on-error-container text-body-sm">
            <span className="material-symbols-outlined text-[18px] mt-0.5">error</span>
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-full border border-border-slate bg-surface-container-lowest text-on-surface hover:bg-surface-container-low text-body-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-full bg-primary text-on-primary hover:bg-primary-container text-body-sm font-semibold shadow-sm disabled:opacity-70 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isSubmitting && (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
            <span>{isSubmitting ? 'Working…' : confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}