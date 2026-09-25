// File: GenerateSlotsModal.jsx
// Purpose: Creates one slot per calendar day in a date range, all sharing one time window.
//          The API skips (rather than fails on) any day that already has a slot at that time.
//          Dates and times are sent as the browser's local wall-clock values together with its
//          UTC offset, so "Sep 25, 08:00" is stored as exactly that moment in the user's zone.
//          The endpoint can also filter by weekday; all 7 are sent so every day in range counts.

import { useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import DateRangeCalendar from '../ui/DateRangeCalendar';

const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_RANGE_DAYS = 366; // matches the API's one-year cap

const STEP_MINUTES = 30;
const LAST_START_MINUTES = 23 * 60; // leaves room for one step before midnight
const LAST_END_MINUTES = 23 * 60 + 30; // the API cannot express an end time of 24:00
const DEFAULT_START_MINUTES = 8 * 60;
const DEFAULT_END_MINUTES = 18 * 60;

function stepsBetween(fromMinutes, toMinutes) {
  const list = [];
  for (let m = fromMinutes; m <= toMinutes; m += STEP_MINUTES) list.push(m);
  return list;
}

const START_OPTIONS = stepsBetween(0, LAST_START_MINUTES);

function minutesToTime(minutes) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDate(date) {
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function TimeSelect({ label, value, options, formatOption, onChange, disabled }) {
  return (
    <label className="relative min-w-0 flex-1">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="h-9 w-full cursor-pointer appearance-none rounded-lg border border-border-slate bg-surface-container-lowest pl-3 pr-8 text-body-md tabular-nums text-on-surface outline-none transition-colors hover:border-outline-variant focus-visible:border-secondary focus-visible:ring-2 focus-visible:ring-secondary/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {options.map((minutes) => (
          <option key={minutes} value={minutes}>
            {formatOption(minutes)}
          </option>
        ))}
      </select>
      <span
        aria-hidden="true"
        className="material-symbols-outlined pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant"
      >
        expand_more
      </span>
    </label>
  );
}

const SECONDARY_BUTTON =
  'h-9 rounded-full px-4 text-xs font-semibold text-on-surface-variant transition-colors hover:bg-on-surface/6 hover:text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-secondary';

const PRIMARY_BUTTON =
  'inline-flex h-9 items-center gap-1.5 rounded-full bg-primary-container px-4 text-xs font-semibold text-on-primary shadow-sm transition-colors hover:bg-primary outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-primary-container';

