/* File: ProsumerPasswordDialog.jsx
 * Purpose: Administrative password reset for a Prosumer account, through PUT /api/users/prosumers/{nic}/password.
 *          The recovery path for a Prosumer who has forgotten their password, since the app has no self-service reset.
 *          The dialog itself is the shared PasswordResetDialog; this supplies the Prosumer's summary.
 *
 *          Props:
 *              prosumer     - the account whose password is being reset
 *              isSubmitting - true while the request is in flight
 *              onConfirm    - called with the new password
 *              onCancel
 *
 * Author: IT23218512
 */

import PasswordResetDialog from '../common/PasswordResetDialog';

// Opens the shared reset dialog with the Prosumer's name, NIC and contact details.
export default function ProsumerPasswordDialog({ prosumer, isSubmitting, onConfirm, onCancel }) {
  return (
    <PasswordResetDialog
      key={prosumer?.nic}
      account={prosumer}
      title="Reset Prosumer Password"
      details={
        prosumer
          ? [
              { label: 'Prosumer', value: prosumer.fullName },
              { label: 'NIC', value: prosumer.nic },
              { label: 'Contact', value: `${prosumer.email} · ${prosumer.phone}` },
            ]
          : []
      }
      isSubmitting={isSubmitting}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
