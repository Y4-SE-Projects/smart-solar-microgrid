/* File: StaffDirectory.jsx
 * Purpose: Directory of every Backoffice and Grid Operator account, from GET /api/users/staff, with the actions a Backoffice user can take on each one.
 *          Handles its own searching, filtering and paging, the same way the prosumer directory does.
 *
 *          Props:
 *              staff            - the staff accounts
 *              isLoading        - true while the list is being fetched
 *              currentUsername  - the signed-in user, so their own row can be marked and guarded
 *              onEdit           - called with the account whose details are being changed
 *              onResetPassword  - called with the account whose password is being reset
 *              onToggleStatus   - called with (account, 'deactivate' | 'reactivate')
 *
 * Author: IT23218512
 */

import { useState, useMemo } from 'react';
import SearchInput from '../common/SearchInput';
import FilterPills from '../common/FilterPills';
import Pagination from '../common/Pagination';
import StatusChip from '../common/StatusChip';
import { Roles } from '../../constants/roles';
import { formatDate, formatRole } from '../../utils/formatters';

const ROWS_PER_PAGE = 10;

// Role badge.
// Backoffice and Grid Operator get distinct fills so the two are separable at a glance when the list grows.
function RoleChip({ role }) {
  const isBackoffice = role === Roles.Backoffice;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-body-sm font-semibold ${
        isBackoffice
          ? 'bg-surface-container-highest text-primary'
          : 'bg-tertiary-fixed text-tertiary'
      }`}
    >
      <span className="material-symbols-outlined text-[14px]">
        {isBackoffice ? 'admin_panel_settings' : 'engineering'}
      </span>
      <span>{formatRole(role)}</span>
    </span>
  );
}

// Compact icon action. Disabled buttons keep their tooltip, which is where the reason lives.
function RowAction({ icon, label, onClick, disabled = false, danger = false }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        danger
          ? 'text-on-surface-variant hover:text-alert-danger hover:bg-error-container disabled:hover:bg-transparent disabled:hover:text-on-surface-variant'
          : 'text-on-surface-variant hover:text-primary hover:bg-surface-container disabled:hover:bg-transparent disabled:hover:text-on-surface-variant'
      }`}
    >
      <span className="material-symbols-outlined text-[18px]">{icon}</span>
    </button>
  );
}

