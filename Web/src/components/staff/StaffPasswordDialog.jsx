/* File: StaffPasswordDialog.jsx
 * Purpose: Administrative password reset for a staff account, through PUT /api/users/staff/{username}/password.
 *          The account's current password is never asked since an administrator resetting a forgotten password has no way of knowing it.
 *
 *          Props:
 *              member       - the staff account whose password is being reset
 *              isSubmitting - true while the request is in flight
 *              error        - message from a failed attempt
 *              onConfirm    - called with the new password
 *              onCancel
 *
 * Author: IT23218512
 */

import { useState, useEffect } from 'react';
import ConfirmDialog from '../common/ConfirmDialog';
import { formatRole } from '../../utils/formatters';

const MINIMUM_PASSWORD_LENGTH = 8;

export default function StaffPasswordDialog({
  member,
  isSubmitting,
  error,
  onConfirm,
  onCancel,
}) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState('');

  // Clear the fields when a different account is selected, so a password typed for one staff member can't be submitted against another.
  useEffect(() => {
    setPassword('');
    setConfirmPassword('');
    setValidationError('');
  }, [member?.username]);

  if (!member) return null;

  // The same minimum the API enforces. 
  // The server stays authoritative. This only saves a round trip and puts the message next to the field that caused it.
  function handleConfirm() {
    if (password.length < MINIMUM_PASSWORD_LENGTH) {
      setValidationError(`Use at least ${MINIMUM_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setValidationError('Passwords do not match.');
      return;
    }
    setValidationError('');
    onConfirm(password);
  }

  return (
    <ConfirmDialog
      title="Reset Staff Password"
      icon="key"
      confirmLabel="Reset Password"
      isSubmitting={isSubmitting}
      error={validationError || error}
      onConfirm={handleConfirm}
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

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-label-md font-medium text-on-surface" htmlFor="reset-password">
            New Password
          </label>
          <div className="relative flex items-center">
            <input
              id="reset-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={`At least ${MINIMUM_PASSWORD_LENGTH} characters`}
              autoComplete="new-password"
              className="w-full h-9 pl-3 pr-10 rounded bg-surface-container-lowest text-body-md text-on-surface placeholder:text-outline border border-border-slate focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
            />
            <button
              type="button"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((previous) => !previous)}
              className="absolute right-2 p-1 text-on-surface-variant hover:text-primary transition-colors focus:outline-none flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-[18px]">
                {showPassword ? 'visibility_off' : 'visibility'}
              </span>
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label
            className="text-label-md font-medium text-on-surface"
            htmlFor="reset-confirm-password"
          >
            Confirm New Password
          </label>
          <input
            id="reset-confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Re-enter the password"
            autoComplete="new-password"
            className="h-9 px-3 rounded bg-surface-container-lowest text-body-md text-on-surface placeholder:text-outline border border-border-slate focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
          />
        </div>
      </div>

      <p className="text-body-sm text-on-surface-variant leading-relaxed">
        The old password stops working immediately, and nothing is sent to the account holder —
        pass the new password to them yourself. Anyone already signed in as this account stays
        signed in until their session expires.
      </p>
    </ConfirmDialog>
  );
}