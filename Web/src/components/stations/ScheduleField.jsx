// File: ScheduleField.jsx
// Purpose: Operating-hours picker for the station form's `schedule` field, saved as "06:00-22:00".
//          Stations have no weekday rules: the days a station runs are the days it has slots.

import { useMemo, useState } from 'react';
import TimeRangePicker from '../ui/TimeRangePicker';
import { DEFAULT_SCHEDULE, buildSchedule, parseSchedule } from '../../utils/stationSchedule';
import { minutesToTime } from '../../utils/time';

export default function ScheduleField({ value, onChange }) {
  // Parsed once, from the value this field mounted with (a fresh StationFormModal instance
  // is mounted per create/edit, so this never needs to re-run for the same station).
  const initialParsed = useMemo(() => parseSchedule(value), []); // eslint-disable-line react-hooks/exhaustive-deps
  const fallback = parseSchedule(DEFAULT_SCHEDULE);

  const [hours, setHours] = useState(() => {
    const parsed = initialParsed ?? fallback;
    return { start: parsed.opens, end: parsed.closes };
  });

  function handleHoursChange(next) {
    setHours(next);
    onChange(buildSchedule(minutesToTime(next.start), minutesToTime(next.end)));
  }

  return (
    <div className="space-y-2">
      <label className="text-label-md font-medium text-on-surface">Operating hours</label>
      <TimeRangePicker start={hours.start} end={hours.end} onChange={handleHoursChange} startLabel="Opens" endLabel="Closes" />
      {!initialParsed && value ? (
        <p className="text-body-sm text-alert-danger">
          The saved schedule "{value}" has no readable hours. Pick hours above to replace it.
        </p>
      ) : (
        <p className="text-body-sm text-on-surface-variant">
          Slots can only be created inside these hours.
        </p>
      )}
    </div>
  );
}
