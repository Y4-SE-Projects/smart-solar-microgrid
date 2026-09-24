// File: Modal.jsx
// Purpose: Generic centered dialog shell, reused by every modal in the app.

export default function Modal({ title, onClose, children, maxWidthClassName = 'max-w-lg' }) {
  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center px-gutter">
      <div className="absolute inset-0 bg-inverse-surface/40" onClick={onClose} />
      <div
        className={`relative w-full ${maxWidthClassName} bg-surface-container-lowest rounded-2xl shadow-xl p-space-xl max-h-[90vh] overflow-y-auto`}
      >
        <div className="flex items-center justify-between mb-space-md">
          <h2 className="text-headline-sm font-bold text-primary">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