export default function GenerateSlotsModal({ station, onClose, onSubmit }) {
  const today = useMemo(() => startOfToday(), []);
  const [range, setRange] = useState(undefined);
  const [startMinutes, setStartMinutes] = useState(DEFAULT_START_MINUTES);
  const [endMinutes, setEndMinutes] = useState(DEFAULT_END_MINUTES);
  const [generalError, setGeneralError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { created, skipped } once the API responds

  const from = range?.from;
  const to = range?.to ?? range?.from; // one click already counts as a single-day range
  const dayCount = from ? Math.round((to - from) / MS_PER_DAY) + 1 : 0;

  const stationLabel = station ? `${station.stationId} · ${station.name}` : undefined;
  const startLabel = minutesToTime(startMinutes);
  const endLabel = minutesToTime(endMinutes);
  const endOptions = stepsBetween(startMinutes + STEP_MINUTES, LAST_END_MINUTES);
  const rangeLabel = !from ? '' : dayCount === 1 ? formatDate(from) : `${formatDate(from)} → ${formatDate(to)}`;

  let rangeSummary;
  if (!from) rangeSummary = 'Pick a start date';
  else if (!range.to) rangeSummary = `${formatDate(from)} → pick an end date`;
  else rangeSummary = `${rangeLabel} · ${plural(dayCount, 'day')}`;

  // Moving the start keeps the current duration where it still fits before midnight
  function handleStartChange(next) {
    const duration = endMinutes - startMinutes;
    setStartMinutes(next);
    setEndMinutes(Math.min(next + duration, LAST_END_MINUTES));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!from) return;
    setGeneralError('');
    setIsSubmitting(true);

    try {
      const response = await onSubmit({
        daysOfWeek: ALL_DAYS,
        startTime: startLabel,
        endTime: endLabel,
        rangeStart: from.toISOString(),
        rangeEnd: to.toISOString(),
        utcOffsetMinutes: -from.getTimezoneOffset(),
      });
      setResult(response);
    } catch (error) {
      setGeneralError(error.response?.data?.message || 'Could not create the slots. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (result) {
    const createdCount = result.created.length;
    const skipped = result.skipped;

    return (
      <Modal
        title={createdCount > 0 ? 'Slots Created' : 'No New Slots'}
        description={stationLabel}
        onClose={onClose}
        maxWidthClassName="max-w-md"
      >
        <div className="flex flex-col gap-5 animate-fade-in motion-reduce:animate-none">
          <div className="flex items-start gap-3">
            <span
              className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                createdCount > 0 ? 'bg-mint-surface text-primary' : 'bg-on-surface/6 text-on-surface-variant'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                {createdCount > 0 ? 'check' : 'info'}
              </span>
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-body-md font-semibold text-on-surface">
                {createdCount > 0
                  ? `${plural(createdCount, 'slot')} created`
                  : `All ${plural(skipped.length, 'day')} already had a slot at ${startLabel}`}
              </p>
              <p className="mt-0.5 text-body-sm tabular-nums text-on-surface-variant">
                {rangeLabel} · {startLabel} to {endLabel}
              </p>
            </div>
          </div>

          {createdCount > 0 && skipped.length > 0 && (
            <div>
              <p className="text-label-md font-semibold text-on-surface">
                {skipped.length} skipped, already had a slot at {startLabel}
              </p>
              <ul className="mt-2 max-h-36 divide-y divide-border-slate overflow-y-auto rounded-lg border border-border-slate">
                {skipped.map((s) => (
                  <li key={s.startTime} className="px-3 py-2 text-body-sm tabular-nums text-on-surface-variant">
                    {formatDate(new Date(s.startTime))}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end">
            <button type="button" onClick={onClose} className={PRIMARY_BUTTON}>
              Done
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Add Slots" description={stationLabel} onClose={onClose} maxWidthClassName="max-w-md">
      <form className="flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
        <section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="shrink-0 text-label-md font-semibold text-on-surface">Dates</h3>
            <p className="min-w-0 truncate text-body-sm tabular-nums text-on-surface-variant" aria-live="polite">
              {rangeSummary}
            </p>
          </div>
          <DateRangeCalendar
            value={range}
            onChange={setRange}
            minDate={today}
            maxRangeDays={MAX_RANGE_DAYS}
            disabled={isSubmitting}
          />
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-label-md font-semibold text-on-surface">Time</h3>
          <div className="flex items-center gap-2">
            <TimeSelect
              label="Start time"
              value={startMinutes}
              options={START_OPTIONS}
              formatOption={minutesToTime}
              onChange={handleStartChange}
              disabled={isSubmitting}
            />
            <span className="material-symbols-outlined shrink-0 text-[18px] text-outline" aria-hidden="true">
              arrow_forward
            </span>
            <TimeSelect
              label="End time"
              value={endMinutes}
              options={endOptions}
              formatOption={(minutes) => `${minutesToTime(minutes)}  (${formatDuration(minutes - startMinutes)})`}
              onChange={setEndMinutes}
              disabled={isSubmitting}
            />
          </div>
          <p className="text-body-sm text-on-surface-variant">Days that already have a slot at {startLabel} are skipped.</p>
        </section>

        {generalError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl bg-error-container px-space-md py-space-sm text-body-sm text-on-error-container"
          >
            <span className="material-symbols-outlined mt-0.5 text-[18px]" aria-hidden="true">
              error
            </span>
            <span>{generalError}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className={SECONDARY_BUTTON}>
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting || dayCount === 0} className={PRIMARY_BUTTON}>
            {isSubmitting && (
              <span
                className="material-symbols-outlined animate-spin text-[16px] motion-reduce:animate-none"
                aria-hidden="true"
              >
                progress_activity
              </span>
            )}
            {isSubmitting ? 'Creating slots…' : dayCount > 0 ? `Create ${plural(dayCount, 'slot')}` : 'Create slots'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
