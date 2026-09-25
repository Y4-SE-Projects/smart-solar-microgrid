// File: ReservationToolbar.jsx
// Purpose: Operator reservation status, search, filter, and refresh controls.

const STATUSES = ['All', 'Pending', 'Approved', 'Cancelled', 'Completed'];

export default function ReservationToolbar({
    status,
    searchText,
    onStatusChange,
    onSearchChange,
    filtersOpen,
    hasAdvancedFilters,
    onToggleFilters,
    onRefresh,
    isLoading = false,
}) {
    return (
        <div className="flex flex-col gap-4 border-b border-border-slate bg-canvas-bg/30 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2" aria-label="Reservation status">
                {STATUSES.map((item) => {
                    const selected = status === item;

                    return (
                        <button
                            key={item}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => onStatusChange(item)}
                            className={`rounded-full px-3.5 py-1.5 text-xs transition-colors ${selected
                                    ? 'bg-primary text-on-primary font-semibold shadow-sm'
                                    : 'border border-border-slate bg-surface-container-lowest text-on-surface-variant font-medium hover:bg-surface-container-low hover:text-on-surface'
                                }`}
                        >
                            {item}
                        </button>
                    );
                })}
            </div>

            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
                <div className="relative min-w-0 flex-1 sm:min-w-[220px] lg:w-64">
                    <label htmlFor="reservation-search" className="sr-only">
                        Search reservations
                    </label>
                    <span
                        aria-hidden="true"
                        className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-outline"
                    >
                        search
                    </span>
                    <input
                        id="reservation-search"
                        type="search"
                        value={searchText}
                        onChange={(event) => onSearchChange(event.target.value)}
                        placeholder="Search reservation ID, NIC, station..."
                        className="h-9 w-full rounded-full border border-border-slate bg-surface-container-lowest pl-9 pr-3 text-xs text-on-surface placeholder:text-outline focus:border-secondary focus:outline-none focus:ring-1 focus:ring-secondary"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        aria-expanded={filtersOpen}
                        aria-controls="reservation-filter-panel"
                        onClick={onToggleFilters}
                        className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors ${filtersOpen || hasAdvancedFilters
                                ? 'border-primary-container bg-mint-surface text-primary'
                                : 'border-border-slate bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low'
                            }`}
                    >
                        <span aria-hidden="true" className="material-symbols-outlined text-[16px]">
                            tune
                        </span>
                        Filters
                        {hasAdvancedFilters && (
                            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-secondary" />
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={!onRefresh || isLoading}
                        aria-label="Refresh reservations"
                        title={onRefresh ? 'Refresh reservations' : 'Refresh available when records load'}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-border-slate bg-surface-container-lowest text-outline transition-colors hover:bg-surface-container-low hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <span aria-hidden="true" className="material-symbols-outlined text-[17px]">
                            refresh
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
}