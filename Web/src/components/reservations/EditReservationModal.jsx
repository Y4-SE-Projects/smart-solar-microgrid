// File: EditReservationModal.jsx
// Purpose: GridOperator edit form for a Pending reservation.

import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Dropdown from '../ui/Dropdown';
import ReservationStatusBadge from './ReservationStatusBadge';
import { fetchStations } from '../../services/stationsApi';
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

function Metadata({ label, children }) {
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

export default function EditReservationModal({ reservation, onClose, onUpdated }) {
    const [stations, setStations] = useState([]);
    const [selectedStationId, setSelectedStationId] = useState('');
    const [slots, setSlots] = useState([]);
    const [selectedSlotId, setSelectedSlotId] = useState('');

    const [isLoadingStations, setIsLoadingStations] = useState(true);
    const [stationsError, setStationsError] = useState('');
    const [stationReloadKey, setStationReloadKey] = useState(0);

    const [isLoadingSlots, setIsLoadingSlots] = useState(false);
    const [slotsError, setSlotsError] = useState('');
    const [slotReloadKey, setSlotReloadKey] = useState(0);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [generalError, setGeneralError] = useState('');

    useEffect(() => {
        let cancelled = false;

        fetchStations(true)
            .then((response) => {
                if (cancelled) return;

                const activeStations = response.data.data;
                setStations(activeStations);

                const currentStationIsActive = activeStations.some(
                    (station) => station.stationId === reservation.stationId
                );
                const nextStationId = currentStationIsActive
                    ? reservation.stationId
                    : '';
                setSelectedStationId(nextStationId);
                setSelectedSlotId('');
                setSlots([]);
                setSlotsError('');
                setIsLoadingSlots(Boolean(nextStationId));
            })
            .catch((error) => {
                if (!cancelled) {
                    setStationsError(
                        error.response?.data?.message || 'Could not load active stations.'
                    );
                }
            })
            .finally(() => {
                if (!cancelled) setIsLoadingStations(false);
            });

        return () => {
            cancelled = true;
        };
    }, [reservation.stationId, stationReloadKey]);

    useEffect(() => {
        if (!selectedStationId) return undefined;

        let cancelled = false;

        fetchSlotsForStation(selectedStationId)
            .then((response) => {
                if (cancelled) return;

                const stationSlots = response.data.data;
                setSlots(stationSlots);

                setSelectedSlotId((previous) => {
                    const selectablePrevious = stationSlots.some(
                        (slot) =>
                            slot.slotId === previous &&
                            slot.stationId === selectedStationId &&
                            (slot.isAvailable === true ||
                                (selectedStationId === reservation.stationId &&
                                    slot.slotId === reservation.slotId))
                    );
                    if (selectablePrevious) return previous;

                    const currentSlot =
                        selectedStationId === reservation.stationId
                            ? stationSlots.find(
                                (slot) =>
                                    slot.stationId === selectedStationId &&
                                    slot.slotId === reservation.slotId
                            )
                            : null;

                    return currentSlot?.slotId || '';
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
        selectedStationId,
        slotReloadKey,
        reservation.stationId,
        reservation.slotId,
    ]);

    const selectedStation = stations.find(
        (station) => station.stationId === selectedStationId
    );

    const selectableSlots = slots.filter(
        (slot) =>
            slot.stationId === selectedStationId &&
            (slot.isAvailable === true ||
                (selectedStationId === reservation.stationId &&
                    slot.slotId === reservation.slotId))
    );
    const stationOptions = stations.map((station) => ({
        value: station.stationId,
        label: `${station.name} (${station.stationId})`,
    }));
    const slotOptions = selectableSlots.map((slot) => ({
        value: slot.slotId,
        label: slotLabel(slot),
    }));

    const selectedSlot =
        selectableSlots.find((slot) => slot.slotId === selectedSlotId) || null;

    const selectedStart = selectedSlot ? asDate(selectedSlot.startTime) : null;
    const selectedEnd = selectedSlot ? asDate(selectedSlot.endTime) : null;
    const currentScheduled = asDate(reservation.scheduledTime);
    const isCurrentSlot =
        selectedStationId === reservation.stationId &&
        selectedSlot?.slotId === reservation.slotId;

    function slotLabel(slot) {
        const current =
            selectedStationId === reservation.stationId &&
            slot.slotId === reservation.slotId;

        return `${formatSlotWindow(slot)}${current ? ' • Current reservation slot' : ''
            }`;
    }

    function handleStationChange(stationId) {
        if (stationId === selectedStationId) return;
        setSelectedStationId(stationId);
        setSelectedSlotId('');
        setSlots([]);
        setSlotsError('');
        setGeneralError('');
        setIsLoadingSlots(Boolean(stationId));
    }

    function retryStations() {
        setIsLoadingStations(true);
        setStationsError('');
        setStationReloadKey((value) => value + 1);
    }

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

        if (!selectedStationId || !selectedSlot) {
            setGeneralError('Select a station and booking slot.');
            return;
        }

        setIsSubmitting(true);
        setGeneralError('');

        let result;
        try {
            result = await updateReservation(reservation.reservationId, {
                stationId: selectedStationId,
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
        isLoadingStations ||
        isLoadingSlots ||
        Boolean(stationsError) ||
        Boolean(slotsError) ||
        !selectedStationId ||
        !selectedSlot;

    return (
        <Modal
            title="Edit Reservation"
            onClose={handleClose}
            maxWidthClassName="max-w-2xl"
            scrollable
        >
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-slate pb-4">
                    <div className="flex min-w-0 items-center gap-3">
                        <span
                            aria-hidden="true"
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mint-surface text-primary"
                        >
                            <span className="material-symbols-outlined text-[21px]">
                                confirmation_number
                            </span>
                        </span>
                        <div className="min-w-0">
                            <p className="text-label-sm font-semibold uppercase tracking-wider text-outline">
                                Reservation ID
                            </p>
                            <p className="truncate text-body-md font-bold text-primary">
                                {reservation.reservationId}
                            </p>
                        </div>
                    </div>
                    <ReservationStatusBadge status={reservation.status} />
                </div>

                <section className="rounded-2xl border border-border-slate bg-canvas-bg/60 p-4">
                    <div className="mb-3 flex items-center gap-2">
                        <span
                            aria-hidden="true"
                            className="material-symbols-outlined text-[19px] text-secondary"
                        >
                            history
                        </span>
                        <h3 className="text-title-md font-semibold text-primary">
                            Current Booking
                        </h3>
                    </div>
                    <dl className="grid gap-3 sm:grid-cols-2">
                        <Metadata label="Prosumer NIC">{reservation.prosumerNic}</Metadata>
                        <Metadata label="Station">{reservation.stationId}</Metadata>
                        <Metadata label="Slot">{reservation.slotId}</Metadata>
                        <Metadata label="Scheduled">
                            {currentScheduled
                                ? `${formatDate(currentScheduled)} · ${formatClock(
                                    currentScheduled
                                )}`
                                : '—'}
                        </Metadata>
                    </dl>
                </section>

                <section className="rounded-2xl border border-border-slate bg-surface-container-lowest p-4 shadow-sm">
                    <div className="mb-4 flex items-start gap-2">
                        <span
                            aria-hidden="true"
                            className="material-symbols-outlined text-[19px] text-secondary"
                        >
                            edit_calendar
                        </span>
                        <div>
                            <h3 className="text-title-md font-semibold text-primary">
                                Updated Booking
                            </h3>
                            <p className="text-body-sm text-on-surface-variant">
                                Choose a live station and booking window.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label
                                htmlFor="edit-reservation-station"
                                className="text-label-md font-medium text-on-surface"
                            >
                                Active Station
                            </label>
                            <Dropdown
                                id="edit-reservation-station"
                                label="Active Station"
                                value={selectedStationId}
                                options={stationOptions}
                                onChange={handleStationChange}
                                placeholder="Select an active station"
                                disabled={
                                    isSubmitting ||
                                    isLoadingStations ||
                                    Boolean(stationsError) ||
                                    stations.length === 0
                                }
                                searchable
                                searchPlaceholder="Search stations"
                                required
                            />
                            {isLoadingStations && (
                                <p className="text-body-sm text-on-surface-variant">
                                    Loading active stations...
                                </p>
                            )}
                            {!isLoadingStations && stationsError && (
                                <div
                                    role="alert"
                                    className="flex flex-wrap items-center gap-2 text-body-sm text-alert-danger"
                                >
                                    <span>{stationsError}</span>
                                    <button
                                        type="button"
                                        onClick={retryStations}
                                        className="font-semibold underline"
                                    >
                                        Retry
                                    </button>
                                </div>
                            )}
                            {!isLoadingStations && !stationsError && stations.length === 0 && (
                                <p className="text-body-sm text-on-surface-variant">
                                    No active stations are available.
                                </p>
                            )}
                            {!isLoadingStations &&
                                !stationsError &&
                                stations.length > 0 &&
                                !selectedStationId && (
                                    <p className="text-body-sm text-on-surface-variant">
                                        The current station is not in the active list. Select an
                                        active station to continue.
                                    </p>
                                )}
                        </div>

                        <div className="space-y-1">
                            <label
                                htmlFor="edit-reservation-slot"
                                className="text-label-md font-medium text-on-surface"
                            >
                                Booking Slot
                            </label>
                            <Dropdown
                                id="edit-reservation-slot"
                                label="Booking Slot"
                                value={selectedSlotId}
                                options={slotOptions}
                                onChange={(slotId) => {
                                    setSelectedSlotId(slotId);
                                    setGeneralError('');
                                }}
                                placeholder="Select a booking slot"
                                disabled={
                                    isSubmitting ||
                                    !selectedStationId ||
                                    isLoadingSlots ||
                                    Boolean(slotsError) ||
                                    selectableSlots.length === 0
                                }
                                searchable
                                searchPlaceholder="Search booking windows"
                                required
                            />
                            {!selectedStationId &&
                                !isLoadingStations &&
                                !stationsError && (
                                    <p className="text-body-sm text-on-surface-variant">
                                        Select an active station to view its slots.
                                    </p>
                                )}
                            {isLoadingSlots && (
                                <p className="text-body-sm text-on-surface-variant">
                                    Loading station slots...
                                </p>
                            )}
                            {!isLoadingSlots && slotsError && (
                                <div
                                    role="alert"
                                    className="flex flex-wrap items-center gap-2 text-body-sm text-alert-danger"
                                >
                                    <span>{slotsError}</span>
                                    <button
                                        type="button"
                                        onClick={retrySlots}
                                        className="font-semibold underline"
                                    >
                                        Retry
                                    </button>
                                </div>
                            )}
                            {!isLoadingSlots &&
                                !slotsError &&
                                selectedStationId &&
                                slots.length === 0 && (
                                    <p className="text-body-sm text-on-surface-variant">
                                        No slots are defined for this station.
                                    </p>
                                )}
                            {!isLoadingSlots &&
                                !slotsError &&
                                slots.length > 0 &&
                                selectableSlots.length === 0 && (
                                    <p className="text-body-sm text-on-surface-variant">
                                        No selectable booking slots are available at this station.
                                    </p>
                                )}
                            {isCurrentSlot && (
                                <p className="flex items-center gap-1.5 text-body-sm text-primary">
                                    <span
                                        aria-hidden="true"
                                        className="material-symbols-outlined text-[15px]"
                                    >
                                        verified
                                    </span>
                                    This is the slot held by the current reservation.
                                </p>
                            )}
                        </div>
                    </div>
                </section>

                {selectedSlot && selectedStation && selectedStart && selectedEnd && (
                    <section className="rounded-2xl border border-secondary/20 bg-mint-surface/30 p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <span
                                    aria-hidden="true"
                                    className="material-symbols-outlined text-[18px] text-secondary"
                                >
                                    event_available
                                </span>
                                <h3 className="text-title-md font-semibold text-primary">
                                    Selected Booking Preview
                                </h3>
                            </div>
                            {isCurrentSlot && (
                                <span className="rounded-full bg-mint-surface px-2.5 py-0.5 text-label-sm font-semibold text-primary">
                                    Current slot
                                </span>
                            )}
                        </div>
                        <dl className="grid gap-3 sm:grid-cols-3">
                            <Metadata label="Station">
                                {selectedStation.name}
                                <span className="block text-body-sm font-normal text-on-surface-variant">
                                    {selectedStation.stationId}
                                </span>
                            </Metadata>
                            <Metadata label="Scheduled">{formatDate(selectedStart)}</Metadata>
                            <Metadata label="Window">
                                {formatClock(selectedStart)} to {formatClock(selectedEnd)}
                            </Metadata>
                        </dl>
                    </section>
                )}

                <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border-slate bg-canvas-bg/70 p-3">
                    <div className="flex min-w-0 items-start gap-2">
                        <span
                            aria-hidden="true"
                            className="material-symbols-outlined text-[19px] text-primary"
                        >
                            verified_user
                        </span>
                        <div>
                            <p className="text-body-sm font-semibold text-on-surface">
                                12-Hour Modification Policy
                            </p>
                            <p className="mt-0.5 text-body-sm text-on-surface-variant">
                                Updates require at least 12 hours&apos; notice before the
                                scheduled reservation. The API checks both the current and
                                selected times.
                            </p>
                        </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-mint-surface px-2.5 py-1 text-label-sm font-semibold text-primary">
                        API Enforced
                    </span>
                </div>

                {generalError && (
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
                        Keep Current
                    </button>
                    <button
                        type="submit"
                        disabled={cannotSubmit}
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-primary-container px-5 py-2.5 text-sm font-semibold text-on-primary shadow-sm transition-all hover:bg-primary disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
                            save
                        </span>
                        {isSubmitting ? 'Updating...' : 'Update Reservation'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