export default function StaffDirectory({
  staff,
  isLoading,
  loadError,
  onRetry,
  currentUsername,
  onEdit,
  onResetPassword,
  onToggleStatus,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [page, setPage] = useState(1);

  const totalCount = staff.length;
  const backofficeCount = staff.filter((member) => member.role === Roles.Backoffice).length;
  const operatorCount = staff.filter((member) => member.role === Roles.GridOperator).length;

  // The API refuses to disable the last Backoffice account that can still sign in.
  const activeBackofficeCount = staff.filter(
    (member) => member.role === Roles.Backoffice && member.isActive
  ).length;

  const filteredStaff = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return staff.filter((member) => {
      if (roleFilter !== 'all' && member.role !== roleFilter) return false;
      if (!query) return true;
      return [member.username, member.fullName, member.email].some((field) =>
        (field ?? '').toLowerCase().includes(query)
      );
    });
  }, [staff, searchTerm, roleFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredStaff.length / ROWS_PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filteredStaff.slice(
    (currentPage - 1) * ROWS_PER_PAGE,
    currentPage * ROWS_PER_PAGE
  );

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border-slate bg-surface-container-lowest shadow-sm">
      <div className="flex flex-col gap-4 border-b border-border-slate p-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="w-full xl:max-w-sm">
          <SearchInput
            value={searchTerm}
            onChange={(value) => {
              setSearchTerm(value);
              setPage(1);
            }}
            placeholder="Search by username, name, or email"
          />
        </div>
        <div className="max-w-full self-start xl:self-auto">
          <FilterPills
            value={roleFilter}
            onChange={(value) => {
              setRoleFilter(value);
              setPage(1);
            }}
            options={[
              { key: 'all', label: 'All', count: totalCount },
              { key: Roles.Backoffice, label: 'Backoffice', count: backofficeCount },
              { key: Roles.GridOperator, label: 'Grid Operator', count: operatorCount },
            ]}
          />
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border-slate bg-canvas-bg font-semibold uppercase tracking-wider text-outline">
              <th className="whitespace-nowrap px-5 py-4">Username</th>
              <th className="whitespace-nowrap px-5 py-4">Role</th>
              <th className="whitespace-nowrap px-5 py-4">Name</th>
              <th className="whitespace-nowrap px-5 py-4">Contact</th>
              <th className="whitespace-nowrap px-5 py-4">Created</th>
              <th className="whitespace-nowrap px-5 py-4">Status</th>
              <th className="whitespace-nowrap px-5 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-slate">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-on-surface-variant">
                  Loading staff accounts…
                </td>
              </tr>
            ) : loadError ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center">
                  <p className="mb-3 text-alert-danger">{loadError}</p>
                  <button
                    type="button"
                    onClick={onRetry}
                    className="rounded-full bg-surface-container-high px-4 py-1.5 text-label-md font-semibold text-on-surface"
                  >
                    Retry
                  </button>
                </td>
              </tr>
            ) : pageRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-on-surface-variant">
                  {totalCount === 0
                    ? 'No staff accounts yet. Add an account to get started.'
                    : 'No staff accounts match your search or filter.'}
                </td>
              </tr>
            ) : (
              pageRows.map((member) => {
                const isSelf = member.username === currentUsername;
                const isLastActiveBackoffice =
                  member.role === Roles.Backoffice && member.isActive && activeBackofficeCount <= 1;

                // Both of these are refused by the API. 
                // The tooltip is what turns a dead button into an explanation.
                const disableReason = isSelf
                  ? 'You cannot disable your own account'
                  : isLastActiveBackoffice
                    ? 'This is the last active Backoffice account'
                    : null;

                return (
                  <tr
                    key={member.username}
                    className="transition-colors hover:bg-surface-container-low"
                  >
                    <td className="whitespace-nowrap px-5 py-4 font-semibold text-primary">
                      <span className="inline-flex items-center gap-2">
                        <span className="rounded-full bg-surface-container-high px-3 py-1 text-[11px] text-on-surface">{member.username}</span>
                        {isSelf && (
                          <span className="rounded-full bg-mint-surface px-2 py-0.5 text-[11px] font-semibold text-primary">
                            You
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <RoleChip role={member.role} />
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-on-surface">
                      {member.fullName}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <div className="flex flex-col">
                        <span className="text-body-sm text-on-surface-variant">{member.email}</span>
                        <span className="text-body-sm text-outline tabular-nums">
                          {member.phone}
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-on-surface-variant tabular-nums">
                      {formatDate(member.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <StatusChip isActive={member.isActive} />
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right">
                      <div className="inline-flex items-center gap-1 justify-end">
                        <RowAction
                          icon="edit"
                          label="Edit details"
                          onClick={() => onEdit(member)}
                        />
                        <RowAction
                          icon="key"
                          label="Reset password"
                          onClick={() => onResetPassword(member)}
                        />
                        {member.isActive ? (
                          <RowAction
                            icon="block"
                            label={disableReason ?? 'Disable access'}
                            onClick={() => onToggleStatus(member, 'deactivate')}
                            disabled={Boolean(disableReason)}
                            danger
                          />
                        ) : (
                          <RowAction
                            icon="lock_open"
                            label="Restore access"
                            onClick={() => onToggleStatus(member, 'reactivate')}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {!isLoading && !loadError && (
        <Pagination
          page={currentPage}
          pageCount={pageCount}
          totalItems={filteredStaff.length}
          pageSize={ROWS_PER_PAGE}
          itemLabel="accounts"
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
