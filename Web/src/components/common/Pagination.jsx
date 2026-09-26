/* File: Pagination.jsx
 * Purpose: Table footer showing the visible range and the page controls.
 *          Pagination is done in the browser over rows already fetched.
 *          
 *          Props:
 *              page, pageCount - current page (1-based) and total pages
 *              totalItems      - number of rows across all pages, after filtering
 *              pageSize        - rows per page, used to describe the visible range
 *              itemLabel       - noun used in the range text (default "items")
 *              onPageChange    - called with the requested page number
 * 
 * Author: IT23218512
 */

export default function Pagination({
  page,
  pageCount,
  totalItems,
  pageSize,
  itemLabel = 'items',
  onPageChange,
}) {
  if (totalItems === 0) return null;

  const firstRow = (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, totalItems);

  return (
    <div className="p-4 bg-surface-container-low/40 border-t border-border-slate flex flex-col sm:flex-row items-center justify-between gap-4 mt-auto">
      <span className="text-body-sm text-on-surface-variant tabular-nums">
        Showing {firstRow}–{lastRow} of {totalItems} {itemLabel}
      </span>

      {pageCount > 1 && (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Previous page"
            disabled={page === 1}
            onClick={() => onPageChange(page - 1)}
            className="w-8 h-8 rounded-full bg-surface-container-lowest border border-border-slate text-on-surface hover:bg-surface-container disabled:bg-surface-container-low disabled:text-outline disabled:cursor-not-allowed flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          </button>

          <div className="flex items-center gap-1 px-1">
            {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                onClick={() => onPageChange(pageNumber)}
                className={`w-8 h-8 rounded-full text-body-sm tabular-nums transition-colors ${
                  pageNumber === page
                    ? 'bg-primary text-on-primary font-bold shadow-sm'
                    : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container font-medium'
                }`}
              >
                {pageNumber}
              </button>
            ))}
          </div>

          <button
            type="button"
            aria-label="Next page"
            disabled={page === pageCount}
            onClick={() => onPageChange(page + 1)}
            className="w-8 h-8 rounded-full bg-surface-container-lowest border border-border-slate text-on-surface hover:bg-surface-container disabled:bg-surface-container-low disabled:text-outline disabled:cursor-not-allowed flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
        </div>
      )}
    </div>
  );
}