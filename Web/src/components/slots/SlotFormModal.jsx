// File: SlotFormModal.jsx
// Purpose: Create/Edit form for one bookable slot's start/end time window (Backoffice only).
//          The API rejects a timestamp with no timezone; datetime-local inputs are local
//          wall-clock time with none, so this converts through Date/toISOString on submit,
//          and back again (in local time) when prefilling an existing slot for edit.

import { useState } from 'react';
import Modal from '../ui/Modal';
import { inputClass } from '../stations/formStyles';

function toDatetimeLocalValue(isoString) {
  const date = new Date(isoString);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function SlotFormModal({ slot, onClose, onSubmit }) {
  const isEdit = Boolean(slot);
  const [startTime, setStartTime] = useState(() => (slot ? toDatetimeLocalValue(slot.startTime) : ''));
  const [endTime, setEndTime] = useState(() => (slot ? toDatetimeLocalValue(slot.endTime) : ''));
  const [generalError, setGeneralError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setGeneralError('');
    setIsSubmitting(true);

    try {
      await onSubmit({
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
      });
    } catch (error) {
      setGeneralError(error.response?.data?.message || 'Something went wrong while saving the slot.');
      setIsSubmitting(false);
    }
  }

  return (
    <Modal title={isEdit ? `Edit ${slot.slotId}` : 'Add Slot'} onClose={onClose} maxWidthClassName="max-w-md">
      <form className="space-y-space-md" onSubmit={handleSubmit} noValidate>
        <div className="space-y-1">
          <label className="text-label-md font-medium text-on-surface">Starts</label>
          <input
            type="datetime-local"
            className={inputClass}
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-label-md font-medium text-on-surface">Ends</label>
          <input
            type="datetime-local"
            className={inputClass}
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            required
          />
        </div>

        {generalError && (
          <div role="alert" className="flex items-start gap-2 px-space-md py-space-sm bg-error-container text-on-error-container rounded-xl text-body-sm">
            <span className="material-symbols-outlined text-[18px] mt-0.5">error</span>
            <span>{generalError}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-space-sm">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-full text-on-surface-variant font-semibold text-sm hover:bg-surface-container-low transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-full bg-primary-container text-on-primary font-semibold text-sm shadow-sm hover:bg-primary disabled:opacity-60 transition-all"
          >
            {isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Slot'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
