// File: ReservationPagination.jsx
// Purpose: Rows-per-page and server-backed pagination presentation.

import Dropdown from '../ui/Dropdown';

const PAGE_SIZES = [10, 25, 50].map((size) => ({
    value: size,
    label: String(size),
}));

function visiblePages(currentPage, totalPages) {
    const candidates = new Set(
        [
            1,
            2,
            currentPage - 1,
            currentPage,
            currentPage + 1,
            currentPage + 2,
            totalPages,
        ].filter((number) => number >= 1 && number <= totalPages),
    );
    const sorted = [...candidates].sort((a, b) => a - b);
    const result = [];

    sorted.forEach((number, index) => {
        if (index > 0) {
            const previous = sorted[index - 1];
            const gap = number - previous;
            if (gap === 2) result.push(previous + 1);
            if (gap > 2) result.push(`gap-${number}`);
        }
        result.push(number);
    });

    return result;
}

export default function ReservationPagination({
    page,
    pageSize,
    totalCount,
    onPageChange,
    onPageSizeChange,
    isLoading = false,
}) {
    const hasTotal = Number.isInteger(totalCount) && totalCount >= 0;
    const totalPages = hasTotal ? Math.ceil(totalCount / pageSize) : 0;
    const currentPage =
        totalPages > 0 ? Math.min(Math.max(page, 1), totalPages) : 1;
    const start = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const end = hasTotal ? Math.min(currentPage * pageSize, totalCount) : 0;
    const canGoBack = hasTotal && currentPage > 1 && !isLoading;
    const canGoForward = hasTotal && currentPage < totalPages && !isLoading;

    return (
        <div className="relative z-20 flex flex-col gap-4 rounded-b-2xl border-t border-border-slate bg-canvas-bg/70 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
                <label
                    htmlFor="reservation-page-size"
                    className="text-body-sm text-on-surface-variant"
                >
                    Rows per page:
                </label>
                <div className="w-24">
                    <Dropdown
                        id="reservation-page-size"
                        label="Rows per page"
                        value={pageSize}
                        options={PAGE_SIZES}
                        onChange={onPageSizeChange}
                        disabled={isLoading}
                    />
                </div>
                <span className="text-body-sm tabular-nums text-on-surface-variant">
                    {hasTotal
                        ? `${start}–${end} of ${totalCount} records`
                        : "Record total unavailable"}
                </span>
            </div>

            <nav aria-label="Reservation pages" className="flex items-center gap-1.5">
                <button
                    type="button"
                    aria-label="Previous page"
                    disabled={!canGoBack}
                    onClick={() => onPageChange(currentPage - 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-border-slate bg-surface-container-lowest text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-40"
                >
                    <span
                        aria-hidden="true"
                        className="material-symbols-outlined text-[18px]"
                    >
                        chevron_left
                    </span>
                </button>

                {hasTotal && totalPages > 0 ? (
                    visiblePages(currentPage, totalPages).map((item) =>
                        typeof item === "string" ? (
                            <span
                                key={item}
                                className="px-1 text-xs text-outline"
                                aria-hidden="true"
                            >
                                …
                            </span>
                        ) : (
                            <button
                                key={item}
                                type="button"
                                aria-label={`Page ${item}`}
                                aria-current={item === currentPage ? "page" : undefined}
                                disabled={isLoading}
                                onClick={() => onPageChange(item)}
                                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors disabled:opacity-50 ${item === currentPage
                                        ? "bg-primary-container text-on-primary shadow-sm"
                                        : "border border-border-slate bg-surface-container-lowest text-on-surface hover:bg-surface-container-high"
                                    }`}
                            >
                                {item}
                            </button>
                        ),
                    )
                ) : (
                    <span className="px-2 text-body-sm text-outline">—</span>
                )}

                <button
                    type="button"
                    aria-label="Next page"
                    disabled={!canGoForward}
                    onClick={() => onPageChange(currentPage + 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-border-slate bg-surface-container-lowest text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-40"
                >
                    <span
                        aria-hidden="true"
                        className="material-symbols-outlined text-[18px]"
                    >
                        chevron_right
                    </span>
                </button>
            </nav>
        </div>
    );
}
