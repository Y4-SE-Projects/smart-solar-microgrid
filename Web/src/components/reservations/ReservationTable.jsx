// File: ReservationTable.jsx
// Purpose: Dense operator reservation rows and distinct live-data states.

import { useEffect, useState } from 'react';
import ReservationStatusBadge from './ReservationStatusBadge';
import ReservationTimeIndicator from './ReservationTimeIndicator';
import RowActionsMenu from './RowActionsMenu';

function validDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(date) {
    return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

function formatClock(date) {
    const hour = date.getHours();
    const period = hour < 12 ? 'a.m.' : 'p.m.';
    const twelveHour = hour % 12 || 12;
    return `${String(twelveHour).padStart(2, '0')}:${String(
        date.getMinutes()
    ).padStart(2, '0')} ${period}`;
}

function TableState({ icon, title, description, error = false, action }) {
    return (
        <tr>
            <td colSpan={7} className="px-6 py-12">
                <div className="mx-auto flex max-w-md flex-col items-center text-center">
                    <div
                        className={`mb-3 flex h-11 w-11 items-center justify-center rounded-full ${error
                                ? 'bg-error-container text-alert-danger'
                                : 'bg-mint-surface text-primary'
                            }`}
                    >
                        <span aria-hidden="true" className="material-symbols-outlined text-[23px]">
                            {icon}
                        </span>
                    </div>
                    <p className={`text-title-md font-semibold ${error ? 'text-alert-danger' : 'text-primary'}`}>
                        {title}
                    </p>
                    <p className="mt-1 text-body-sm leading-relaxed text-on-surface-variant">
                        {description}
                    </p>
                    {action && <div className="mt-4">{action}</div>}
                </div>
            </td>
        </tr>
    );
}

export default function ReservationTable({
    reservations,
    isLoading = false,
    error = '',
    onRetry,
    hasActiveFilters = false,
    onClearFilters,
    onEdit,
    onCancel,
    onApprove,
    onDecline,
}) {
    const [now, setNow] = useState(null);
    const hasRows = Array.isArray(reservations) && reservations.length > 0;

    useEffect(() => {
        if (!hasRows) return undefined;
        const initialTimer = window.setTimeout(() => setNow(Date.now()), 0);
        const interval = window.setInterval(() => setNow(Date.now()), 60000);
        return () => {
            window.clearTimeout(initialTimer);
            window.clearInterval(interval);
        };
    }, [hasRows]);

    return (
        <div className="w-full overflow-x-auto">
            <table
                aria-label="Grid operator reservations"
                aria-busy={isLoading}
                className="min-w-[1080px] w-full border-collapse text-left"
            >
                <thead>
                    <tr className="border-b border-border-slate bg-canvas-bg/80 text-label-sm font-bold uppercase tracking-wider text-outline">
                        <th scope="col" className="whitespace-nowrap px-6 py-3.5">Reservation ID</th>
                        <th scope="col" className="whitespace-nowrap px-6 py-3.5">Prosumer NIC</th>
                        <th scope="col" className="whitespace-nowrap px-6 py-3.5">Assigned Node &amp; Slot</th>
                        <th scope="col" className="whitespace-nowrap px-6 py-3.5">Scheduled</th>
                        <th scope="col" className="whitespace-nowrap px-6 py-3.5">Time to Execution</th>
                        <th scope="col" className="whitespace-nowrap px-6 py-3.5">Status</th>
                        <th scope="col" className="whitespace-nowrap px-6 py-3.5 text-right">Actions</th>
                    </tr>
                </thead>

                <tbody className="divide-y divide-border-slate/70 text-body-md text-on-surface">
                    {isLoading && (
                        <TableState
                            icon="progress_activity"
                            title="Loading reservations"
                            description="Retrieving the latest operator records."
                        />
                    )}

                    {!isLoading && error && (
                        <TableState
                            icon="error"
                            title="Could not load reservations"
                            description={error}
                            error
                            action={onRetry && (
                                <button
                                    type="button"
                                    onClick={onRetry}
                                    className="rounded-full border border-border-slate bg-surface-container-lowest px-4 py-1.5 text-xs font-semibold text-primary hover:bg-surface-container-low"
                                >
                                    Retry
                                </button>
                            )}
                        />
                    )}

                    {!isLoading && !error && reservations === null && (
                        <TableState
                            icon="database"
                            title="Reservation records are not available yet"
                            description="Manual reservations can still be created from this workspace."
                        />
                    )}

                    {!isLoading && !error && Array.isArray(reservations) && reservations.length === 0 && (
                        <TableState
                            icon="event_busy"
                            title="No reservations found"
                            description={
                                hasActiveFilters
                                    ? 'Try another status, search, or filter.'
                                    : 'Reservation records will appear here when available.'
                            }
                            action={hasActiveFilters && onClearFilters && (
                                <button
                                    type="button"
                                    onClick={onClearFilters}
                                    className="rounded-full border border-border-slate bg-surface-container-lowest px-4 py-1.5 text-xs font-semibold text-primary hover:bg-surface-container-low"
                                >
                                    Clear filters
                                </button>
                            )}
                        />
                    )}

                    {!isLoading && !error && hasRows &&
                        reservations.map((reservation) => {
                            const created = validDate(reservation.createdAt);
                            const scheduled = validDate(reservation.scheduledTime);
                            const status = reservation.status?.toLowerCase();
                            // Pending: Approve is the main action; Edit and Decline sit in the row menu.
                            // Approved: Cancel. Declined, Cancelled and Completed rows have no actions.
                            const canShowReview =
                                Boolean(onApprove) && Boolean(onDecline) && status === 'pending';
                            const canShowCancel = Boolean(onCancel) && status === 'approved';
                            const menuItems = [];
                            if (onEdit && status === 'pending') {
                                menuItems.push({
                                    key: 'edit',
                                    label: 'Edit',
                                    icon: 'edit',
                                    onSelect: () => onEdit(reservation),
                                });
                            }
                            if (canShowReview) {
                                menuItems.push({
                                    key: 'decline',
                                    label: 'Decline',
                                    icon: 'cancel',
                                    tone: 'danger',
                                    onSelect: () => onDecline(reservation),
                                });
                            }
                            const hasActions =
                                canShowReview || canShowCancel || menuItems.length > 0;

                            return (
                                <tr
                                    key={reservation.reservationId}
                                    className="transition-colors hover:bg-surface-container-low/60"
                                >
                                    <td className="whitespace-nowrap px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-secondary">
                                                confirmation_number
                                            </span>
                                            <span className="text-body-md font-bold text-primary">
                                                {reservation.reservationId}
                                            </span>
                                        </div>
                                        {created && (
                                            <div className="mt-0.5 text-body-sm text-outline">
                                                Created: {formatDate(created)}, {formatClock(created)}
                                            </div>
                                        )}
                                    </td>

                                    <td className="whitespace-nowrap px-6 py-4">
                                        <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-on-surface">
                                            <span aria-hidden="true" className="material-symbols-outlined text-[15px] text-outline">
                                                badge
                                            </span>
                                            {reservation.prosumerNic}
                                        </div>
                                    </td>

                                    <td className="whitespace-nowrap px-6 py-4">
                                        <div className="flex items-center gap-1.5 text-xs font-semibold text-on-surface">
                                            <span aria-hidden="true" className="material-symbols-outlined text-[15px] text-secondary">
                                                location_on
                                            </span>
                                            {reservation.stationId}
                                        </div>
                                        <div className="mt-1 pl-[21px] text-body-sm text-on-surface-variant">
                                            {reservation.slotId}
                                        </div>
                                    </td>

                                    <td className="whitespace-nowrap px-6 py-4 tabular-nums">
                                        {scheduled ? (
                                            <>
                                                <div className="font-semibold text-on-surface">
                                                    {formatDate(scheduled)}
                                                </div>
                                                <div className="mt-0.5 text-body-sm text-on-surface-variant">
                                                    {formatClock(scheduled)}
                                                </div>
                                            </>
                                        ) : (
                                            <span className="text-outline">—</span>
                                        )}
                                    </td>

                                    <td className="whitespace-nowrap px-6 py-4">
                                        <ReservationTimeIndicator
                                            scheduledTime={reservation.scheduledTime}
                                            status={reservation.status}
                                            now={now}
                                        />
                                    </td>

                                    <td className="whitespace-nowrap px-6 py-4">
                                        <ReservationStatusBadge status={reservation.status} />
                                    </td>

                                    <td className="whitespace-nowrap px-6 py-4 text-right">
                                        {hasActions ? (
                                            <div className="inline-flex items-center gap-2">
                                                {canShowReview && (
                                                    <button
                                                        type="button"
                                                        onClick={() => onApprove(reservation)}
                                                        className="inline-flex items-center gap-1 rounded-full bg-primary-container px-3 py-1.5 text-xs font-semibold text-on-primary shadow-sm hover:bg-primary"
                                                    >
                                                        <span aria-hidden="true" className="material-symbols-outlined text-[15px]">
                                                            check_circle
                                                        </span>
                                                        Approve
                                                    </button>
                                                )}
                                                {menuItems.length > 0 && (
                                                    <RowActionsMenu
                                                        items={menuItems}
                                                        label={`More actions for ${reservation.reservationId}`}
                                                    />
                                                )}
                                                {canShowCancel && (
                                                    <button
                                                        type="button"
                                                        onClick={() => onCancel(reservation)}
                                                        className="inline-flex items-center gap-1 rounded-full border border-border-slate bg-surface-container-lowest px-3 py-1.5 text-xs font-semibold text-alert-danger shadow-sm hover:border-alert-danger/30 hover:bg-error-container"
                                                    >
                                                        <span aria-hidden="true" className="material-symbols-outlined text-[15px]">
                                                            event_busy
                                                        </span>
                                                        Cancel
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-outline">—</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                </tbody>
            </table>
        </div>
    );
}