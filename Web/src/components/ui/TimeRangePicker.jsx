// File: TimeRangePicker.jsx
// Purpose: Start and end time dropdowns in 30-minute steps, limited to [min, max]. The end list
//          only offers times after the start, so an inverted window can't be picked, and moving
//          the start keeps the current duration where it still fits.

import Dropdown from './Dropdown';
import { STEP_MINUTES, LAST_END_MINUTES, formatDuration, minutesToTime, stepsBetween } from '../../utils/time';

// Keeps an off-step value (e.g. 08:15 set through the API) selectable instead of blanking the field
function withValue(steps, value) {
  return steps.includes(value) ? steps : [...steps, value].sort((a, b) => a - b);
}

export default function TimeRangePicker({
  start,
  end,
  onChange,
  min = 0,
  max = LAST_END_MINUTES,
  disabled = false,
  startLabel = 'Start time',
  endLabel = 'End time',
}) {
  const startOptions = withValue(stepsBetween(min, max - STEP_MINUTES), start).map((minutes) => ({
    value: minutes,
    label: minutesToTime(minutes),
  }));

  const endOptions = withValue(stepsBetween(start + STEP_MINUTES, max), end)
    .filter((minutes) => minutes > start)
    .map((minutes) => ({
      value: minutes,
      label: minutesToTime(minutes),
      description: formatDuration(minutes - start),
    }));

  function handleStartChange(next) {
    const duration = end - start;
    onChange({ start: next, end: Math.max(next + STEP_MINUTES, Math.min(next + duration, max)) });
  }

  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <Dropdown label={startLabel} value={start} options={startOptions} onChange={handleStartChange} disabled={disabled} />
      </div>
      <span className="material-symbols-outlined shrink-0 text-[18px] text-outline" aria-hidden="true">
        arrow_forward
      </span>
      <div className="min-w-0 flex-1">
        <Dropdown
          label={endLabel}
          value={end}
          options={endOptions}
          onChange={(next) => onChange({ start, end: next })}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
