/* File: PasswordChecklist.jsx
 * Purpose: Live list of the new-password requirements under a password field, each ticked off as it is met.
 *          Shared by the staff form and the password reset dialog.
 *
 *          Props:
 *              id         - list id, for the input's aria-describedby
 *              password   - the value being typed
 *              showUnmet  - true once the field has been left or submitted; unmet items then turn red
 *
 * Author: IT23218512
 */

import { passwordChecks } from '../../utils/accountRules';

export default function PasswordChecklist({ id, password, showUnmet }) {
  return (
    <ul id={id} className="flex flex-wrap gap-x-4 gap-y-1 mt-0.5 text-body-sm">
      {passwordChecks(password).map(({ label, met }) => (
        <li
          key={label}
          className={`flex items-center gap-1 ${
            met ? 'text-secondary' : showUnmet ? 'text-alert-danger' : 'text-on-surface-variant'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
            {met ? 'check_circle' : 'radio_button_unchecked'}
          </span>
          {label}
          <span className="sr-only">{met ? '(done)' : '(missing)'}</span>
        </li>
      ))}
    </ul>
  );
}
