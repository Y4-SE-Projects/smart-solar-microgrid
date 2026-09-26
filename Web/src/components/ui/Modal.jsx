// File: Modal.jsx
// Purpose: Generic centered dialog shell, reused by every modal in the app.

import { useEffect, useId, useRef } from 'react';

export default function Modal({ title, description, onClose, children, maxWidthClassName = 'max-w-lg', scrollable = true }) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef(null);

  // Callers usually pass an inline arrow, so the latest one is kept in a ref rather than
  // re-running the mount effect (which would also re-steal focus) on every render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Moves focus into the dialog when it opens, and closes it on Escape unless a control inside
  // (such as an open dropdown) already handled that key.
  useEffect(() => {
    panelRef.current?.focus();
    function handleKeyDown(event) {
      if (event.key === 'Escape' && !event.defaultPrevented) onCloseRef.current();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center px-gutter">
      <div
        className="absolute inset-0 bg-inverse-surface/40 animate-backdrop-in motion-reduce:animate-none"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`relative w-full ${maxWidthClassName} bg-surface-container-lowest rounded-2xl shadow-xl p-space-xl ${scrollable ? 'max-h-[90vh] overflow-y-auto' : 'overflow-visible'} outline-none animate-dialog-in motion-reduce:animate-none`}
      >
        <div className="flex items-start justify-between gap-3 mb-space-lg">
          <div className="min-w-0">
            <h2 id={titleId} className="text-headline-sm font-bold text-primary">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="text-body-sm text-on-surface-variant mt-0.5 truncate">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 -mr-1.5 -mt-1 shrink-0 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors outline-none focus-visible:ring-2 focus-visible:ring-secondary"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
              close
            </span>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
