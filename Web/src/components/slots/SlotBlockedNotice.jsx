// File: SlotBlockedNotice.jsx
// Purpose: Dialog body shown instead of a slot form when the station can't take slot changes.

import { SECONDARY_BUTTON } from '../ui/buttonStyles';

export default function SlotBlockedNotice({ message, onClose }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3 rounded-xl bg-error-container/55 px-4 py-3 text-body-sm text-on-error-container">
        <span className="material-symbols-outlined mt-0.5 shrink-0 text-[18px]" aria-hidden="true">
          block
        </span>
        <p>{message}</p>
      </div>
      <div className="flex justify-end">
        <button type="button" onClick={onClose} className={SECONDARY_BUTTON}>
          Close
        </button>
      </div>
    </div>
  );
}
