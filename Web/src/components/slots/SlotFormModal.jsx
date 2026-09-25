// File: SlotFormModal.jsx
// Purpose: Edit form for one existing slot's date and time window (Backoffice only). Laid out
//          like the create dialog: pick a day on the calendar and a time inside the station's
//          operating hours; the API enforces the same hours. Past days can't be picked.
//          Sends UTC instants plus the browser's UTC offset, which the API needs to compare the
//          slot with the station's local operating hours.

import { useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import Calendar from '../ui/Calendar';
import TimeRangePicker from '../ui/TimeRangePicker';
import SlotBlockedNotice from './SlotBlockedNotice';
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '../ui/buttonStyles';
import { parseSchedule, slotBlockReason } from '../../utils/stationSchedule';
import { formatShortDate, isSameDay, minutesOfDay, startOfDay, startOfToday, utcOffsetMinutes } from '../../utils/time';

// A Date at `minutes` past local midnight on `day`
function atMinutes(day, minutes) {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, minutes);
}

export default function SlotFormModal({ slot, station, onClose, onSubmit }) {
  const schedule = useMemo(() => parseSchedule(station?.schedule), [station?.schedule]);
  const blockReason = slotBlockReason(station, schedule);

  const original = useMemo(() => {
    const start = new Date(slot.startTime);
    const end = new Date(slot.endTime);
    return { day: startOfDay(start), start: minutesOfDay(start), end: minutesOfDay(end) };
  }, [slot.startTime, slot.endTime]);

  // Past days can't be picked, but a slot that is already in the past keeps its own day selectable
  const minDate = useMemo(() => {
    const today = startOfToday();
    return original.day < today ? original.day : today;
  }, [original.day]);

  const [day, setDay] = useState(original.day);
  const [times, setTimes] = useState({ start: original.start, end: original.end });
  const [generalError, setGeneralError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const stationLabel = station ? `${station.stationId} · ${station.name}` : undefined;
  const isChanged = !isSameDay(day, original.day) || times.start !== original.start || times.end !== original.end;

  async function handleSubmit(event) {
    event.preventDefault();
    setGeneralError('');
    setIsSubmitting(true);

    const start = atMinutes(day, times.start);
    const end = atMinutes(day, times.end);

    try {
      await onSubmit({
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        utcOffsetMinutes: utcOffsetMinutes(start),
      });
    } catch (error) {
      setGeneralError(error.response?.data?.message || 'Could not save the slot. Please try again.');
      setIsSubmitting(false);
    }
  }

  if (blockReason) {
    return (
      <Modal title="Edit Slot" description={stationLabel} onClose={onClose} maxWidthClassName="max-w-md">
        <SlotBlockedNotice message={blockReason} onClose={onClose} />
      </Modal>
    );
  }

  return (
    <Modal title="Edit Slot" description={stationLabel} onClose={onClose} maxWidthClassName="max-w-md">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3 rounded-full bg-emerald-50 px-3 py-1">
            <h3 className="shrink-0 text-label-md font-semibold text-on-surface">Date</h3>
            <p className="min-w-0 truncate text-body-sm tabular-nums text-on-surface-variant" aria-live="polite">
              {formatShortDate(day)}
            </p>
          </div>
          <Calendar
            mode="single"
            value={day}
            onChange={setDay}
            minDate={minDate}
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
            Open {schedule.openTime} to {schedule.closeTime}. The slot ID stays {slot.slotId}.
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
          <button type="submit" disabled={isSubmitting || !isChanged} className={PRIMARY_BUTTON}>
            {isSubmitting && (
              <span
                className="material-symbols-outlined animate-spin text-[16px] motion-reduce:animate-none"
                aria-hidden="true"
              >
                progress_activity
              </span>
            )}
            {isSubmitting ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
