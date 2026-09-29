/* File: ProsumerDirectory.jsx
 * Purpose: Master directory of every Prosumer account, from GET /api/users/prosumers.
 *          Receives the full list and handles its own searching, filtering and paging internally.
 *          Filtering here is presentation only; the account data and the rules governing it stay with the API.
 *
 *          Props:
 *              prosumers    - every Prosumer account, whatever its state
 *              isLoading    - true while the lists are being fetched
 *              onReactivate - called with the account whose Reactivate button was clicked
 *
 * Author: IT23218512
 */

import { useState, useMemo } from 'react';
import SearchInput from '../common/SearchInput';
import FilterPills from '../common/FilterPills';
import Pagination from '../common/Pagination';
import StatusChip from '../common/StatusChip';
import { AccountStatus, resolveAccountStatus } from '../../constants/accountStatus';
import { formatDate } from '../../utils/formatters';

const ROWS_PER_PAGE = 10;

export default function ProsumerDirectory({ prosumers, isLoading, loadError, onReactivate }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  // Resolve each account's status once; so the counts, the filter and the row chip all read the same value rather than each deriving it separately.
  const rows = useMemo(
    () => prosumers.map((prosumer) => ({ ...prosumer, resolvedStatus: resolveAccountStatus(prosumer) })),
    [prosumers]
  );

  const totalCount = rows.length;
  const activeCount = rows.filter((row) => row.resolvedStatus === AccountStatus.Active).length;
  const pendingCount = rows.filter(
    (row) => row.resolvedStatus === AccountStatus.PendingReactivation
  ).length;
  const deactivatedCount = rows.filter(
    (row) => row.resolvedStatus === AccountStatus.Deactivated
  ).length;

  const filteredProsumers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== 'all' && row.resolvedStatus !== statusFilter) return false;
      if (!query) return true;
      return [row.nic, row.fullName, row.email].some((field) =>
        (field ?? '').toLowerCase().includes(query)
      );
    });
  }, [rows, searchTerm, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredProsumers.length / ROWS_PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filteredProsumers.slice(
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
            placeholder="Search by NIC, name, or email"
          />
        </div>
        <div className="max-w-full self-start xl:self-auto">
          <FilterPills
            value={statusFilter}
            onChange={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}
            options={[
              { key: 'all', label: 'All', count: totalCount },
              { key: AccountStatus.Active, label: 'Active', count: activeCount },
              { key: AccountStatus.PendingReactivation, label: 'In Queue', count: pendingCount },
              { key: AccountStatus.Deactivated, label: 'Deactivated', count: deactivatedCount },
            ]}
          />
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border-slate bg-canvas-bg font-semibold uppercase tracking-wider text-outline">
              <th className="whitespace-nowrap px-5 py-4">NIC</th>
              <th className="whitespace-nowrap px-5 py-4">Name</th>
              <th className="whitespace-nowrap px-5 py-4">Contact</th>
              <th className="whitespace-nowrap px-5 py-4">Registered</th>
              <th className="whitespace-nowrap px-5 py-4">Status</th>
              <th className="whitespace-nowrap px-5 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-slate">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-on-surface-variant">
                  Loading accounts…
                </td>
              </tr>
            ) : loadError ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-on-surface-variant">
                  Could not load prosumer accounts. Use Retry above.
                </td>
              </tr>
            ) : pageRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-on-surface-variant">
                  {totalCount === 0
                    ? 'No prosumer accounts yet.'
                    : 'No prosumer accounts match your search or filter.'}
                </td>
              </tr>
            ) : (
              pageRows.map((prosumer) => {
                const isActive = prosumer.resolvedStatus === AccountStatus.Active;

                return (
                  <tr
                    key={prosumer.nic}
                    className="transition-colors hover:bg-surface-container-low"
                  >
                    <td className="whitespace-nowrap px-5 py-4 font-semibold tabular-nums text-on-surface">
                      <span className="rounded-full bg-surface-container-high px-3 py-1 text-[11px]">{prosumer.nic}</span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-on-surface">
                      {prosumer.fullName}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <span className="block text-on-surface-variant">{prosumer.email}</span>
                      <span className="block text-outline tabular-nums">{prosumer.phone}</span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-on-surface-variant tabular-nums">
                      {formatDate(prosumer.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <StatusChip status={prosumer.resolvedStatus} />
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right">
                      {/* Reactivation is the only write action Backoffice holds over a prosumer account, so active rows have none. 
                          Declining a request is deliberately not offered here That belongs to the queue, where requests are worked. */}
                      {isActive ? (
                        <span className="text-outline">—</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onReactivate(prosumer)}
                          className="rounded-full bg-mint-surface px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-secondary-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
                        >
                          Reactivate
                        </button>
                      )}
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
          totalItems={filteredProsumers.length}
          pageSize={ROWS_PER_PAGE}
          itemLabel="accounts"
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
