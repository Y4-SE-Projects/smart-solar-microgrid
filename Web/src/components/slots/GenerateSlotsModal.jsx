// File: GenerateSlotsModal.jsx
// Purpose: Creates one slot per calendar day in a date range, all sharing one time window.
//          The API skips (rather than fails on) any day where the window overlaps an existing slot.
//          Dates and times are sent as the browser's local wall-clock values together with its
//          UTC offset, so "Sep 25, 08:00" is stored as exactly that moment in the user's zone.
//          Times are limited to the station's operating hours; the API enforces the same rule.
//          The endpoint can also filter by weekday; all 7 are sent so every day in range counts.

import { useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import Calendar from '../ui/Calendar';
import TimeRangePicker from '../ui/TimeRangePicker';
import SlotBlockedNotice from './SlotBlockedNotice';
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../ui/buttonStyles';
import { parseSchedule, slotBlockReason } from '../../utils/stationSchedule';
import { formatShortDate, minutesToTime, plural, startOfToday, utcOffsetMinutes } from '../../utils/time';

const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_RANGE_DAYS = 366; // matches the API's one-year cap
const DEFAULT_START = 8 * 60;
const DEFAULT_END = 18 * 60;

// 08:00 to 18:00 where the station's hours allow it, otherwise its full opening hours
function defaultWindow(schedule) {
  if (!schedule) return { start: DEFAULT_START, end: DEFAULT_END };
  const start = DEFAULT_START >= schedule.opens && DEFAULT_START < schedule.closes ? DEFAULT_START : schedule.opens;
  const end = DEFAULT_END > start && DEFAULT_END <= schedule.closes ? DEFAULT_END : schedule.closes;
  return { start, end };
}

export default function GenerateSlotsModal({ station, onClose, onSubmit }) {
  const today = useMemo(() => startOfToday(), []);
  const schedule = useMemo(() => parseSchedule(station?.schedule), [station?.schedule]);
  const blockReason = slotBlockReason(station, schedule);

  const [range, setRange] = useState(undefined);
  const [times, setTimes] = useState(() => defaultWindow(schedule));
  const [generalError, setGeneralError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { created, skipped } once the API responds

  const from = range?.from;
  const to = range?.to ?? range?.from; // one click already counts as a single-day range
  const dayCount = from ? Math.round((to - from) / MS_PER_DAY) + 1 : 0;

  const stationLabel = station ? `${station.stationId} · ${station.name}` : undefined;
  const startLabel = minutesToTime(times.start);
  const endLabel = minutesToTime(times.end);
  const rangeLabel = !from ? '' : dayCount === 1 ? formatShortDate(from) : `${formatShortDate(from)} → ${formatShortDate(to)}`;

  let rangeSummary;
  if (!from) rangeSummary = 'Pick a start date';
  else if (!range.to) rangeSummary = `${formatShortDate(from)} → pick an end date`;
  else rangeSummary = `${rangeLabel} · ${plural(dayCount, 'day')}`;

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
        utcOffsetMinutes: utcOffsetMinutes(from),
      });
      setResult(response);
    } catch (error) {
      setGeneralError(error.response?.data?.message || 'Could not create the slots. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (blockReason) {
    return (
      <Modal title="Add Slots" description={stationLabel} onClose={onClose} maxWidthClassName="max-w-md">
        <SlotBlockedNotice message={blockReason} onClose={onClose} />
      </Modal>
    );
  }

  if (result) {
    const createdCount = result.created.length;
    const existing = result.skipped;

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
                  : existing.length === 1
                    ? 'That day already has a slot in this time'
                    : `All ${plural(existing.length, 'day')} already have slots in this time`}
              </p>
              <p className="mt-0.5 text-body-sm tabular-nums text-on-surface-variant">
                {rangeLabel} · {startLabel} to {endLabel}
              </p>
            </div>
          </div>

          {existing.length > 0 && (
            <div>
              <p className="text-label-md font-semibold text-on-surface">
                {plural(existing.length, 'day')} skipped
              </p>
              <ul className="mt-2 max-h-36 divide-y divide-border-slate overflow-y-auto rounded-lg border border-border-slate">
                {existing.map((s) => (
                  <li
                    key={s.startTime}
                    className="flex items-baseline justify-between gap-3 px-3 py-2 text-body-sm tabular-nums"
                  >
                    <span className="shrink-0 font-medium text-on-surface">{formatShortDate(new Date(s.startTime))}</span>
                    <span className="min-w-0 truncate text-on-surface-variant">{s.reason}</span>
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
      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3 rounded-full bg-emerald-50 px-3 py-1">
            <h3 className="shrink-0 text-label-md font-semibold text-on-surface">Dates</h3>
            <p className="min-w-0 truncate text-body-sm tabular-nums text-on-surface-variant" aria-live="polite">
              {rangeSummary}
            </p>
          </div>
          <Calendar
            mode="range"
            value={range}
            onChange={setRange}
            minDate={today}
            maxRangeDays={MAX_RANGE_DAYS}
            disabled={isSubmitting}
          />
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-label-md font-semibold text-on-surface">Time</h3>
          <TimeRangePicker
            start={times.start}
            end={times.end}
            onChange={setTimes}
            min={schedule.opens}
            max={schedule.closes}
            disabled={isSubmitting}
          />
          <p className="text-body-sm text-on-surface-variant">
            Open {schedule.openTime} to {schedule.closeTime}. Days where this overlaps an existing slot are skipped.
          </p>
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
