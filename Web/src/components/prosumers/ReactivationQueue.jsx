/* File: ReactivationQueue.jsx
 * Purpose: The priority queue at the top of Prosumer Management with every deactivated account 
 *          awaiting Backoffice action, from GET /api/users/pending-deactivation.
 *          Owns how many rows are revealed. Three rows show by default and the footer buttons grow the list.
 *
 *          Props:
 *              pending      - the deactivated accounts
 *              isLoading    - true while the lists are being fetched
 *              onReactivate - called with the account whose Reactivate button was clicked
 * 
 * Author: IT23218512
 */

import { useState, useEffect } from 'react';
import { getInitials, formatDate, pluralize } from '../../utils/formatters';

const QUEUE_PAGE_SIZE = 3;

export default function ReactivationQueue({ pending, isLoading, onReactivate }) {
  const [visibleCount, setVisibleCount] = useState(QUEUE_PAGE_SIZE);

  // Collapse back to the default whenever the queue itself changes.
  // After a reactivation the list is shorter, and an expanded count left over from the previous render would no longer mean anything.
  useEffect(() => {
    setVisibleCount(QUEUE_PAGE_SIZE);
  }, [pending]);

  const pendingCount = pending.length;
  const visibleRows = pending.slice(0, visibleCount);
  const hasMoreRows = visibleCount < pendingCount;

  return (
    <div className="rounded-2xl bg-surface-container-lowest border border-border-slate shadow-sm overflow-hidden">
      <div className="p-5 bg-surface-container-low/50 border-b border-border-slate flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[18px]">notification_important</span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-headline-sm font-bold text-primary">
              Pending Account Reactivation Requests
            </h2>
            {pendingCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-error-container text-alert-danger text-label-sm font-bold tabular-nums">
                {pendingCount}
              </span>
            )}
          </div>
          <p className="text-body-sm text-on-surface-variant">
            Deactivated accounts awaiting Backoffice review.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-body-md text-on-surface-variant">Loading accounts…</div>
      ) : pendingCount === 0 ? (
        <div className="p-8 flex flex-col items-center gap-2 text-center">
          <span className="material-symbols-outlined text-[28px] text-secondary">task_alt</span>
          <span className="text-body-md text-on-surface-variant">
            No accounts are awaiting reactivation.
          </span>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low/30 text-outline text-label-sm font-semibold uppercase border-b border-border-slate">
                  <th className="py-3 px-6 whitespace-nowrap">Prosumer (NIC &amp; Name)</th>
                  <th className="py-3 px-5 whitespace-nowrap">Contact</th>
                  <th className="py-3 px-5 whitespace-nowrap">Deactivated</th>
                  <th className="py-3 px-5">Declared Reason</th>
                  <th className="py-3 px-6 text-right whitespace-nowrap">Backoffice Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-slate text-body-md text-on-surface">
                {visibleRows.map((prosumer) => (
                  <tr key={prosumer.nic} className="hover:bg-surface-container-low/40 transition-colors">
                    <td className="py-4 px-6 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-mint-surface text-primary font-bold text-body-sm flex items-center justify-center shrink-0">
                          {getInitials(prosumer.fullName)}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-on-surface">{prosumer.fullName}</span>
                          <span className="text-body-sm text-secondary tabular-nums">
                            NIC: {prosumer.nic}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-5 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-body-sm text-on-surface">{prosumer.email}</span>
                        <span className="text-body-sm text-outline tabular-nums">{prosumer.phone}</span>
                      </div>
                    </td>
                    <td className="py-4 px-5 whitespace-nowrap">
                      <span className="text-body-sm text-on-surface tabular-nums">
                        {formatDate(prosumer.deactivatedAt)}
                      </span>
                      {prosumer.daysElapsed !== null && prosumer.daysElapsed !== undefined && (
                        <span className="block text-label-sm text-outline tabular-nums">
                          {pluralize(prosumer.daysElapsed, 'day')} elapsed
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-5">
                      {/* The reason is optional on the deactivation request, so many rows legitimately have none. */}
                      {prosumer.deactivationReason ? (
                        <span className="inline-block px-3 py-1.5 rounded-full bg-surface-container-low text-body-sm text-on-surface-variant font-medium">
                          {prosumer.deactivationReason}
                        </span>
                      ) : (
                        <span className="text-body-sm text-outline italic">No reason given</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onReactivate(prosumer)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-on-primary hover:bg-primary-container text-body-sm font-semibold shadow-sm transition-colors"
                      >
                        <span className="material-symbols-outlined text-[15px]">check_circle</span>
                        <span>Reactivate</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-surface-container-lowest border-t border-border-slate flex items-center justify-between gap-4 text-body-sm text-on-surface-variant">
            <span className="tabular-nums">
              Showing {visibleRows.length} of {pluralize(pendingCount, 'request')}
            </span>
            {hasMoreRows && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setVisibleCount((count) => count + QUEUE_PAGE_SIZE)}
                  className="px-4 py-2 rounded-full border border-border-slate bg-surface-container-lowest text-on-surface hover:bg-surface-container-low text-body-sm font-semibold transition-colors"
                >
                  Show {Math.min(QUEUE_PAGE_SIZE, pendingCount - visibleCount)} more
                </button>
                <button
                  type="button"
                  onClick={() => setVisibleCount(pendingCount)}
                  className="inline-flex items-center gap-1 px-4 py-2 rounded-full text-secondary hover:text-primary text-body-sm font-semibold transition-colors"
                >
                  <span>Show all ({pendingCount})</span>
                  <span className="material-symbols-outlined text-[16px]">expand_more</span>
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}