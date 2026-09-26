/* File: ProsumerDirectory.jsx
 * Purpose: Master directory of every Prosumer account, from GET /api/users/prosumers.
 *          Receives the full list and handles its own searching, filtering and paging internally.
 *          Filtering here is presentation only; the account data and the rules governing it stay with the API.
 *
 *          Props:
 *              prosumers    - every Prosumer account, active and deactivated
 *              isLoading    - true while the lists are being fetched
 *              onReactivate - called with the account whose Reactivate button was clicked
 *
 * Author: IT23218512
 */

import { useState, useMemo, useEffect } from 'react';
import SearchInput from '../common/SearchInput';
import FilterPills from '../common/FilterPills';
import Pagination from '../common/Pagination';
import StatusChip from '../common/StatusChip';
import { formatDate } from '../../utils/formatters';

const ROWS_PER_PAGE = 10;

export default function ProsumerDirectory({ prosumers, isLoading, onReactivate }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  const totalCount = prosumers.length;
  const activeCount = prosumers.filter((prosumer) => prosumer.isActive).length;

  const filteredProsumers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return prosumers.filter((prosumer) => {
      if (statusFilter === 'active' && !prosumer.isActive) return false;
      if (statusFilter === 'deactivated' && prosumer.isActive) return false;
      if (!query) return true;
      return [prosumer.nic, prosumer.fullName, prosumer.email].some((field) =>
        (field ?? '').toLowerCase().includes(query)
      );
    });
  }, [prosumers, searchTerm, statusFilter]);

  // A narrower filter can leave fewer results than the current page covers, which would otherwise render an empty table on a valid page number.
  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredProsumers.length / ROWS_PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filteredProsumers.slice(
    (currentPage - 1) * ROWS_PER_PAGE,
    currentPage * ROWS_PER_PAGE
  );

  return (
    <div className="rounded-2xl bg-surface-container-lowest border border-border-slate shadow-sm flex flex-col overflow-hidden">
      <div className="p-6 border-b border-border-slate flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-headline-sm font-bold text-primary">All Registered Prosumers</h2>
            <p className="text-body-sm text-on-surface-variant">
              Every prosumer account held by the service, active or deactivated.
            </p>
          </div>
          <div className="flex items-center gap-1 text-body-sm text-outline font-medium">
            <span className="material-symbols-outlined text-[16px] text-secondary">database</span>
            <span>Indexed by National Identity Card (NIC)</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search by NIC, full name, or email..."
          />
          <FilterPills
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { key: 'all', label: 'All', count: totalCount },
              { key: 'active', label: 'Active', count: activeCount },
              { key: 'deactivated', label: 'Deactivated', count: totalCount - activeCount },
            ]}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low/30 text-outline text-label-sm font-semibold uppercase border-b border-border-slate">
              <th className="py-3 px-6 whitespace-nowrap">NIC (Primary Key)</th>
              <th className="py-3 px-5 whitespace-nowrap">Full Name</th>
              <th className="py-3 px-5 whitespace-nowrap">Email Address</th>
              <th className="py-3 px-5 whitespace-nowrap">Phone Number</th>
              <th className="py-3 px-5 whitespace-nowrap">Registered</th>
              <th className="py-3 px-5 whitespace-nowrap">Account Status</th>
              <th className="py-3 px-6 text-right whitespace-nowrap">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-slate text-body-md text-on-surface">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="py-8 px-6 text-center text-on-surface-variant">
                  Loading accounts…
                </td>
              </tr>
            ) : pageRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 px-6 text-center text-on-surface-variant">
                  {totalCount === 0
                    ? 'No prosumer accounts have been registered yet.'
                    : 'No accounts match this search.'}
                </td>
              </tr>
            ) : (
              pageRows.map((prosumer) => (
                <tr
                  key={prosumer.nic}
                  className={`hover:bg-surface-container-low/40 transition-colors ${
                    prosumer.isActive ? '' : 'bg-surface-container-low/20'
                  }`}
                >
                  <td
                    className={`py-3.5 px-6 whitespace-nowrap text-body-sm font-semibold tabular-nums ${
                      prosumer.isActive ? 'text-primary' : 'text-alert-danger'
                    }`}
                  >
                    {prosumer.nic}
                  </td>
                  <td className="py-3.5 px-5 whitespace-nowrap font-semibold text-on-surface">
                    {prosumer.fullName}
                  </td>
                  <td className="py-3.5 px-5 whitespace-nowrap text-body-sm text-on-surface-variant">
                    {prosumer.email}
                  </td>
                  <td className="py-3.5 px-5 whitespace-nowrap text-body-sm text-on-surface-variant tabular-nums">
                    {prosumer.phone}
                  </td>
                  <td className="py-3.5 px-5 whitespace-nowrap text-body-sm text-on-surface-variant tabular-nums">
                    {formatDate(prosumer.createdAt)}
                  </td>
                  <td className="py-3.5 px-5 whitespace-nowrap">
                    <StatusChip isActive={prosumer.isActive} />
                  </td>
                  <td className="py-3.5 px-6 text-right whitespace-nowrap">
                    {/* Reactivation is the only write action Backoffice holds over a prosumer account, so active rows have none. */}
                    {prosumer.isActive ? (
                      <span className="text-body-sm text-outline">—</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onReactivate(prosumer)}
                        className="px-3 py-1.5 rounded-full bg-mint-surface text-primary text-body-sm font-semibold hover:bg-secondary-container transition-colors"
                      >
                        Reactivate
                      </button>
                    )}
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
          totalItems={filteredProsumers.length}
          pageSize={ROWS_PER_PAGE}
          itemLabel="accounts"
          onPageChange={setPage}
        />
      )}
    </div>
  );
}