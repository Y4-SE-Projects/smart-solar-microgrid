/* File: DeactivateProsumerDialog.jsx
 * Purpose: Confirmation before Backoffice deactivates a Prosumer account, through PUT /api/users/prosumers/{nic}/deactivate.
 *          Collects an optional reason, which the API stores with the account.
 *
 *          Props:
 *              prosumer     - the account being deactivated
 *              isSubmitting - true while the request is in flight
 *              onConfirm    - called with the reason text ( empty when none was given )
 *              onCancel
 *
 * Author: IT23218512
 */

import { useState } from 'react';
import ConfirmDialog from '../common/ConfirmDialog';
import ReasonField from '../common/ReasonField';
import { formatDate } from '../../utils/formatters';

export default function DeactivateProsumerDialog({ prosumer, isSubmitting, onConfirm, onCancel }) {
  const [reason, setReason] = useState('');

  if (!prosumer) return null;

  return (
    <ConfirmDialog
      title="Deactivate Prosumer Account"
      icon="block"
      confirmLabel="Confirm & Deactivate"
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
        <div>
          <strong className="text-on-surface">Contact:</strong> {prosumer.email} · {prosumer.phone}
        </div>
        <div className="tabular-nums">
          <strong className="text-on-surface">Registered:</strong> {formatDate(prosumer.createdAt)}
        </div>
      </div>

      <ReasonField
        id="deactivate-reason"
        label="Reason for deactivating"
        value={reason}
        onChange={setReason}
        placeholder="e.g. Outstanding grid balance"
      />

      <p className="text-body-sm text-on-surface-variant leading-relaxed">
        The prosumer is signed out of the mobile app on their next action and can't sign in again until 
        a Backoffice user reactivates the account. The account and its booking history are kept. They can 
        send a reactivation request from the app, which will appear in the queue above.
      </p>
    </ConfirmDialog>
  );
}
