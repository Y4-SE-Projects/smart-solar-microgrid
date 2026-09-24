// File: ScheduleField.jsx
// Purpose: Day-picker + time-picker replacement for the station form's free-text "schedule" input.

import { useMemo, useState } from 'react';
import { inputClass } from './formStyles';

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Recognizes "Mon-Fri 08:00-18:00", "Sat 10:00-14:00" and "Mon, Wed, Fri 08:00-18:00".
// Returns null for anything else (older free-typed text), so the raw text is left alone
// until the user actually picks new days/times through this widget.
function parseSchedule(text) {
  if (!text) return null;
  const match = text.trim().match(/^(.+?)\s+(\d{2}:\d{2})-(\d{2}:\d{2})$/);
  if (!match) return null;
  const [, dayPart, openTime, closeTime] = match;

  const normalizeDay = (raw) => WEEK_DAYS.find((d) => d.toLowerCase() === raw.trim().toLowerCase()) ?? null;

  let days;
  if (dayPart.includes('-') && !dayPart.includes(',')) {
    const [startRaw, endRaw] = dayPart.split('-');
    const start = normalizeDay(startRaw);
    const end = normalizeDay(endRaw);
    if (!start || !end) return null;
    const startIdx = WEEK_DAYS.indexOf(start);
    const endIdx = WEEK_DAYS.indexOf(end);
    if (endIdx < startIdx) return null;
    days = WEEK_DAYS.slice(startIdx, endIdx + 1);
  } else {
    days = dayPart.split(',').map(normalizeDay);
    if (days.some((d) => !d)) return null;
  }

  return { days, openTime, closeTime };
}

// Mirrors parseSchedule: collapses a day selection back down to the shortest readable form —
// a range when the days are consecutive in week order, otherwise a comma list.
function buildSchedule(days, openTime, closeTime) {
  if (days.length === 0 || !openTime || !closeTime) return '';

  const sorted = WEEK_DAYS.filter((d) => days.includes(d));
  const indices = sorted.map((d) => WEEK_DAYS.indexOf(d));
  const isContiguous = indices.every((idx, i) => i === 0 || idx === indices[i - 1] + 1);

  const dayPart =
    sorted.length === 1 ? sorted[0] : isContiguous ? `${sorted[0]}-${sorted[sorted.length - 1]}` : sorted.join(', ');

  return `${dayPart} ${openTime}-${closeTime}`;
}

export default function ScheduleField({ value, onChange }) {
  // Parsed once, from the value this field mounted with (a fresh StationFormModal instance
  // is mounted per create/edit, so this never needs to re-run for the same station).
  const initialParsed = useMemo(() => parseSchedule(value), []); // eslint-disable-line react-hooks/exhaustive-deps

  const [days, setDays] = useState(() => initialParsed?.days ?? []);
  const [openTime, setOpenTime] = useState(() => initialParsed?.openTime ?? '');
  const [closeTime, setCloseTime] = useState(() => initialParsed?.closeTime ?? '');

  // Only reports a new value once the selection is actually complete — an in-progress
  // selection never overwrites whatever schedule text the form already had.
  function commit(nextDays, nextOpenTime, nextCloseTime) {
    const composed = buildSchedule(nextDays, nextOpenTime, nextCloseTime);
    if (composed) onChange(composed);
  }

  function toggleDay(day) {
    const nextDays = days.includes(day) ? days.filter((d) => d !== day) : [...days, day];
    setDays(nextDays);
    commit(nextDays, openTime, closeTime);
  }

  function handleOpenTimeChange(next) {
    setOpenTime(next);
    commit(days, next, closeTime);
  }

  function handleCloseTimeChange(next) {
    setCloseTime(next);
    commit(days, openTime, next);
  }

  const preview = buildSchedule(days, openTime, closeTime);

  return (
    <div className="space-y-2">
      <label className="text-label-md font-medium text-on-surface">Schedule</label>

      <div className="flex flex-wrap gap-1.5">
        {WEEK_DAYS.map((day) => (
          <button
            key={day}
            type="button"
            onClick={() => toggleDay(day)}
            aria-pressed={days.includes(day)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              days.includes(day)
                ? 'bg-primary-container text-on-primary border-primary-container'
                : 'bg-canvas-bg text-on-surface-variant border-border-slate hover:border-outline-variant'
            }`}
          >
            {day}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-space-md">
        <div className="space-y-1">
          <span className="text-label-sm text-on-surface-variant">Opens</span>
          <input type="time" className={inputClass} value={openTime} onChange={(e) => handleOpenTimeChange(e.target.value)} />
        </div>
        <div className="space-y-1">
          <span className="text-label-sm text-on-surface-variant">Closes</span>
          <input type="time" className={inputClass} value={closeTime} onChange={(e) => handleCloseTimeChange(e.target.value)} />
        </div>
      </div>

      {preview ? (
        <p className="text-body-sm text-on-surface-variant">
          Will be saved as <span className="font-semibold text-on-surface">{preview}</span>
        </p>
      ) : (
        <p className="text-body-sm text-alert-danger">Select at least one day and both times.</p>
      )}

      {!initialParsed && value && (
        <p className="text-body-sm text-outline">Current schedule text: "{value}" — pick days/times above to replace it.</p>
      )}
    </div>
  );
}
