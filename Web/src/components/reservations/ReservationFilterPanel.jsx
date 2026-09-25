// File: ReservationFilterPanel.jsx
// Purpose: Draft station and date filters for the operator reservation list.

import { useEffect, useState } from 'react';
import Dropdown from '../ui/Dropdown';
import { inputClass } from '../stations/formStyles';
import { fetchStations } from '../../services/stationsApi';

export default function ReservationFilterPanel({
    stationId,
    dateFrom,
    dateTo,
    onApply,
    onClear,
}) {
    const [draft, setDraft] = useState({ stationId, dateFrom, dateTo });
    const [stations, setStations] = useState([]);
    const [isLoadingStations, setIsLoadingStations] = useState(true);
    const [stationsError, setStationsError] = useState('');
    const [reloadKey, setReloadKey] = useState(0);
    const stationOptions = stations.map((station) => ({
        value: station.stationId,
        label: `${station.name} (${station.stationId})${
            station.isActive === false ? ' • Inactive' : ''
        }`,
    }));

    useEffect(() => {
        let cancelled = false;

        // Include inactive stations so historical reservations remain filterable.
        fetchStations(false)
            .then((response) => {
                if (!cancelled) setStations(response.data.data);
            })
            .catch((error) => {
                if (!cancelled) {
                    setStationsError(
                        error.response?.data?.message || 'Could not load stations.'
                    );
                }
            })
            .finally(() => {
                if (!cancelled) setIsLoadingStations(false);
            });

        return () => {
            cancelled = true;
        };
    }, [reloadKey]);

    function retryStations() {
        setIsLoadingStations(true);
        setStationsError('');
        setReloadKey((value) => value + 1);
    }

    function clearFilters() {
        setDraft({ stationId: '', dateFrom: '', dateTo: '' });
        onClear();
    }

    return (
        <div
            id="reservation-filter-panel"
            className="relative z-10 border-b border-border-slate bg-canvas-bg/50 p-4"
        >
            <div className="mb-4 flex items-center gap-2">
                <span
                    aria-hidden="true"
                    className="material-symbols-outlined text-[18px] text-primary-container"
                >
                    filter_alt
                </span>
                <div>
                    <h2 className="text-title-md font-semibold text-primary">
                        Reservation Filters
                    </h2>
                    <p className="text-body-sm text-on-surface-variant">
                        Refine the operator list by station or scheduled date.
                    </p>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1">
                    <label
                        htmlFor="reservation-filter-station"
                        className="text-label-md font-medium text-on-surface"
                    >
                        Station
                    </label>
                    <Dropdown
                        id="reservation-filter-station"
                        label="Station"
                        value={draft.stationId}
                        options={stationOptions}
                        onChange={(value) => setDraft((current) => ({ ...current, stationId: value }))}
                        placeholder="All stations"
                        disabled={isLoadingStations || Boolean(stationsError)}
                        searchable
                        searchPlaceholder="Search stations"
                    />
                    {isLoadingStations && (
                        <p className="text-body-sm text-on-surface-variant">Loading stations...</p>
                    )}
                    {!isLoadingStations && stationsError && (
                        <div role="alert" className="flex items-center gap-2 text-body-sm text-alert-danger">
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
                            No stations are available.
                        </p>
                    )}
                </div>

                <div className="space-y-1">
                    <label
                        htmlFor="reservation-filter-from"
                        className="text-label-md font-medium text-on-surface"
                    >
                        Date From
                    </label>
                    <input
                        id="reservation-filter-from"
                        type="date"
                        value={draft.dateFrom}
                        onChange={(event) =>
                            setDraft((current) => ({ ...current, dateFrom: event.target.value }))
                        }
                        className={inputClass}
                    />
                </div>

                <div className="space-y-1">
                    <label
                        htmlFor="reservation-filter-to"
                        className="text-label-md font-medium text-on-surface"
                    >
                        Date To
                    </label>
                    <input
                        id="reservation-filter-to"
                        type="date"
                        value={draft.dateTo}
                        onChange={(event) =>
                            setDraft((current) => ({ ...current, dateTo: event.target.value }))
                        }
                        className={inputClass}
                    />
                </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                <button
                    type="button"
                    onClick={clearFilters}
                    className="rounded-full px-4 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container-low"
                >
                    Clear
                </button>
                <button
                    type="button"
                    onClick={() => onApply(draft)}
                    className="rounded-full bg-primary-container px-4 py-2 text-xs font-semibold text-on-primary shadow-sm hover:bg-primary"
                >
                    Apply Filters
                </button>
            </div>
        </div>
    );
}
