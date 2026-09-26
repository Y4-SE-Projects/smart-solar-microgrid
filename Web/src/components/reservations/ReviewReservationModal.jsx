// File: ReviewReservationModal.jsx
// Purpose: GridOperator confirmation for approving or declining a pending reservation through the API.

import { useState } from 'react';
import Modal from '../ui/Modal';
import ReservationStatusBadge from './ReservationStatusBadge';
import { updateReservationStatus } from '../../services/reservationApi';

const ACTIONS = {
    Approved: {
        title: 'Approve Reservation',
        icon: 'check_circle',
        intro: 'Approving issues the prosumer a QR code for this booking.',
        confirmLabel: 'Approve Reservation',
        busyLabel: 'Approving...',
        errorFallback: 'Could not approve the reservation. Please try again.',
        iconClasses: 'bg-mint-surface text-primary',
        confirmClasses: 'bg-primary-container hover:bg-primary',
    },
    Declined: {
        title: 'Decline Reservation',
        icon: 'cancel',
        intro: 'Declining frees the slot so another prosumer can book it. This cannot be undone.',
        confirmLabel: 'Decline Reservation',
        busyLabel: 'Declining...',
        errorFallback: 'Could not decline the reservation. Please try again.',
        iconClasses: 'bg-error-container text-alert-danger',
        confirmClasses: 'bg-alert-danger hover:bg-alert-danger/90',
    },
};

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

export default function ReviewReservationModal({
    reservation,
    action,
    onClose,
    onCompleted,
}) {
    const config = ACTIONS[action];
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    function handleClose() {
        if (!isSubmitting) onClose();
    }

    async function handleConfirm() {
        if (isSubmitting) return;

        setIsSubmitting(true);
        setErrorMessage('');

        let result;
        try {
            result = await updateReservationStatus(reservation.reservationId, action);
        } catch (error) {
            setErrorMessage(error.response?.data?.message || config.errorFallback);
            setIsSubmitting(false);
            return;
        }

        onCompleted(result);
    }

    return (
        <Modal
            title={config.title}
            onClose={handleClose}
            maxWidthClassName="max-w-xl"
        >
            <div className="space-y-4" aria-busy={isSubmitting}>
                <div className="flex items-start gap-3 border-b border-border-slate pb-4">
                    <span
                        aria-hidden="true"
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${config.iconClasses}`}
                    >
                        <span className="material-symbols-outlined text-[23px]">
                            {config.icon}
                        </span>
                    </span>
                    <div>
                        <p className="text-title-md font-semibold text-primary">
                            Review this booking
                        </p>
                        <p className="mt-1 text-body-sm leading-relaxed text-on-surface-variant">
                            {config.intro}
                        </p>
                    </div>
                </div>

                <section
                    aria-labelledby="review-reservation-summary"
                    className="rounded-2xl border border-border-slate bg-canvas-bg/60 p-4"
                >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-slate pb-3">
                        <h3
                            id="review-reservation-summary"
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
                        Go Back
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={isSubmitting}
                        className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-on-primary shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${config.confirmClasses}`}
                    >
                        <span
                            aria-hidden="true"
                            className="material-symbols-outlined text-[18px]"
                        >
                            {config.icon}
                        </span>
                        {isSubmitting ? config.busyLabel : config.confirmLabel}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
