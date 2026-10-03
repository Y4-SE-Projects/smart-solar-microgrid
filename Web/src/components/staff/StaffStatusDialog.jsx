/* File: StaffStatusDialog.jsx
 * Purpose: Confirmation before disabling or restoring a staff account's console access, through PUT /api/users/staff/{username}/deactivate and /reactivate.
 *
 *          Props:
 *              member       - the staff account being switched
 *              mode         - 'deactivate' or 'reactivate'
 *              isSubmitting - true while the request is in flight
 *              onConfirm / onCancel
 *
 * Author: IT23218512
 */

import ConfirmDialog from '../common/ConfirmDialog';
import { formatRole } from '../../utils/formatters';

export default function StaffStatusDialog({
  member,
  mode,
  isSubmitting,
  onConfirm,
  onCancel,
}) {
  if (!member) return null;

  const isDeactivating = mode === 'deactivate';

  return (
    <ConfirmDialog
      title={isDeactivating ? 'Disable Staff Access' : 'Restore Staff Access'}
      icon={isDeactivating ? 'block' : 'lock_open'}
      confirmLabel={isDeactivating ? 'Confirm & Disable' : 'Confirm & Restore'}
      isSubmitting={isSubmitting}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <div className="p-4 rounded-xl bg-surface-container-low text-body-sm text-on-surface-variant flex flex-col gap-1.5 border border-border-slate">
        <div>
          <strong className="text-on-surface">Account:</strong> {member.fullName}
        </div>
        <div>
          <strong className="text-on-surface">Username:</strong> {member.username}
        </div>
        <div>
          <strong className="text-on-surface">Role:</strong> {formatRole(member.role)}
        </div>
      </div>

      <p className="text-body-sm text-on-surface-variant leading-relaxed">
        {isDeactivating ? (
          <>
            This account will no longer be able to sign in to the console or the mobile app. The
            account itself is kept rather than deleted, so any work already recorded against this
            username stays intact. Another Backoffice user — or you — can restore access at any
            time.
          </>
        ) : (
          <>
            This account will be able to sign in again straight away, with the same password as
            before. Nothing else about it changes.
          </>
        )}
      </p>
    </ConfirmDialog>
  );
}