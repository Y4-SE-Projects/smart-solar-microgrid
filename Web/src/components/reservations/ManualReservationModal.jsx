// File: ManualReservationModal.jsx
// Purpose: GridOperator form for creating a reservation on behalf of a Prosumer.

import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import { inputClass } from '../stations/formStyles';
import { fetchStations } from '../../services/stationsApi';
import { fetchSlotsForStation } from '../../services/slotsApi';
import { createReservation } from '../../services/reservationApi';
import Dropdown from '../ui/Dropdown';

function twoDigits(value) {
    return String(value).padStart(2, '0');
}

function formatClock(date) {
    const hour = date.getHours();
    const twelveHour = hour % 12 || 12;
    const period = hour < 12 ? 'a.m.' : 'p.m.';

    return `${twoDigits(twelveHour)}:${twoDigits(date.getMinutes())} ${period}`;
}

function formatSlotWindow(slot) {
    const start = new Date(slot.startTime);
    const end = new Date(slot.endTime);

    const date = `${twoDigits(start.getDate())}/${twoDigits(
        start.getMonth() + 1
    )}/${start.getFullYear()}`;

    return `${date} ${formatClock(start)} to ${formatClock(end)}`;
}

export default function ManualReservationModal({ onClose, onCreated }) {
    const [prosumerNic, setProsumerNic] = useState('');
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

                if (activeStations.length > 0) {
                    setSelectedStationId(activeStations[0].stationId);
                    setIsLoadingSlots(true);
                }
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
    }, [stationReloadKey]);

    useEffect(() => {
        if (!selectedStationId) return;

        let cancelled = false;

        fetchSlotsForStation(selectedStationId)
            .then((response) => {
                if (!cancelled) setSlots(response.data.data);
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
    }, [selectedStationId, slotReloadKey]);

    const availableSlots = slots.filter((slot) => slot.isAvailable);
    const stationOptions = stations.map((station) => ({
        value: station.stationId,
        label: `${station.name} (${station.stationId})`,
    }));
    const slotOptions = availableSlots.map((slot) => ({
        value: slot.slotId,
        label: formatSlotWindow(slot),
    }));
    const selectedSlot =
        availableSlots.find((slot) => slot.slotId === selectedSlotId) ?? null;

    function retryStations() {
        setIsLoadingStations(true);
        setStationsError('');
        setStationReloadKey((value) => value + 1);
    }

    function retrySlots() {
        setSelectedSlotId('');
        setSlots([]);
        setIsLoadingSlots(true);
        setSlotsError('');
        setSlotReloadKey((value) => value + 1);
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

    function handleClose() {
        if (!isSubmitting) onClose();
    }

    async function handleSubmit(event) {
        event.preventDefault();

        const trimmedNic = prosumerNic.trim();

        if (!trimmedNic) {
            setGeneralError('Prosumer NIC is required.');
            return;
        }

        if (!selectedStationId || !selectedSlot) {
            setGeneralError('Select an available slot.');
            return;
        }

        setIsSubmitting(true);
        setGeneralError('');

        try {
            const result = await createReservation({
                prosumerNic: trimmedNic,
                stationId: selectedStationId,
                slotId: selectedSlot.slotId,
                scheduledTime: selectedSlot.startTime,
            });

            onCreated(result);
        } catch (error) {
            setGeneralError(
                error.response?.data?.message || 'Could not create the reservation.'
            );
            setIsSubmitting(false);
        }
    }

    const cannotSubmit =
        isSubmitting ||
        isLoadingStations ||
        isLoadingSlots ||
        Boolean(stationsError) ||
        Boolean(slotsError) ||
        stations.length === 0 ||
        availableSlots.length === 0;

    return (
        <Modal
            title="Manual Reservation"
            onClose={handleClose}
            maxWidthClassName="max-w-xl"
            scrollable={false}
        >
            <form className="space-y-space-md" onSubmit={handleSubmit} noValidate>
                <div className="space-y-1">
                    <label
                        htmlFor="manual-reservation-nic"
                        className="text-label-md font-medium text-on-surface"
                    >
                        Prosumer NIC
                    </label>
                    <input
                        id="manual-reservation-nic"
                        className={inputClass}
                        value={prosumerNic}
                        onChange={(event) => {
                            setProsumerNic(event.target.value);
                            setGeneralError('');
                        }}
                        placeholder="Enter the Prosumer's NIC"
                        autoComplete="off"
                        disabled={isSubmitting}
                        required
                    />
                </div>

                <div className="space-y-1">
                    <label
                        htmlFor="manual-reservation-station"
                        className="text-label-md font-medium text-on-surface"
                    >
                        Active Station
                    </label>
                    <Dropdown
                        id="manual-reservation-station"
                        label="Active Station"
                        value={selectedStationId}
                        options={stationOptions}
                        onChange={handleStationChange}
                        placeholder="Select a station"
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
                        <div role="alert" className="flex items-center gap-3 text-body-sm text-alert-danger">
                            <span>{stationsError}</span>
                            <button type="button" onClick={retryStations} className="font-semibold underline">
                                Retry
                            </button>
                        </div>
                    )}
                    {!isLoadingStations && !stationsError && stations.length === 0 && (
                        <p className="text-body-sm text-on-surface-variant">
                            No active stations are available.
                        </p>
                    )}
                </div>

                <div className="space-y-1">
                    <label
                        htmlFor="manual-reservation-slot"
                        className="text-label-md font-medium text-on-surface"
                    >
                        Available Slot
                    </label>
                    <Dropdown
                        id="manual-reservation-slot"
                        label="Available Slot"
                        value={selectedSlotId}
                        options={slotOptions}
                        onChange={(slotId) => {
                            setSelectedSlotId(slotId);
                            setGeneralError('');
                        }}
                        placeholder="Select an available slot"
                        disabled={
                            isSubmitting ||
                            !selectedStationId ||
                            isLoadingSlots ||
                            Boolean(slotsError) ||
                            availableSlots.length === 0
                        }
                        searchable
                        searchPlaceholder="Search booking windows"
                        required
                    />

                    {!selectedStationId && !isLoadingStations && !stationsError && (
                        <p className="text-body-sm text-on-surface-variant">
                            Select a station to view its slots.
                        </p>
                    )}
                    {isLoadingSlots && (
                        <p className="text-body-sm text-on-surface-variant">
                            Loading slots...
                        </p>
                    )}
                    {!isLoadingSlots && slotsError && (
                        <div role="alert" className="flex items-center gap-3 text-body-sm text-alert-danger">
                            <span>{slotsError}</span>
                            <button type="button" onClick={retrySlots} className="font-semibold underline">
                                Retry
                            </button>
                        </div>
                    )}
                    {!isLoadingSlots && !slotsError && selectedStationId && slots.length === 0 && (
                        <p className="text-body-sm text-on-surface-variant">
                            No slots are defined for this station yet.
                        </p>
                    )}
                    {!isLoadingSlots &&
                        !slotsError &&
                        slots.length > 0 &&
                        availableSlots.length === 0 && (
                            <p className="text-body-sm text-on-surface-variant">
                                No available slots remain at this station.
                            </p>
                        )}
                </div>


                {generalError && (
                    <div
                        role="alert"
                        className="flex items-start gap-2 px-space-md py-space-sm bg-error-container text-on-error-container rounded-xl text-body-sm"
                    >
                        <span className="material-symbols-outlined text-[18px] mt-0.5">
                            error
                        </span>
                        <span>{generalError}</span>
                    </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-space-sm">
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={isSubmitting}
                        className="px-5 py-2.5 rounded-full text-on-surface-variant font-semibold text-sm hover:bg-surface-container-low disabled:opacity-60 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={cannotSubmit}
                        className="px-5 py-2.5 rounded-full bg-primary-container text-on-primary font-semibold text-sm shadow-sm hover:bg-primary disabled:opacity-60 transition-all"
                    >
                        {isSubmitting ? 'Creating...' : 'Create Reservation'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
