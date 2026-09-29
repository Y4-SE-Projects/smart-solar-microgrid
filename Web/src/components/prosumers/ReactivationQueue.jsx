/* File: ReactivationQueue.jsx
 * Purpose: The priority queue at the top of Prosumer Management, listing the deactivated accounts
 *          that have asked to be restored, from GET /api/users/reactivation-requests.
 *          Not every deactivated account appears here — only those whose owner requested reactivation.
 *          Owns how many rows are revealed. Three rows show by default and the footer buttons grow the list.
 *
 *          Props:
 *              pending      - the accounts awaiting a Backoffice decision
 *              isLoading    - true while the lists are being fetched
 *              onReactivate - called with the account whose Reactivate button was clicked
 *              onReject     - called with the account whose Decline button was clicked
 *
 * Author: IT23218512
 */

import { useState } from 'react';
import { getInitials, formatDate, pluralize } from '../../utils/formatters';

const QUEUE_PAGE_SIZE = 3;

export default function ReactivationQueue({ pending, isLoading, loadError, onReactivate, onReject }) {
  const [visibleCount, setVisibleCount] = useState(QUEUE_PAGE_SIZE);

  const pendingCount = pending.length;
  const visibleRows = pending.slice(0, visibleCount);
  const hasMoreRows = visibleCount < pendingCount;

  return (
    <div className="overflow-hidden rounded-2xl border border-border-slate bg-surface-container-lowest shadow-sm">
      <div className="flex items-center gap-3 border-b border-border-slate p-5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary-container text-primary-container">
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">pending_actions</span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-headline-sm font-bold text-primary">
              Reactivation requests
            </h2>
            {pendingCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-error-container text-alert-danger text-label-sm font-bold tabular-nums">
                {pendingCount}
              </span>
            )}
          </div>
          <p className="text-body-sm text-on-surface-variant">
            Accounts waiting for your review.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-body-md text-on-surface-variant">Loading accounts…</div>
      ) : loadError ? (
        <div className="p-8 text-center text-body-md text-on-surface-variant">Could not load requests. Use Retry above.</div>
      ) : pendingCount === 0 ? (
        <div className="p-8 flex flex-col items-center gap-2 text-center">
          <span className="material-symbols-outlined text-[28px] text-secondary">task_alt</span>
          <span className="text-body-md text-on-surface-variant">
            No accounts are awaiting reactivation.
          </span>
        </div>
      ) : (
        <>
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border-slate bg-canvas-bg font-semibold uppercase tracking-wider text-outline">
                  <th className="whitespace-nowrap px-5 py-4">Prosumer</th>
                  <th className="whitespace-nowrap px-5 py-4">Contact</th>
                  <th className="whitespace-nowrap px-5 py-4">Deactivated</th>
                  <th className="whitespace-nowrap px-5 py-4">Requested</th>
                  <th className="px-5 py-4">Reason</th>
                  <th className="whitespace-nowrap px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-slate">
                {visibleRows.map((prosumer) => (
                  <tr key={prosumer.nic} className="transition-colors hover:bg-surface-container-low">
                    <td className="whitespace-nowrap px-5 py-4">
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
                    <td className="whitespace-nowrap px-5 py-4">
                      <div className="flex flex-col">
                        <span className="text-body-sm text-on-surface">{prosumer.email}</span>
                        <span className="text-body-sm text-outline tabular-nums">{prosumer.phone}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <span className="text-body-sm text-on-surface tabular-nums">
                        {formatDate(prosumer.deactivatedAt)}
                      </span>
                    </td>
                    {/* How long the request has been waiting is what orders this queue, so it gets the day count rather than the deactivation date. */}
                    <td className="whitespace-nowrap px-5 py-4">
                      <span className="text-body-sm text-on-surface tabular-nums">
                        {formatDate(prosumer.reactivationRequestedAt)}
                      </span>
                      {prosumer.daysSinceRequest !== null &&
                        prosumer.daysSinceRequest !== undefined && (
                          <span className="block text-label-sm text-alert-danger font-semibold tabular-nums">
                            {pluralize(prosumer.daysSinceRequest, 'day')} waiting
                          </span>
                        )}
                    </td>
                    <td className="px-5 py-4">
                      {/* The reason is optional on the deactivation request, so many rows legitimately have none. */}
                      {prosumer.deactivationReason ? (
                        <span className="inline-block px-3 py-1.5 rounded-full bg-surface-container-low text-body-sm text-on-surface-variant font-medium">
                          {prosumer.deactivationReason}
                        </span>
                      ) : (
                        <span className="text-body-sm text-outline italic">No reason given</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onReject(prosumer)}
                          className="px-4 py-2 rounded-full border border-border-slate bg-surface-container-lowest text-on-surface-variant hover:bg-error-container hover:text-alert-danger hover:border-transparent text-body-sm font-semibold transition-colors"
                        >
                          Decline
                        </button>
                        <button
                          type="button"
                          onClick={() => onReactivate(prosumer)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-on-primary hover:bg-primary-container text-body-sm font-semibold shadow-sm transition-colors"
                        >
                          <span className="material-symbols-outlined text-[15px]">check_circle</span>
                          <span>Approve</span>
                        </button>
                      </div>
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
