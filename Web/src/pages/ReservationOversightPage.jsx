// File: ReservationOversightPage.jsx
// Purpose: GridOperator reservation workspace and future live-list coordinator.

import { useCallback, useEffect, useState } from 'react';
import { fetchReservations } from '../services/reservationApi';
import ManualReservationModal from '../components/reservations/ManualReservationModal';
import ReservationPolicyBanner from '../components/reservations/ReservationPolicyBanner';
import ReservationToolbar from '../components/reservations/ReservationToolbar';
import ReservationFilterPanel from '../components/reservations/ReservationFilterPanel';
import ReservationTable from '../components/reservations/ReservationTable';
import ReservationPagination from '../components/reservations/ReservationPagination';
import EditReservationModal from '../components/reservations/EditReservationModal';
import CancelReservationModal from '../components/reservations/CancelReservationModal';
import ReviewReservationModal from '../components/reservations/ReviewReservationModal';

const INITIAL_FILTERS = {
    status: 'All',
    searchText: '',
    stationId: '',
    dateFrom: '',
    dateTo: '',
    page: 1,
    pageSize: 25,
};

export default function ReservationOversightPage() {
    const [filters, setFilters] = useState(INITIAL_FILTERS);
    const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    const [selectedReservation, setSelectedReservation] = useState(null);
    const [selectedReservationForCancel, setSelectedReservationForCancel] = useState(null);
    const [reviewTarget, setReviewTarget] = useState(null); // { reservation, action: 'Approved' | 'Declined' }
    const [actionResult, setActionResult] = useState(null);

    const [listState, setListState] = useState({
        reservations: null,
        totalCount: null,
        isLoading: true,
        error: '',
    });
    const [reloadKey, setReloadKey] = useState(0);
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Waits for the operator to stop typing before the search reaches the server.
    useEffect(() => {
        const timer = window.setTimeout(
            () => setDebouncedSearch(filters.searchText.trim()),
            300
        );
        return () => window.clearTimeout(timer);
    }, [filters.searchText]);

    // Loads the current page from the server whenever a filter, the page, or reloadKey changes.
    useEffect(() => {
        let cancelled = false;

        fetchReservations({
            page: filters.page,
            pageSize: filters.pageSize,
            status: filters.status,
            search: debouncedSearch,
            stationId: filters.stationId,
            dateFrom: filters.dateFrom,
            dateTo: filters.dateTo,
        })
            .then((result) => {
                if (cancelled) return;

                // The last page can disappear (e.g. after a cancel); step back to the new last page.
                const lastPage = Math.max(1, Math.ceil(result.totalCount / filters.pageSize));
                if (result.items.length === 0 && filters.page > lastPage) {
                    setFilters((current) => ({ ...current, page: lastPage }));
                    return;
                }

                setListState({
                    reservations: result.items,
                    totalCount: result.totalCount,
                    isLoading: false,
                    error: '',
                });
            })
            .catch((error) => {
                if (cancelled) return;
                setListState({
                    reservations: null,
                    totalCount: null,
                    isLoading: false,
                    error:
                        error.response?.data?.message ||
                        'Could not load reservations. Please try again.',
                });
            });

        return () => {
            cancelled = true;
        };
    }, [
        filters.page,
        filters.pageSize,
        filters.status,
        filters.stationId,
        filters.dateFrom,
        filters.dateTo,
        debouncedSearch,
        reloadKey,
    ]);

    // Shows the loading state and reloads the current page ( used by Refresh, Retry, and after create/edit/cancel ).
    const refreshReservations = useCallback(() => {
        setListState((current) => ({ ...current, isLoading: true, error: '' }));
        setReloadKey((value) => value + 1);
    }, []);

    const hasAdvancedFilters = Boolean(
        filters.stationId || filters.dateFrom || filters.dateTo
    );
    const hasActiveFilters = Boolean(
        filters.status !== 'All' ||
        filters.searchText.trim() ||
        hasAdvancedFilters
    );

    function handleCreated(result) {
        setActionResult(result);
        setIsManualModalOpen(false);
        refreshReservations?.();
    }

    function handleUpdated(result) {
        setActionResult(result);
        setSelectedReservation(null);
        refreshReservations?.();
    }

    function handleCancelled(result) {
        setActionResult(result);
        setSelectedReservationForCancel(null);
        refreshReservations?.();
    }

    function handleReviewed(result) {
        setActionResult(result);
        setReviewTarget(null);
        refreshReservations?.();
    }

    function clearAllFilters() {
        setFilters(INITIAL_FILTERS);
    }

    return (
        <div className="flex flex-col">
            <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                    <h1 className="text-headline-lg font-bold tracking-tight text-primary">
                        Reservation Oversight
                    </h1>
                    <p className="mt-1 text-body-md text-on-surface-variant">
                        Monitor and manage power-trading reservations for Grid Operators.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => {
                        setActionResult(null);
                        setIsManualModalOpen(true);
                    }}
                    className="flex shrink-0 items-center gap-2 self-start rounded-full bg-primary-container px-5 py-2.5 text-xs font-semibold text-on-primary shadow-sm transition-all hover:bg-primary md:self-auto"
                >
                    <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
                        add_circle
                    </span>
                    Manual Reservation
                </button>
            </div>

            <div className="mb-6">
                <ReservationPolicyBanner />
            </div>

            {actionResult && (
                <div
                    role="status"
                    className="mb-6 rounded-2xl border border-border-slate bg-mint-surface px-5 py-3 text-body-sm text-primary"
                >
                    <p className="font-semibold">{actionResult.message}</p>
                    {actionResult.data?.reservationId && (
                        <p className="mt-1">
                            Reservation {actionResult.data.reservationId} at station{' '}
                            {actionResult.data.stationId}, slot {actionResult.data.slotId}.
                        </p>
                    )}
                </div>
            )}

            <section
                aria-label="Reservation records"
                className="rounded-2xl border border-border-slate bg-surface-container-lowest shadow-sm"
            >
                <ReservationToolbar
                    status={filters.status}
                    searchText={filters.searchText}
                    onStatusChange={(status) =>
                        setFilters((current) => ({ ...current, status, page: 1 }))
                    }
                    onSearchChange={(searchText) =>
                        setFilters((current) => ({ ...current, searchText, page: 1 }))
                    }
                    filtersOpen={isFilterPanelOpen}
                    hasAdvancedFilters={hasAdvancedFilters}
                    onToggleFilters={() => setIsFilterPanelOpen((current) => !current)}
                    onRefresh={refreshReservations}
                    isLoading={listState.isLoading}
                />

                {isFilterPanelOpen && (
                    <ReservationFilterPanel
                        stationId={filters.stationId}
                        dateFrom={filters.dateFrom}
                        dateTo={filters.dateTo}
                        onApply={(advanced) => {
                            setFilters((current) => ({ ...current, ...advanced, page: 1 }));
                            setIsFilterPanelOpen(false);
                        }}
                        onClear={() =>
                            setFilters((current) => ({
                                ...current,
                                stationId: '',
                                dateFrom: '',
                                dateTo: '',
                                page: 1,
                            }))
                        }
                    />
                )}

                <ReservationTable
                    reservations={listState.reservations}
                    onEdit={(reservation) => {
                        setActionResult(null);
                        setSelectedReservation(reservation);
                    }}
                    onCancel={(reservation) => {
                        setActionResult(null);
                        setSelectedReservationForCancel(reservation);
                    }}
                    onApprove={(reservation) => {
                        setActionResult(null);
                        setReviewTarget({ reservation, action: 'Approved' });
                    }}
                    onDecline={(reservation) => {
                        setActionResult(null);
                        setReviewTarget({ reservation, action: 'Declined' });
                    }}
                    isLoading={listState.isLoading}
                    error={listState.error}
                    onRetry={refreshReservations}
                    hasActiveFilters={hasActiveFilters}
                    onClearFilters={clearAllFilters}
                />

                <ReservationPagination
                    page={filters.page}
                    pageSize={filters.pageSize}
                    totalCount={listState.totalCount}
                    onPageChange={(page) =>
                        setFilters((current) => ({ ...current, page }))
                    }
                    onPageSizeChange={(pageSize) =>
                        setFilters((current) => ({ ...current, pageSize, page: 1 }))
                    }
                    isLoading={listState.isLoading}
                />
            </section>

            {isManualModalOpen && (
                <ManualReservationModal
                    onClose={() => setIsManualModalOpen(false)}
                    onCreated={handleCreated}
                />
            )}

            {selectedReservation && (
                <EditReservationModal
                    key={selectedReservation.reservationId}
                    reservation={selectedReservation}
                    onClose={() => setSelectedReservation(null)}
                    onUpdated={handleUpdated}
                />
            )}

            {reviewTarget && (
                <ReviewReservationModal
                    key={`${reviewTarget.reservation.reservationId}-${reviewTarget.action}`}
                    reservation={reviewTarget.reservation}
                    action={reviewTarget.action}
                    onClose={() => setReviewTarget(null)}
                    onCompleted={handleReviewed}
                />
            )}

            {selectedReservationForCancel && (
                <CancelReservationModal
                    key={selectedReservationForCancel.reservationId}
                    reservation={selectedReservationForCancel}
                    onClose={() => setSelectedReservationForCancel(null)}
                    onCancelled={handleCancelled}
                />
            )}
        </div>
    );
}