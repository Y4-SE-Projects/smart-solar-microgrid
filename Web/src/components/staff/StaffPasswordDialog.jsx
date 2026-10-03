/* File: StaffPasswordDialog.jsx
 * Purpose: Administrative password reset for a staff account, through PUT /api/users/staff/{username}/password.
 *          The account's current password is never asked since an administrator resetting a forgotten password has no way of knowing it.
 *
 *          Props:
 *              member       - the staff account whose password is being reset
 *              isSubmitting - true while the request is in flight
 *              onConfirm    - called with the new password
 *              onCancel
 *
 * Author: IT23218512
 */

import { useState, useEffect } from 'react';
import ConfirmDialog from '../common/ConfirmDialog';
import { formatRole } from '../../utils/formatters';
import { MAXIMUM_PASSWORD_BYTES, MINIMUM_PASSWORD_LENGTH, newPasswordError } from '../../utils/passwordRules';

export default function StaffPasswordDialog({
  member,
  isSubmitting,
  onConfirm,
  onCancel,
}) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Same timing as the staff form: a field's message appears once it has been left (or on Reset Password).
  // After that it follows the value live as the user keeps typing.
  const [touched, setTouched] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // Clear the fields when a different account is selected, so a password typed for one staff member can't be submitted against another.
  useEffect(() => {
    setPassword('');
    setConfirmPassword('');
    setTouched({});
    setSubmitAttempted(false);
  }, [member?.username]);

  if (!member) return null;

  // The same rule and wording the API enforces. ( at least 8 characters, not only spaces, at most 72 bytes )
  // The server stays authoritative. This only saves a round trip and puts the message next to the field that caused it.
  const errors = {};
  const passwordMessage = newPasswordError(password);
  if (passwordMessage) {
    errors.password = passwordMessage;
  }
  if (confirmPassword !== password) {
    errors.confirmPassword = 'Passwords do not match.';
  }
  const errorFor = (name) => (submitAttempted || touched[name] ? errors[name] : undefined);
  const inputBorder = (name) => (errorFor(name) ? 'border-alert-danger' : 'border-border-slate');

  function markTouched(name) {
    setTouched((current) => (current[name] ? current : { ...current, [name]: true }));
  }

  function handleConfirm() {
    setSubmitAttempted(true);
    if (Object.keys(errors).length > 0) return;
    onConfirm(password);
  }

  return (
    <ConfirmDialog
      title="Reset Staff Password"
      icon="key"
      confirmLabel="Reset Password"
      isSubmitting={isSubmitting}
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
              onBlur={() => markTouched('password')}
              aria-invalid={Boolean(errorFor('password'))}
              aria-describedby={errorFor('password') ? 'reset-password-error' : undefined}
              placeholder={`At least ${MINIMUM_PASSWORD_LENGTH} characters`}
              autoComplete="new-password"
              maxLength={MAXIMUM_PASSWORD_BYTES}
              className={`w-full h-9 pl-3 pr-10 rounded bg-surface-container-lowest text-body-md text-on-surface placeholder:text-outline border ${inputBorder('password')} focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all`}
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
          {errorFor('password') && (
            <span id="reset-password-error" className="text-body-sm text-alert-danger">
              {errorFor('password')}
            </span>
          )}
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
            onBlur={() => markTouched('confirmPassword')}
            aria-invalid={Boolean(errorFor('confirmPassword'))}
            aria-describedby={errorFor('confirmPassword') ? 'reset-confirm-password-error' : undefined}
            placeholder="Re-enter the password"
            autoComplete="new-password"
            maxLength={MAXIMUM_PASSWORD_BYTES}
            className={`h-9 px-3 rounded bg-surface-container-lowest text-body-md text-on-surface placeholder:text-outline border ${inputBorder('confirmPassword')} focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all`}
          />
          {errorFor('confirmPassword') && (
            <span id="reset-confirm-password-error" className="text-body-sm text-alert-danger">
              {errorFor('confirmPassword')}
            </span>
          )}
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