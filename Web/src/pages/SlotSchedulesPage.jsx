// File: SlotSchedulesPage.jsx
// Purpose: Shared Backoffice + Grid Operator page for a station's bookable slots, one day at a time.
//          Slots are fetched a month at a time (the month on the calendar), so the calendar can
//          highlight every day that has slots and the day table is filtered here, without a request.
//          Backoffice manages the slot time windows themselves (create/edit/delete);
//          Grid Operator manages only live availability — each role only sees the actions
//          the API actually authorizes them to perform, everything else stays hidden.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Roles } from '../constants/roles';
import { fetchStations } from '../services/stationsApi';
import { fetchSlotsForStation, generateRecurringSlots, updateSlot, setSlotAvailability, deleteSlot } from '../services/slotsApi';
import SlotFormModal from '../components/slots/SlotFormModal';
import GenerateSlotsModal from '../components/slots/GenerateSlotsModal';
import Modal from '../components/ui/Modal';
import Calendar from '../components/ui/Calendar';
import Dropdown from '../components/ui/Dropdown';
import { DANGER_BUTTON, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../components/ui/buttonStyles';
import {
  formatDuration,
  formatLongDate,
  formatShortDate,
  isSameDay,
  minutesOfDay,
  minutesToTime,
  plural,
  startOfDay,
  startOfToday,
  toMonthKey,
} from '../utils/time';

// One cache entry per station and month, e.g. "ST-001|2026-09"
function cacheKey(stationId, monthKey) {
  return `${stationId}|${monthKey}`;
}

function monthName(date) {
  return date.toLocaleDateString(undefined, { month: 'long' });
}

// The API pads each month by a day either side, so its slots are trimmed back to the local month here
function isInMonth(date, month) {
  return date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear();
}

// The distinct local days that have at least one of the given slots
function daysWithSlots(slots) {
  const days = new Map();
  for (const slot of slots) {
    const start = new Date(slot.startTime);
    days.set(start.toDateString(), startOfDay(start));
  }
  return [...days.values()];
}

function slotTimes(slot) {
  const start = new Date(slot.startTime);
  const end = new Date(slot.endTime);
  return {
    label: `${minutesToTime(minutesOfDay(start))} → ${minutesToTime(minutesOfDay(end))}`,
    duration: formatDuration(Math.round((end - start) / 60000)),
  };
}

function toSearchWords(query) {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

// The words a slot can be found by: its times (08:00 and 8:00), weekday, month, day number and availability
function slotSearchTokens(slot) {
  const start = new Date(slot.startTime);
  const end = new Date(slot.endTime);
  const times = [minutesToTime(minutesOfDay(start)), minutesToTime(minutesOfDay(end))];
  return [
    ...times,
    ...times.map((time) => time.replace(/^0/, '')),
    start.toLocaleDateString(undefined, { weekday: 'long' }),
    start.toLocaleDateString(undefined, { month: 'long' }),
    String(start.getDate()),
    slot.isAvailable ? 'available' : 'unavailable',
  ].map((token) => token.toLowerCase());
}

// Every query word must appear in the slot ID or start one of its other words, so "available" skips "unavailable"
function matchesSlot(slot, words) {
  const id = slot.slotId.toLowerCase();
  const tokens = slotSearchTokens(slot);
  return words.every((word) => id.includes(word) || tokens.some((token) => token.startsWith(word)));
}

function SkeletonRows({ columns }) {
  return [0, 1, 2].map((row) => (
    <tr key={row}>
      {['w-20', 'w-28', 'w-10', 'w-40', 'w-20', 'w-16'].slice(-columns).map((width, cell) => (
        <td key={cell} className="px-5 py-4">
          <div className={`h-3 rounded-full bg-on-surface/6 animate-pulse motion-reduce:animate-none ${width}`} />
        </td>
      ))}
    </tr>
  ));
}

export default function SlotSchedulesPage() {
  const { role } = useAuth();
  const isBackoffice = role === Roles.Backoffice;
  const isGridOperator = role === Roles.GridOperator;

  const [stations, setStations] = useState([]);
  const [isLoadingStations, setIsLoadingStations] = useState(true);
  const [stationsError, setStationsError] = useState('');
  const [selectedStationId, setSelectedStationId] = useState('');

  const [selectedDate, setSelectedDate] = useState(() => startOfToday());
  const [calendarMonth, setCalendarMonth] = useState(() => startOfToday());
  const [slotQuery, setSlotQuery] = useState('');

  // cacheKey -> { slots } once loaded, or { error }. A missing key means that month is still loading.
  const [monthCache, setMonthCache] = useState({});
  // cacheKey -> id of the newest request for it, so an older response that lands late is ignored
  const latestRequest = useRef({});
  const requestCounter = useRef(0);

  const [formModal, setFormModal] = useState(null); // null | { mode: 'create' } | { mode: 'edit', slot }
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [pendingSlotId, setPendingSlotId] = useState(null);
  const [actionError, setActionError] = useState(null); // { slotId, message } | null

  const selectedStation = stations.find((s) => s.stationId === selectedStationId) ?? null;
  const canChangeSlots = isBackoffice && Boolean(selectedStation?.isActive);
  const isToday = isSameDay(selectedDate, startOfToday());

  // Usually the same month; they differ when the calendar is flipped away from the selected day
  const calendarMonthKey = toMonthKey(calendarMonth);
  const selectedMonthKey = toMonthKey(selectedDate);
  const calendarEntry = selectedStationId ? monthCache[cacheKey(selectedStationId, calendarMonthKey)] : undefined;
  const selectedEntry = selectedStationId ? monthCache[cacheKey(selectedStationId, selectedMonthKey)] : undefined;

  // While searching, the table and the highlights cover the whole month on the calendar instead of one day
  const searchWords = toSearchWords(slotQuery);
  const isSearching = searchWords.length > 0;
  const tableEntry = isSearching ? calendarEntry : selectedEntry;
  const tableMonthKey = isSearching ? calendarMonthKey : selectedMonthKey;

  const isLoadingSlots = isLoadingStations || (Boolean(selectedStationId) && !tableEntry);
  const slotsError = tableEntry?.error ?? '';
  const monthSlots = selectedEntry?.slots ?? [];
  const calendarSlots = (calendarEntry?.slots ?? []).filter((slot) => isInMonth(new Date(slot.startTime), calendarMonth));
  const searchResults = isSearching ? calendarSlots.filter((slot) => matchesSlot(slot, searchWords)) : [];
  const slots = isSearching
    ? searchResults
    : monthSlots.filter((slot) => isSameDay(new Date(slot.startTime), selectedDate));
  const markedDays = daysWithSlots(isSearching ? searchResults : calendarSlots);
  const selectedMonthHasSlots = monthSlots.some((slot) => isInMonth(new Date(slot.startTime), selectedDate));
  const columnCount = isSearching ? 6 : 5;

  // Loads the station list once, and auto-selects the first one so the page isn't empty on arrival.
  useEffect(() => {
    let cancelled = false;
    fetchStations()
      .then((response) => {
        if (cancelled) return;
        const list = response.data.data;
        setStations(list);
        if (list.length > 0) setSelectedStationId((prev) => prev || list[0].stationId);
      })
      .catch((error) => {
        if (!cancelled) setStationsError(error.response?.data?.message || 'Could not load stations.');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingStations(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetches one station-month into the cache. Always resolves, so callers can await it safely.
  const loadMonth = useCallback((stationId, monthKey) => {
    const key = cacheKey(stationId, monthKey);
    const requestId = ++requestCounter.current;
    latestRequest.current[key] = requestId;
    const isLatest = () => latestRequest.current[key] === requestId;

    return fetchSlotsForStation(stationId, monthKey)
      .then((response) => {
        if (isLatest()) setMonthCache((prev) => ({ ...prev, [key]: { slots: response.data.data } }));
      })
      .catch((error) => {
        const message = error.response?.data?.message || 'Could not load slots for this month.';
        if (isLatest()) setMonthCache((prev) => ({ ...prev, [key]: { error: message } }));
      })
      .finally(() => {
        if (isLatest()) delete latestRequest.current[key];
      });
  }, []);

  // Fetches the calendar's month and the selected day's month whenever either isn't cached yet
  useEffect(() => {
    if (!selectedStationId) return;
    for (const monthKey of new Set([calendarMonthKey, selectedMonthKey])) {
      const key = cacheKey(selectedStationId, monthKey);
      if (!(key in monthCache) && !(key in latestRequest.current)) loadMonth(selectedStationId, monthKey);
    }
  }, [selectedStationId, calendarMonthKey, selectedMonthKey, monthCache, loadMonth]);

  // After a change: re-fetches the given months, keeping their current rows on screen until the
  // new ones arrive, and forgets every other cached month of this station so it reloads on visit.
  function refreshMonths(monthKeys) {
    const months = [...new Set(monthKeys)];
    const keep = new Set(months.map((monthKey) => cacheKey(selectedStationId, monthKey)));
    const isStale = (key) => key.startsWith(`${selectedStationId}|`) && !keep.has(key);

    for (const key of Object.keys(latestRequest.current)) {
      if (isStale(key)) delete latestRequest.current[key]; // an in-flight response from before the change
    }
    setMonthCache((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => !isStale(key))));
    return Promise.all(months.map((monthKey) => loadMonth(selectedStationId, monthKey)));
  }

  function retryMonth(monthKey) {
    const key = cacheKey(selectedStationId, monthKey);
    setMonthCache((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function selectStation(stationId) {
    if (stationId === selectedStationId) return;
    setActionError(null);
    setSelectedStationId(stationId);
  }

  // Also moves the calendar to that day's month, for jumps that don't come from a calendar click.
  // Picking a day leaves search mode, since the table then shows that one day.
  function selectDate(date) {
    setCalendarMonth(date);
    setSlotQuery('');
    if (isSameDay(date, selectedDate)) return;
    setActionError(null);
    setSelectedDate(startOfDay(date));
  }

  // Refreshes what's on screen plus the given day's month, then shows that day
  async function showDay(date) {
    await refreshMonths([calendarMonthKey, selectedMonthKey, toMonthKey(date)]);
    selectDate(date);
  }

  // Runs a mutating action (availability toggle / delete), tracks per-row loading, and
  // surfaces the server's own error message on failure rather than pre-guessing one.
  async function runAction(slotId, action) {
    setPendingSlotId(slotId);
    setActionError(null);
    try {
      await action();
      await refreshMonths([calendarMonthKey, selectedMonthKey]);
    } catch (error) {
      setActionError({ slotId, message: error.response?.data?.message || 'The request failed.' });
    } finally {
      setPendingSlotId(null);
    }
  }

  // Returns the { created, skipped } summary so GenerateSlotsModal can show it, and moves the
  // page to the first day of the range so the new slots are on screen behind the dialog.
  async function handleGenerate(payload) {
    const response = await generateRecurringSlots(selectedStationId, payload);
    await showDay(startOfDay(new Date(payload.rangeStart)));
    return response.data.data;
  }

  // Follows the slot to its new day if the edit moved it
  async function handleEdit(payload) {
    await updateSlot(formModal.slot.slotId, payload);
    await showDay(startOfDay(new Date(payload.startTime)));
    setFormModal(null);
  }

  async function handleDeleteConfirm() {
    const slotId = deleteTarget.slotId;
    setDeleteTarget(null);
    await runAction(slotId, () => deleteSlot(slotId));
  }

  const stationOptions = stations.map((s) => ({
    value: s.stationId,
    label: `${s.stationId} · ${s.name}`,
    tone: s.isActive ? undefined : 'danger',
    hint: s.isActive ? undefined : 'deactivated',
  }));

  return (
    <div className="flex flex-col">
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-headline-lg font-bold tracking-tight text-primary">Energy Slot Schedules</h1>
          <p className="mt-1 text-body-md text-on-surface-variant">
            {isGridOperator
              ? 'Update live battery slot availability for each station.'
              : 'Define the bookable time windows offered at each station.'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3 self-start md:self-auto">
          {stationsError ? (
            <p className="text-body-sm text-alert-danger">{stationsError}</p>
          ) : (
            <Dropdown
              label="Station"
              variant="pill"
              value={selectedStationId}
              options={stationOptions}
              onChange={selectStation}
              placeholder={stations.length === 0 ? 'No stations registered yet' : 'Select a station'}
              className="w-72"
              searchable
              searchPlaceholder="Search by ID or name"
              emptyText="No stations match."
            />
          )}
          {isBackoffice && selectedStationId && (
            <button
              type="button"
              onClick={() => setFormModal({ mode: 'create' })}
              disabled={!canChangeSlots}
              title={canChangeSlots ? undefined : 'Reactivate this station to add slots'}
              className="flex shrink-0 items-center gap-2 rounded-full bg-primary-container px-5 py-2.5 text-xs font-semibold text-on-primary shadow-sm transition-all hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-primary-container"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                add_circle
              </span>
              <span>Add Slots</span>
            </button>
          )}
        </div>
      </div>

      {selectedStation && !selectedStation.isActive && (
        <div className="mb-6 flex items-start gap-2 rounded-xl bg-error-container/55 px-5 py-2 text-body-sm text-on-error-container">
          <span className="material-symbols-outlined shrink-0 text-[16px]" aria-hidden="true">
            block
          </span>
          <span>
            {selectedStation.stationId} is deactivated. Its existing slots are listed below, but slots can't be added or
            edited until it's reactivated.
          </span>
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="mb-6 flex items-start justify-between gap-3 rounded-2xl bg-error-container px-5 py-3 text-body-sm text-on-error-container"
        >
          <span className="flex items-start gap-2">
            <span className="material-symbols-outlined mt-0.5 text-[18px]" aria-hidden="true">
              error
            </span>
            <span>
              <strong>{actionError.slotId}:</strong> {actionError.message}
            </span>
          </span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            aria-label="Dismiss"
            className="flex size-7 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-error/10"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              close
            </span>
          </button>
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <section className="rounded-2xl border border-border-slate bg-surface-container-lowest p-4 shadow-sm lg:sticky lg:top-24">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-label-md font-semibold text-on-surface">Pick a day</h2>
            <button
              type="button"
              onClick={() => selectDate(startOfToday())}
              disabled={!isSearching && isToday && isSameDay(calendarMonth, selectedDate)}
              className="h-7 rounded-full px-3 text-xs font-semibold text-primary transition-colors hover:bg-on-surface/6 outline-none focus-visible:ring-2 focus-visible:ring-secondary disabled:cursor-default disabled:text-outline-variant disabled:hover:bg-transparent"
            >
              Today
            </button>
          </div>
          <Calendar
            mode="single"
            value={selectedDate}
            onChange={selectDate}
            month={calendarMonth}
            onMonthChange={setCalendarMonth}
            markedDays={markedDays}
          />
          <div className="mt-3 flex min-h-7 items-center justify-between gap-3 border-t border-border-slate pt-3 text-body-sm text-on-surface-variant">
            <span className="flex items-center gap-2">
              <span className="size-3 rounded-full bg-mint-surface ring-1 ring-inset ring-secondary/40" aria-hidden="true" />
              {isSearching ? 'Has matches' : 'Has slots'}
            </span>
            <span className="tabular-nums" aria-live="polite">
              {!selectedStationId ? null : calendarEntry?.error ? (
                <button
                  type="button"
                  onClick={() => retryMonth(calendarMonthKey)}
                  className="font-semibold text-alert-danger underline-offset-2 hover:underline"
                >
                  Couldn't load, retry
                </button>
              ) : calendarEntry ? (
                `${plural(markedDays.length, 'day')} in ${monthName(calendarMonth)}`
              ) : (
                'Loading…'
              )}
            </span>
          </div>
        </section>

        <section className="min-w-0 overflow-hidden rounded-2xl border border-border-slate bg-surface-container-lowest shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-border-slate px-5 py-3">
            <div className="flex min-w-0 items-baseline gap-3">
              <h2 className="truncate text-headline-sm font-semibold text-on-surface">
                {isSearching
                  ? `Matches in ${calendarMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`
                  : formatLongDate(selectedDate)}
              </h2>
              <p className="shrink-0 text-body-sm tabular-nums text-on-surface-variant" aria-live="polite">
                {isLoadingSlots ? 'Loading…' : slotsError ? '' : plural(slots.length, 'slot')}
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <span
                className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[17px] text-on-surface-variant"
                aria-hidden="true"
              >
                search
              </span>
              <input
                type="search"
                value={slotQuery}
                onChange={(event) => setSlotQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setSlotQuery('');
                }}
                disabled={!selectedStationId}
                placeholder={`Search ${monthName(calendarMonth)} slots`}
                aria-label={`Search slots in ${monthName(calendarMonth)}`}
                autoComplete="off"
                spellCheck={false}
                className="h-9 w-full rounded-full border border-border-slate bg-canvas-bg pl-9 pr-9 text-xs text-on-surface outline-none transition-colors placeholder:text-on-surface-variant focus:border-secondary focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary/20 disabled:opacity-60 [&::-webkit-search-cancel-button]:hidden"
              />
              {slotQuery && (
                <button
                  type="button"
                  onClick={() => setSlotQuery('')}
                  aria-label="Clear search"
                  className="absolute right-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full text-on-surface-variant transition-colors hover:bg-on-surface/6 hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                    close
                  </span>
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border-slate bg-canvas-bg font-semibold uppercase tracking-wider text-on-surface-variant">
                  {isSearching && <th className="whitespace-nowrap px-5 py-3">Date</th>}
                  <th className="whitespace-nowrap px-5 py-3">Time</th>
                  <th className="whitespace-nowrap px-5 py-3">Duration</th>
                  <th className="whitespace-nowrap px-5 py-3">Slot ID</th>
                  <th className="whitespace-nowrap px-5 py-3">Availability</th>
                  <th className="whitespace-nowrap px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-slate">
                {isLoadingSlots && <SkeletonRows columns={columnCount} />}

                {!isLoadingSlots && slotsError && (
                  <tr>
                    <td colSpan={columnCount} className="px-5 py-10 text-center">
                      <p className="mb-3 text-alert-danger">{slotsError}</p>
                      <button type="button" onClick={() => retryMonth(tableMonthKey)} className={SECONDARY_BUTTON}>
                        Retry
                      </button>
                    </td>
                  </tr>
                )}

                {!isLoadingSlots && !slotsError && isSearching && slots.length === 0 && (
                  <tr>
                    <td colSpan={columnCount} className="px-5 py-12 text-center">
                      <p className="text-body-md font-semibold text-on-surface">
                        No slots in {monthName(calendarMonth)} match “{slotQuery.trim()}”
                      </p>
                      <p className="mt-1 text-body-sm text-on-surface-variant">
                        Try a slot ID, a time such as 08:00, a weekday, or available / unavailable.
                      </p>
                      <button type="button" onClick={() => setSlotQuery('')} className={`${SECONDARY_BUTTON} mt-4`}>
                        Clear search
                      </button>
                    </td>
                  </tr>
                )}

                {!isLoadingSlots && !slotsError && !isSearching && slots.length === 0 && (
                  <tr>
                    <td colSpan={columnCount} className="px-5 py-12 text-center">
                      <p className="text-body-md font-semibold text-on-surface">
                        {selectedStationId ? `No slots on ${formatShortDate(selectedDate)}` : 'Select a station'}
                      </p>
                      {selectedStationId && (
                        <p className="mt-1 text-body-sm text-on-surface-variant">
                          {selectedMonthHasSlots
                            ? `Pick a highlighted day to see its slots${canChangeSlots ? ', or add slots for this one' : ''}.`
                            : `${monthName(selectedDate)} has no slots yet${canChangeSlots ? '. Add some to open it for booking' : ''}.`}
                        </p>
                      )}
                      {canChangeSlots && (
                        <button
                          type="button"
                          onClick={() => setFormModal({ mode: 'create' })}
                          className={`${PRIMARY_BUTTON} mt-4`}
                        >
                          Add slots
                        </button>
                      )}
                    </td>
                  </tr>
                )}

                {!isLoadingSlots &&
                  !slotsError &&
                  slots.map((slot) => {
                    const times = slotTimes(slot);
                    return (
                      <tr key={slot.slotId} className="transition-colors hover:bg-canvas-bg">
                        {isSearching && (
                          <td className="whitespace-nowrap px-5 py-3.5">
                            <button
                              type="button"
                              onClick={() => selectDate(startOfDay(new Date(slot.startTime)))}
                              title="Show this day"
                              className="rounded text-sm font-semibold tabular-nums text-primary underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-secondary"
                            >
                              {formatShortDate(new Date(slot.startTime))}
                            </button>
                          </td>
                        )}
                        <td className="whitespace-nowrap px-5 py-3.5 text-sm font-semibold tabular-nums text-on-surface">
                          {times.label}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 tabular-nums text-on-surface-variant">
                          {times.duration}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5">
                          <span className="rounded-full bg-on-surface/6 px-3 py-1 text-[11px] font-semibold tabular-nums text-on-surface">
                            {slot.slotId}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5">
                          {slot.isAvailable ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-mint-surface px-3 py-1 text-[11px] font-semibold text-primary">
                              <span className="size-1.5 rounded-full bg-secondary" />
                              Available
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-error-container px-3 py-1 text-[11px] font-semibold text-alert-danger">
                              <span className="size-1.5 rounded-full bg-alert-danger" />
                              Unavailable
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-right">
                          <div className="inline-flex items-center justify-end gap-2">
                            {isGridOperator && (
                              <button
                                type="button"
                                onClick={() => runAction(slot.slotId, () => setSlotAvailability(slot.slotId, !slot.isAvailable))}
                                disabled={pendingSlotId === slot.slotId}
                                className={`flex size-8 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-60 ${
                                  slot.isAvailable ? 'text-secondary hover:text-alert-danger' : 'text-outline-variant hover:text-secondary'
                                }`}
                                title={slot.isAvailable ? 'Mark unavailable' : 'Mark available'}
                              >
                                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                                  {slot.isAvailable ? 'toggle_on' : 'toggle_off'}
                                </span>
                              </button>
                            )}
                            {isBackoffice && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setFormModal({ mode: 'edit', slot })}
                                  disabled={pendingSlotId === slot.slotId || !canChangeSlots}
                                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-on-surface-variant"
                                  title={canChangeSlots ? 'Edit slot' : 'Reactivate this station to edit its slots'}
                                  aria-label="Edit slot"
                                >
                                  <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                                    edit
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteTarget(slot)}
                                  disabled={pendingSlotId === slot.slotId}
                                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-outline-variant transition-colors hover:text-alert-danger disabled:opacity-60"
                                  title="Delete slot"
                                  aria-label="Delete slot"
                                >
                                  <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                                    delete
                                  </span>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {formModal?.mode === 'create' && (
        <GenerateSlotsModal station={selectedStation} onClose={() => setFormModal(null)} onSubmit={handleGenerate} />
      )}
      {formModal?.mode === 'edit' && (
        <SlotFormModal
          slot={formModal.slot}
          station={selectedStation}
          onClose={() => setFormModal(null)}
          onSubmit={handleEdit}
        />
      )}

      {deleteTarget && (
        <Modal
          title="Delete Slot?"
          description={`${deleteTarget.slotId} · ${formatShortDate(new Date(deleteTarget.startTime))}, ${slotTimes(deleteTarget).label}`}
          onClose={() => setDeleteTarget(null)}
          maxWidthClassName="max-w-md"
        >
          <p className="mb-space-lg text-body-md text-on-surface-variant">
            This permanently removes the slot. It's blocked if any reservation was ever made against it.
          </p>
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => setDeleteTarget(null)} className={SECONDARY_BUTTON}>
              Cancel
            </button>
            <button type="button" onClick={handleDeleteConfirm} className={DANGER_BUTTON}>
              Delete slot
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
