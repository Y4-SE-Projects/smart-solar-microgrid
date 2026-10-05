/* File: RejectDialog.jsx
 * Purpose: Confirmation step before declining a prosumer's reactivation request.
 *          Collects the optional reason, which the API stores and surfaces to the prosumer at their next login attempt. 
 *          This field is the only explanation they ever receive.
 *
 *          Props:
 *              prosumer     - the account whose request is being declined
 *              isSubmitting - true while the request is in flight
 *              onConfirm    - called with the reason text
 *              onCancel
 *
 * Author: IT23218512
 */

import { useState } from 'react';
import ConfirmDialog from '../common/ConfirmDialog';
import ReasonField from '../common/ReasonField';
import { formatDate, pluralize } from '../../utils/formatters';

export default function RejectDialog({ prosumer, isSubmitting, onConfirm, onCancel }) {
  const [reason, setReason] = useState('');

  if (!prosumer) return null;

  const isWaiting =
    prosumer.daysSinceRequest !== null && prosumer.daysSinceRequest !== undefined;

  return (
    <ConfirmDialog
      title="Decline Reactivation Request"
      icon="do_not_disturb_on"
      confirmLabel="Confirm & Decline"
      isSubmitting={isSubmitting}
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

      {/* Shared reason box: stops at the API's 500-character limit and shows a live count. */}
      <ReasonField
        id="reject-reason"
        label="Reason for declining"
        value={reason}
        onChange={setReason}
        placeholder="e.g. Duplicate account on the same NIC"
      />

      <p className="text-body-sm text-on-surface-variant leading-relaxed">
        The account stays deactivated and leaves the queue. The reason written above is shown to the prosumer 
        the next time they try to sign in. It is the only explanation they get — leaving it blank tells them 
        nothing. They can request reactivation again afterwards.
      </p>
    </ConfirmDialog>
  );
}