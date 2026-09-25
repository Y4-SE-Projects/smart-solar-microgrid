// File: ReservationOversightPage.jsx
// Purpose: GridOperator reservation workspace and future live-list coordinator.

import { useState } from 'react';
import ManualReservationModal from '../components/reservations/ManualReservationModal';
import ReservationPolicyBanner from '../components/reservations/ReservationPolicyBanner';
import ReservationToolbar from '../components/reservations/ReservationToolbar';
import ReservationFilterPanel from '../components/reservations/ReservationFilterPanel';
import ReservationTable from '../components/reservations/ReservationTable';
import ReservationPagination from '../components/reservations/ReservationPagination';
import EditReservationModal from '../components/reservations/EditReservationModal';
import CancelReservationModal from '../components/reservations/CancelReservationModal';

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
    const [actionResult, setActionResult] = useState(null);

    const [listState] = useState({
        reservations: null,
        totalCount: null,
        isLoading: false,
        error: '',
    });

    // MEMBER 04 INTEGRATION: replace this boundary with a loader that maps
    // filters to the final operator list/search contract and updates listState.
    // Use the same reload after create, edit, and cancel.
    const refreshReservations = null;

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