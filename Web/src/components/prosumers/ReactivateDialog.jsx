/* File: ReactivateDialog.jsx
 * Purpose: Confirmation step before reactivating a prosumer account. 
 *
 *          Props:
 *              prosumer     - the account to reactivate
 *              isSubmitting - true while the request is in flight
 *              error        - message from a failed attempt
 *              onConfirm / onCancel
 * 
 * Author: IT23218512
 */

import ConfirmDialog from '../common/ConfirmDialog';
import { formatDate, pluralize } from '../../utils/formatters';

export default function ReactivateDialog({ prosumer, isSubmitting, error, onConfirm, onCancel }) {
  if (!prosumer) return null;

  const hasElapsed = prosumer.daysElapsed !== null && prosumer.daysElapsed !== undefined;

  return (
    <ConfirmDialog
      title="Reactivate Prosumer Account"
      icon="verified"
      confirmLabel="Confirm & Reactivate"
      isSubmitting={isSubmitting}
      error={error}
      onConfirm={onConfirm}
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
          <strong className="text-on-surface">Deactivated:</strong>{' '}
          {formatDate(prosumer.deactivatedAt)}
          {hasElapsed && ` (${pluralize(prosumer.daysElapsed, 'day')} ago)`}
        </div>
        <div>
          <strong className="text-on-surface">Declared reason:</strong>{' '}
          {prosumer.deactivationReason || 'None given'}
        </div>
      </div>

      <p className="text-body-sm text-on-surface-variant leading-relaxed">
        Reactivating restores this account immediately: the prosumer will be able to sign in from
        the mobile app and create reservations again. Only a Backoffice user can perform this
        action.
      </p>
    </ConfirmDialog>
  );
}