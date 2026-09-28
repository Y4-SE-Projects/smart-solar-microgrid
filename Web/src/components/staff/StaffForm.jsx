/* File: StaffForm.jsx
 * Purpose: Form; for creating a Backoffice or Grid Operator account through POST /api/users/register,
 *                for editing a Backoffice or Grid Operator account through PUT /api/users/staff/{username}.
 *
 *          Props:
 *              mode         - 'create' (default) or 'edit'
 *              member       - the staff account being edited; ignored when creating
 *              isSubmitting - true while the request is in flight
 *              error        - message from a failed attempt
 *              onSubmit     - called with the register or update payload
 *              onCancel     - closes the form
 *
 * Author: IT23218512
 */

import { useState, useEffect } from 'react';
import { Roles } from '../../constants/roles';
import { formatRole } from '../../utils/formatters';

// Roles this screen can create.
// Prosumer is deliberately absent. Prosumers self-register from the mobile app with an NIC.
const STAFF_ROLES = [Roles.GridOperator, Roles.Backoffice];

const EMPTY_FORM = {
  role: Roles.GridOperator,
  username: '',
  fullName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
};

// Single labelled input. Kept local since it carries this form's specific layout and error styling.
function Field({
  label,
  name,
  type = 'text',
  value,
  onChange,
  error,
  placeholder,
  autoComplete,
  autoFocus = false,
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-label-md font-medium text-on-surface" htmlFor={`staff-${name}`}>
        {label}
      </label>
      <input
        id={`staff-${name}`}
        name={name}
        type={type}
        value={value}
        onChange={(event) => onChange(name, event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        className={`h-9 px-3 rounded bg-surface-container-lowest text-body-md text-on-surface placeholder:text-outline border focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all ${
          error ? 'border-alert-danger' : 'border-border-slate'
        }`}
      />
      {error && <span className="text-body-sm text-alert-danger">{error}</span>}
    </div>
  );
}

export default function StaffForm({
  mode = 'create',
  member = null,
  isSubmitting,
  error,
  onSubmit,
  onCancel,
}) {
  const isEdit = mode === 'edit';

  const [form, setForm] = useState(() =>
    isEdit && member
      ? {
          ...EMPTY_FORM,
          role: member.role,
          username: member.username,
          fullName: member.fullName ?? '',
          email: member.email ?? '',
          phone: member.phone ?? '',
        }
      : EMPTY_FORM
  );
  const [fieldErrors, setFieldErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);

 // Escape closes the dialog, except mid-submission when the request is already on its way to the server.
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape' && !isSubmitting) onCancel();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSubmitting, onCancel]);

  // Stops the page behind the dialog from scrolling while it is open, and restores whatever the previous value was on close.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // Clears a field's error as soon as it is edited, so a correction doesn't sit next to a stale complaint.
  function handleChange(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  }

  function validate() {
    const errors = {};

    // The username and the password only exist as inputs when creating an account.
    if (!isEdit) {
      if (!form.username.trim()) {
        errors.username = 'Username is required.';
      } else if (/\s/.test(form.username.trim())) {
        errors.username = 'Username cannot contain spaces.';
      }

      if (!form.password) {
        errors.password = 'Password is required.';
      } else if (form.password.length < 8) {
        errors.password = 'Use at least 8 characters.';
      }

      // Guards against a typo locking the new account holder (Grid Operator) out, since the password is set on their behalf.
      if (form.confirmPassword !== form.password) {
        errors.confirmPassword = 'Passwords do not match.';
      }
    }

    if (!form.fullName.trim()) errors.fullName = 'Full name is required.';

    if (!form.email.trim()) {
      errors.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = 'Enter a valid email address.';
    }

    if (!form.phone.trim()) errors.phone = 'Phone number is required.';

    return errors;
  }

  function handleSubmit(event) {
    event.preventDefault();
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    if (isEdit) {
      onSubmit({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
      });
      return;
    }

    onSubmit({
      role: form.role,
      username: form.username.trim(),
      password: form.password,
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="staff-form-title"
      className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      {/* The card is capped at 90% of the viewport and scrolls internally. 
          So the header, the error message and the buttons stay reachable on a short screen. */}
      <div className="bg-surface-container-lowest rounded-2xl w-full max-w-2xl max-h-[90vh] shadow-xl border border-border-slate flex flex-col overflow-hidden">
        <div className="p-5 bg-surface-container-low/50 border-b border-border-slate flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[18px]">
                {isEdit ? 'edit' : 'person_add'}
              </span>
            </div>
            <div>
              <h2 id="staff-form-title" className="text-headline-sm font-bold text-primary">
                {isEdit ? 'Edit Staff Account' : 'Create Staff Account'}
              </h2>
              <p className="text-body-sm text-on-surface-variant">
                {isEdit
                  ? 'Username and role are fixed once an account exists.'
                  : 'Staff sign in with a username rather than an NIC.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onCancel}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-full flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-container-low disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col min-h-0 flex-1">
          <div className="p-6 flex flex-col gap-5 overflow-y-auto">
            {isEdit ? (
              /* Shown rather than edited, so it is clear which account is being changed and also clear that these two values are not on the table. */
              <div className="p-4 rounded-xl bg-surface-container-low border border-border-slate flex flex-wrap items-center gap-x-8 gap-y-2 text-body-sm">
                <div>
                  <span className="text-on-surface-variant">Username: </span>
                  <strong className="text-on-surface">{form.username}</strong>
                </div>
                <div>
                  <span className="text-on-surface-variant">Role: </span>
                  <strong className="text-on-surface">{formatRole(form.role)}</strong>
                </div>
              </div>
            ) : (
              /* Role */
              <div className="flex flex-col gap-1.5">
                <span className="text-label-md font-medium text-on-surface">Account Role</span>
                <div className="inline-flex p-1 rounded-full bg-surface-container-low border border-border-slate text-body-sm self-start">
                  {STAFF_ROLES.map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => handleChange('role', role)}
                      className={`px-4 py-1.5 rounded-full transition-colors ${
                        form.role === role
                          ? 'bg-surface-container-lowest text-primary font-semibold shadow-sm'
                          : 'text-on-surface-variant hover:text-on-surface font-medium'
                      }`}
                    >
                      {formatRole(role)}
                    </button>
                  ))}
                </div>
                <span className="text-body-sm text-on-surface-variant">
                  {form.role === Roles.Backoffice
                    ? 'Full administrative access to the web console.'
                    : 'Manages slot availability and reservations on web and mobile.'}
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {!isEdit && (
                <Field
                  label="Username"
                  name="username"
                  value={form.username}
                  onChange={handleChange}
                  error={fieldErrors.username}
                  placeholder="e.g. j.silva"
                  autoComplete="off"
                  autoFocus
                />
              )}
              <Field
                label="Full Name"
                name="fullName"
                value={form.fullName}
                onChange={handleChange}
                error={fieldErrors.fullName}
                placeholder="e.g. Jayani Silva"
                autoComplete="off"
                autoFocus={isEdit}
              />
              <Field
                label="Email Address"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                error={fieldErrors.email}
                placeholder="e.g. j.silva@heliogrid.lk"
                autoComplete="off"
              />
              <Field
                label="Phone Number"
                name="phone"
                type="tel"
                value={form.phone}
                onChange={handleChange}
                error={fieldErrors.phone}
                placeholder="e.g. +94 77 123 4567"
                autoComplete="off"
              />
            </div>

            {/* Passwords are only set at creation. 
                Changing one afterwards goes through the separate reset dialog, which is the only route the API offers. */}
            {!isEdit && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label
                    className="text-label-md font-medium text-on-surface"
                    htmlFor="staff-password"
                  >
                    Initial Password
                  </label>
                  <div className="relative flex items-center">
                    <input
                      id="staff-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={(event) => handleChange('password', event.target.value)}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                      className={`w-full h-9 pl-3 pr-10 rounded bg-surface-container-lowest text-body-md text-on-surface placeholder:text-outline border focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all ${
                        fieldErrors.password ? 'border-alert-danger' : 'border-border-slate'
                      }`}
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
                  {fieldErrors.password && (
                    <span className="text-body-sm text-alert-danger">{fieldErrors.password}</span>
                  )}
                </div>

                <Field
                  label="Confirm Password"
                  name="confirmPassword"
                  type="password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  error={fieldErrors.confirmPassword}
                  placeholder="Re-enter the password"
                  autoComplete="new-password"
                />
              </div>
            )}
          </div>

          {/* Kept outside the scrolling area so a rejection from the API is visible no matter where the form is scrolled to. */}
          {error && (
            <div className="px-6 pb-4 shrink-0">
              <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-error-container text-on-error-container text-body-sm">
                <span className="material-symbols-outlined text-[18px] mt-0.5">error</span>
                <span>{error}</span>
              </div>
            </div>
          )}

          <div className="p-5 border-t border-border-slate bg-surface-container-lowest flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-full border border-border-slate bg-surface-container-lowest text-on-surface hover:bg-surface-container-low text-body-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-full bg-primary text-on-primary hover:bg-primary-container text-body-sm font-semibold shadow-sm disabled:opacity-70 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isSubmitting && (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              <span>
                {isSubmitting
                  ? isEdit
                    ? 'Saving…'
                    : 'Creating…'
                  : isEdit
                    ? 'Save Changes'
                    : 'Create Account'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}