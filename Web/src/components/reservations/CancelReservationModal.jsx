// File: CancelReservationModal.jsx
// Purpose: GridOperator confirmation for cancelling a reservation through the API.

import { useState } from 'react';
import Modal from '../ui/Modal';
import ReservationStatusBadge from './ReservationStatusBadge';
import { cancelReservation } from '../../services/reservationApi';

function formatScheduledTime(value) {
    if (!value) return 'Unavailable';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unavailable';

    return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    }).format(date);
}

function SummaryItem({ label, children }) {
    return (
        <div className="min-w-0">
            <dt className="text-label-sm font-semibold uppercase tracking-wider text-outline">
                {label}
            </dt>
            <dd className="mt-1 break-words text-body-md font-semibold text-on-surface">
                {children}
            </dd>
        </div>
    );
}

export default function CancelReservationModal({
    reservation,
    onClose,
    onCancelled,
}) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    function handleClose() {
        if (!isSubmitting) onClose();
    }

    async function handleCancel() {
        if (isSubmitting) return;

        setIsSubmitting(true);
        setErrorMessage('');

        let result;
        try {
            result = await cancelReservation(reservation.reservationId);
        } catch (error) {
            setErrorMessage(
                error.response?.data?.message ||
                'Could not cancel the reservation. Please try again.'
            );
            setIsSubmitting(false);
            return;
        }

        onCancelled(result);
    }

    return (
        <Modal
            title="Cancel Reservation"
            onClose={handleClose}
            maxWidthClassName="max-w-xl"
        >
            <div className="space-y-4" aria-busy={isSubmitting}>
                <div className="flex items-start gap-3 border-b border-border-slate pb-4">
                    <span
                        aria-hidden="true"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-error-container text-alert-danger"
                    >
                        <span className="material-symbols-outlined text-[23px]">
                            event_busy
                        </span>
                    </span>
                    <div>
                        <p className="text-title-md font-semibold text-primary">
                            Review this booking
                        </p>
                        <p className="mt-1 text-body-sm leading-relaxed text-on-surface-variant">
                            Review this booking before confirming cancellation.
                        </p>
                    </div>
                </div>

                <section
                    aria-labelledby="cancel-reservation-summary"
                    className="rounded-2xl border border-border-slate bg-canvas-bg/60 p-4"
                >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-slate pb-3">
                        <h3
                            id="cancel-reservation-summary"
                            className="text-title-md font-semibold text-primary"
                        >
                            Reservation Summary
                        </h3>
                        <ReservationStatusBadge status={reservation.status} />
                    </div>

                    <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                        <SummaryItem label="Reservation ID">
                            {reservation.reservationId}
                        </SummaryItem>
                        <SummaryItem label="Prosumer NIC">
                            {reservation.prosumerNic}
                        </SummaryItem>
                        <SummaryItem label="Station">
                            {reservation.stationId}
                        </SummaryItem>
                        <SummaryItem label="Slot">
                            {reservation.slotId}
                        </SummaryItem>
                        <SummaryItem label="Scheduled">
                            {formatScheduledTime(reservation.scheduledTime)}
                        </SummaryItem>
                    </dl>
                </section>

                <section className="rounded-2xl border border-secondary/20 bg-mint-surface/30 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <span
                                aria-hidden="true"
                                className="material-symbols-outlined text-[19px] text-primary"
                            >
                                verified_user
                            </span>
                            <h3 className="text-title-md font-semibold text-primary">
                                12-Hour Cancellation Policy
                            </h3>
                        </div>
                        <span className="rounded-full bg-mint-surface px-2.5 py-1 text-label-sm font-semibold text-primary">
                            API Enforced
                        </span>
                    </div>
                    <p className="mt-3 text-body-sm leading-relaxed text-on-surface-variant">
                        Cancellation requires at least 12 hours&apos; notice before the
                        scheduled reservation. The API validates the reservation state
                        and notice period.
                    </p>
                </section>

                {errorMessage && (
                    <div
                        role="alert"
                        className="flex items-start gap-2 rounded-xl bg-error-container px-space-md py-space-sm text-body-sm text-on-error-container"
                    >
                        <span
                            aria-hidden="true"
                            className="material-symbols-outlined mt-0.5 text-[18px]"
                        >
                            error
                        </span>
                        <span>{errorMessage}</span>
                    </div>
                )}

                <div className="flex flex-col-reverse gap-2 border-t border-border-slate pt-4 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={isSubmitting}
                        className="rounded-full border border-border-slate bg-surface-container-lowest px-5 py-2.5 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        Keep Reservation
                    </button>
                    <button
                        type="button"
                        onClick={handleCancel}
                        disabled={isSubmitting}
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-alert-danger px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-alert-danger/90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <span
                            aria-hidden="true"
                            className="material-symbols-outlined text-[18px]"
                        >
                            event_busy
                        </span>
                        {isSubmitting ? 'Cancelling...' : 'Cancel Reservation'}
                    </button>
                </div>
            </div>
        </Modal>
    );
}