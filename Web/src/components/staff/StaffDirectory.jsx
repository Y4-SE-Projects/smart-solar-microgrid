/* File: StaffDirectory.jsx
 * Purpose: Directory of every Backoffice and Grid Operator account, from GET /api/users/staff.
 *          This is a read-only view.
 *          Handles its own searching, filtering and paging, the same way the prosumer directory does. 
 *
 *          Props:
 *              staff     - the staff accounts
 *              isLoading - true while the list is being fetched
 * 
 * Author: IT23218512
 */

import { useState, useMemo, useEffect } from 'react';
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

export default function StaffDirectory({ staff, isLoading }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [page, setPage] = useState(1);

  const totalCount = staff.length;
  const backofficeCount = staff.filter((member) => member.role === Roles.Backoffice).length;
  const operatorCount = staff.filter((member) => member.role === Roles.GridOperator).length;

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

  // A narrower filter can leave fewer results than the current page covers.
  useEffect(() => {
    setPage(1);
  }, [searchTerm, roleFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredStaff.length / ROWS_PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filteredStaff.slice(
    (currentPage - 1) * ROWS_PER_PAGE,
    currentPage * ROWS_PER_PAGE
  );

  return (
    <div className="rounded-2xl bg-surface-container-lowest border border-border-slate shadow-sm flex flex-col overflow-hidden">
      <div className="p-6 border-b border-border-slate flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-headline-sm font-bold text-primary">Staff Accounts</h2>
            <p className="text-body-sm text-on-surface-variant">
              Backoffice and Grid Operator accounts with console access.
            </p>
          </div>
          <div className="flex items-center gap-1 text-body-sm text-outline font-medium">
            <span className="material-symbols-outlined text-[16px] text-secondary">badge</span>
            <span>Identified by username</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search by username, full name, or email..."
          />
          <FilterPills
            value={roleFilter}
            onChange={setRoleFilter}
            options={[
              { key: 'all', label: 'All', count: totalCount },
              { key: Roles.Backoffice, label: 'Backoffice', count: backofficeCount },
              { key: Roles.GridOperator, label: 'Grid Operator', count: operatorCount },
            ]}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low/30 text-outline text-label-sm font-semibold uppercase border-b border-border-slate">
              <th className="py-3 px-6 whitespace-nowrap">Username</th>
              <th className="py-3 px-5 whitespace-nowrap">Role</th>
              <th className="py-3 px-5 whitespace-nowrap">Full Name</th>
              <th className="py-3 px-5 whitespace-nowrap">Email Address</th>
              <th className="py-3 px-5 whitespace-nowrap">Phone Number</th>
              <th className="py-3 px-5 whitespace-nowrap">Created</th>
              <th className="py-3 px-6 whitespace-nowrap">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-slate text-body-md text-on-surface">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="py-8 px-6 text-center text-on-surface-variant">
                  Loading staff accounts…
                </td>
              </tr>
            ) : pageRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 px-6 text-center text-on-surface-variant">
                  {totalCount === 0
                    ? 'No staff accounts exist yet. Create one to get started.'
                    : 'No accounts match this search.'}
                </td>
              </tr>
            ) : (
              pageRows.map((member) => (
                <tr
                  key={member.username}
                  className="hover:bg-surface-container-low/40 transition-colors"
                >
                  <td className="py-3.5 px-6 whitespace-nowrap text-body-sm font-semibold text-primary">
                    {member.username}
                  </td>
                  <td className="py-3.5 px-5 whitespace-nowrap">
                    <RoleChip role={member.role} />
                  </td>
                  <td className="py-3.5 px-5 whitespace-nowrap font-semibold text-on-surface">
                    {member.fullName}
                  </td>
                  <td className="py-3.5 px-5 whitespace-nowrap text-body-sm text-on-surface-variant">
                    {member.email}
                  </td>
                  <td className="py-3.5 px-5 whitespace-nowrap text-body-sm text-on-surface-variant tabular-nums">
                    {member.phone}
                  </td>
                  <td className="py-3.5 px-5 whitespace-nowrap text-body-sm text-on-surface-variant tabular-nums">
                    {formatDate(member.createdAt)}
                  </td>
                  <td className="py-3.5 px-6 whitespace-nowrap">
                    <StatusChip isActive={member.isActive} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!isLoading && (
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