/* File: RejectDialog.jsx
 * Purpose: Confirmation step before declining a prosumer's reactivation request.
 *          Collects the optional reason, which the API stores and surfaces to the prosumer at their next login attempt. 
 *          This field is the only explanation they ever receive.
 *
 *          Props:
 *              prosumer     - the account whose request is being declined
 *              isSubmitting - true while the request is in flight
 *              error        - message from a failed attempt
 *              onConfirm    - called with the reason text
 *              onCancel
 *
 * Author: IT23218512
 */

import { useState, useEffect } from 'react';
import ConfirmDialog from '../common/ConfirmDialog';
import { formatDate, pluralize } from '../../utils/formatters';

export default function RejectDialog({ prosumer, isSubmitting, error, onConfirm, onCancel }) {
  const [reason, setReason] = useState('');

  // Clear the field when a different account is selected, so a reason typed for one prosumer can't be submitted against another.
  useEffect(() => {
    setReason('');
  }, [prosumer?.nic]);

  if (!prosumer) return null;

  const isWaiting =
    prosumer.daysSinceRequest !== null && prosumer.daysSinceRequest !== undefined;

  return (
    <ConfirmDialog
      title="Decline Reactivation Request"
      icon="do_not_disturb_on"
      confirmLabel="Confirm & Decline"
      isSubmitting={isSubmitting}
      error={error}
      onConfirm={() => onConfirm(reason.trim())}
      onCancel={onCancel}
    >
      <div className="p-4 rounded-xl bg-surface-container-low text-body-sm text-on-surface-variant flex flex-col gap-1.5 border border-border-slate">
        <div>
          <strong className="text-on-surface">Prosumer:</strong> {prosumer.fullName}
        </div>
        <div className="tabular-nums">
          <strong className="text-on-surface">NIC:</strong> {prosumer.nic}
        </div>
        <div className="tabular-nums">
          <strong className="text-on-surface">Requested:</strong>{' '}
          {formatDate(prosumer.reactivationRequestedAt)}
          {isWaiting && ` (${pluralize(prosumer.daysSinceRequest, 'day')} waiting)`}
        </div>
        <div>
          <strong className="text-on-surface">Declared reason for leaving:</strong>{' '}
          {prosumer.deactivationReason || 'None given'}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-label-md font-medium text-on-surface" htmlFor="reject-reason">
          Reason for declining <span className="text-outline font-normal">(optional)</span>
        </label>
        <textarea
          id="reject-reason"
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="e.g. Duplicate account on the same NIC"
          className="px-3 py-2 rounded bg-surface-container-lowest text-body-md text-on-surface placeholder:text-outline border border-border-slate focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all resize-none"
        />
      </div>

      <p className="text-body-sm text-on-surface-variant leading-relaxed">
        The account stays deactivated and leaves the queue. Whatever is written above is shown to
        the prosumer the next time they try to sign in, so it is the only explanation they get —
        leaving it blank tells them nothing. They can request reactivation again afterwards.
      </p>
    </ConfirmDialog>
  );
}