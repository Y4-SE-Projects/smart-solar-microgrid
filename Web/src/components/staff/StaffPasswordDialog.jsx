/* File: StaffPasswordDialog.jsx
 * Purpose: Administrative password reset for a staff account, through PUT /api/users/staff/{username}/password.
 *          The dialog itself is the shared PasswordResetDialog; this supplies the staff account's summary.
 *
 *          Props:
 *              member       - the staff account whose password is being reset
 *              isSubmitting - true while the request is in flight
 *              onConfirm    - called with the new password
 *              onCancel
 *
 * Author: IT23218512
 */

import PasswordResetDialog from '../common/PasswordResetDialog';
import { formatRole } from '../../utils/formatters';

// Opens the shared reset dialog with the staff member's name, username and role.
export default function StaffPasswordDialog({ member, isSubmitting, onConfirm, onCancel }) {
  return (
    <PasswordResetDialog
      key={member?.username}
      account={member}
      title="Reset Staff Password"
      details={
        member
          ? [
              { label: 'Account', value: member.fullName },
              { label: 'Username', value: member.username },
              { label: 'Role', value: formatRole(member.role) },
            ]
          : []
      }
      isSubmitting={isSubmitting}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}