// File: EditReservationModal.jsx
// Purpose: GridOperator edit form for a Pending reservation.

import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Dropdown from '../ui/Dropdown';
import { fetchSlotsForStation } from '../../services/slotsApi';
import { updateReservation } from '../../services/reservationApi';

function asDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function twoDigits(value) {
    return String(value).padStart(2, '0');
}

function formatDate(date) {
    return `${twoDigits(date.getDate())}/${twoDigits(
        date.getMonth() + 1
    )}/${date.getFullYear()}`;
}

function formatClock(date) {
    const hour = date.getHours();
    const twelveHour = hour % 12 || 12;
    const period = hour < 12 ? 'a.m.' : 'p.m.';
    return `${twoDigits(twelveHour)}:${twoDigits(date.getMinutes())} ${period}`;
}

function formatSlotWindow(slot) {
    const start = asDate(slot.startTime);
    const end = asDate(slot.endTime);
    if (!start || !end) return 'Slot time unavailable';
    return `${formatDate(start)} ${formatClock(start)} to ${formatClock(end)}`;
}

export default function EditReservationModal({ reservation, onClose, onUpdated }) {
    const [slots, setSlots] = useState([]);
    const [selectedSlotId, setSelectedSlotId] = useState('');

    const [isLoadingSlots, setIsLoadingSlots] = useState(Boolean(reservation.stationId));
    const [slotsError, setSlotsError] = useState('');
    const [slotReloadKey, setSlotReloadKey] = useState(0);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [generalError, setGeneralError] = useState('');

    useEffect(() => {
        if (!reservation.stationId) return undefined;

        let cancelled = false;

        fetchSlotsForStation(reservation.stationId)
            .then((response) => {
                if (cancelled) return;

                const stationSlots = response.data.data;
                setSlots(stationSlots);

                setSelectedSlotId((previous) => {
                    const selectablePrevious = stationSlots.some(
                        (slot) =>
                            slot.slotId === previous &&
                            slot.stationId === reservation.stationId &&
                            slot.isAvailable === true &&
                            slot.slotId !== reservation.slotId
                    );
                    return selectablePrevious ? previous : '';
                });
            })
            .catch((error) => {
                if (!cancelled) {
                    setSlotsError(
                        error.response?.data?.message ||
                        'Could not load slots for this station.'
                    );
                }
            })
            .finally(() => {
                if (!cancelled) setIsLoadingSlots(false);
            });

        return () => {
            cancelled = true;
        };
    }, [
        reservation.stationId,
        slotReloadKey,
        reservation.slotId,
    ]);

    const selectableSlots = slots.filter(
        (slot) =>
            slot.stationId === reservation.stationId &&
            slot.isAvailable === true &&
            slot.slotId !== reservation.slotId
    );
    const slotOptions = selectableSlots.map((slot) => ({
        value: slot.slotId,
        label: formatSlotWindow(slot),
        hint: slot.slotId,
    }));

    const selectedSlot =
        selectableSlots.find((slot) => slot.slotId === selectedSlotId) || null;

    const currentScheduled = asDate(reservation.scheduledTime);

    function retrySlots() {
        setIsLoadingSlots(true);
        setSlots([]);
        setSlotsError('');
        setSlotReloadKey((value) => value + 1);
    }

    function handleClose() {
        if (!isSubmitting) onClose();
    }

    async function handleSubmit(event) {
        event.preventDefault();
        if (isSubmitting) return;

        if (!reservation.stationId || !selectedSlot) {
            setGeneralError('Select a booking slot at this reservation’s station.');
            return;
        }

        setIsSubmitting(true);
        setGeneralError('');

        let result;
        try {
            result = await updateReservation(reservation.reservationId, {
                stationId: reservation.stationId,
                slotId: selectedSlot.slotId,
                scheduledTime: selectedSlot.startTime,
            });
        } catch (error) {
            setGeneralError(
                error.response?.data?.message || 'Could not update the reservation.'
            );
            setIsSubmitting(false);
            return;
        }

        onUpdated(result);
    }

    const cannotSubmit =
        isSubmitting ||
        isLoadingSlots ||
        Boolean(slotsError) ||
        !reservation.stationId ||
        !selectedSlot;

    return (
        <Modal
            title="Edit reservation"
            description={`Reservation ${reservation.reservationId}`}
            onClose={handleClose}
            maxWidthClassName="max-w-lg"
        >
            <form onSubmit={handleSubmit} className="space-y-5" noValidate aria-busy={isSubmitting}>
                <div className="space-y-1 border-b border-border-slate pb-4 text-body-sm">
                    <p className="text-on-surface-variant">
                        Prosumer <strong className="font-semibold text-on-surface">{reservation.prosumerNic}</strong>
                        {' · '}Station <strong className="font-semibold text-on-surface">{reservation.stationId || 'Unavailable'}</strong>
                    </p>
                    <p className="text-on-surface-variant">
                        Current: <span className="font-medium text-on-surface">
                            {currentScheduled ? (
                                <>{formatDate(currentScheduled)} at {formatClock(currentScheduled)}</>
                            ) : (
                                'Time unavailable'
                            )}
                        </span>
                        {' · '}Slot {reservation.slotId}
                    </p>
                </div>

                <div className="space-y-2">
                    <label
                        htmlFor="edit-reservation-slot"
                        className="block text-title-md font-semibold text-on-surface"
                    >
                        New booking slot
                    </label>
                    <p className="text-body-sm text-on-surface-variant">
                        Choose a different date and time at the same station.
                    </p>
                    <Dropdown
                        id="edit-reservation-slot"
                        label="New booking slot"
                        value={selectedSlotId}
                        options={slotOptions}
                        onChange={(slotId) => {
                            setSelectedSlotId(slotId);
                            setGeneralError('');
                        }}
                        placeholder="Select a new slot"
                        disabled={
                            isSubmitting ||
                            !reservation.stationId ||
                            isLoadingSlots ||
                            Boolean(slotsError) ||
                            selectableSlots.length === 0
                        }
                        searchable
                        searchPlaceholder="Search dates, times, or slot IDs"
                        required
                    />
                    {!reservation.stationId && (
                        <p className="text-body-sm text-alert-danger">
                            The station is unavailable. Refresh the reservation list before editing.
                        </p>
                    )}
                    {isLoadingSlots && (
                        <p className="text-body-sm text-on-surface-variant">
                            Loading available slots...
                        </p>
                    )}
                    {!isLoadingSlots && slotsError && (
                        <div role="alert" className="flex flex-wrap items-center gap-2 text-body-sm text-alert-danger">
                            <span>{slotsError}</span>
                            <button type="button" onClick={retrySlots} className="font-semibold underline">
                                Retry
                            </button>
                        </div>
                    )}
                    {!isLoadingSlots && !slotsError && reservation.stationId && selectableSlots.length === 0 && (
                        <p className="text-body-sm text-on-surface-variant">
                            No other available slots at this station.
                        </p>
                    )}
                </div>

                <p className="border-t border-border-slate pt-4 text-body-sm leading-relaxed text-on-surface-variant">
                    Both booking times need at least 12 hours’ notice. The new slot must be within 7 days of the reservation’s creation.
                </p>

                {generalError && (
                    <div
                        role="alert"
                        className="flex items-start gap-2 rounded-xl bg-error-container px-space-md py-space-sm text-body-sm text-on-error-container"
                    >
                        <span aria-hidden="true" className="material-symbols-outlined mt-0.5 text-[18px]">
                            error
                        </span>
                        <span>{generalError}</span>
                    </div>
                )}

                <div className="flex flex-col-reverse gap-2 border-t border-border-slate pt-4 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={isSubmitting}
                        className="rounded-full px-5 py-2.5 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-low disabled:opacity-60"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={cannotSubmit}
                        className="rounded-full bg-primary-container px-5 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isSubmitting ? 'Saving...' : 'Save changes'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
