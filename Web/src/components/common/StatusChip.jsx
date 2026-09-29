/* File: StatusChip.jsx
 * Purpose: Account status pill.
 *          Prefers the API's computed `status` and falls back to `isActive` for the staff endpoint, whose response carries the flag but not the status field.
 *          (staff accounts only ever have two states).
 *
 *          Props:
 *              status   - one of the AccountStatus values, when the response carries it
 *              isActive - used on its own for staff accounts
 * 
 * Author: IT23218512
 */

import { AccountStatus, resolveAccountStatus } from '../../constants/accountStatus';

const CHIP_STYLES = {
  [AccountStatus.Active]: {
    label: 'Active',
    className: 'bg-mint-surface text-primary-container',
    dotClassName: 'bg-secondary',
  },
  [AccountStatus.PendingReactivation]: {
    label: 'In Queue',
    className: 'bg-error-container text-alert-danger',
    dotClassName: 'bg-alert-danger',
  },
  [AccountStatus.Deactivated]: {
    label: 'Deactivated',
    className: 'bg-surface-container-high text-on-surface-variant',
    dotClassName: 'bg-outline',
  },
};

export default function StatusChip({ status, isActive }) {
  const resolved = resolveAccountStatus({ status, isActive });
  const chip = CHIP_STYLES[resolved] ?? CHIP_STYLES[AccountStatus.Deactivated];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-body-sm font-semibold ${chip.className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${chip.dotClassName}`} />
      <span>{chip.label}</span>
    </span>
  );
}