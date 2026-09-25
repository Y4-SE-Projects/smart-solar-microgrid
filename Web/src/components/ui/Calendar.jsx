// File: Calendar.jsx
// Purpose: The app's month calendar, for picking one date (mode="single") or a range (mode="range").
//          react-day-picker owns the selection logic, keyboard navigation and ARIA, but its default
//          stylesheet is not loaded and the day cells are rendered here, so only the app's own
//          tokens are used.
//          Range mode: click a start day, then an end day. While waiting for the end day, hovering
//          previews the range; clicking again after a range is complete starts a new one.

import { useState } from 'react';
import { DayPicker, Day, DayButton } from 'react-day-picker';
import { isSameDay } from '../../utils/time';

function ordered(a, b) {
  return a <= b ? [a, b] : [b, a];
}

// Half-width band on the endpoint cells so a range reads as one continuous strip that starts and
// ends at the centre of the endpoint circles. Rounded where a week row begins or ends.
const ROW_EDGES = 'first:rounded-l-full last:rounded-r-full';
const BAND = {
  middle: `bg-mint-surface ${ROW_EDGES}`,
  start: `bg-linear-to-r from-transparent from-50% to-mint-surface to-50% ${ROW_EDGES}`,
  end: `bg-linear-to-l from-transparent from-50% to-mint-surface to-50% ${ROW_EDGES}`,
  previewMiddle: `bg-mint-surface/45 ${ROW_EDGES}`,
  previewStart: `bg-linear-to-r from-transparent from-50% to-mint-surface/45 to-50% ${ROW_EDGES}`,
  previewEnd: `bg-linear-to-l from-transparent from-50% to-mint-surface/45 to-50% ${ROW_EDGES}`,
};

// Wraps the library's Day cell (which strips its internal props before rendering the <td>)
// and paints the range band on the cell itself, behind the day button.
function CalendarDay(props) {
  const { modifiers } = props;

  let band = '';
  if (!modifiers.hidden) {
    if (modifiers.band_middle) band = BAND.middle;
    else if (modifiers.band_start) band = BAND.start;
    else if (modifiers.band_end) band = BAND.end;
    else if (modifiers.preview_middle) band = BAND.previewMiddle;
    else if (modifiers.preview_start) band = BAND.previewStart;
    else if (modifiers.preview_end) band = BAND.previewEnd;
  }

  return <Day {...props} className={`h-9 p-0 ${band}`} />;
}

// Wraps the library's DayButton so its focus handling (keyboard navigation) is kept, with every
// visual state decided here in one ordered chain instead of competing CSS classes.
function CalendarDayButton(props) {
  const { modifiers } = props;

  let state;
  if (modifiers.disabled) {
    state = 'text-outline-variant cursor-not-allowed';
  } else if (modifiers.endpoint) {
    state = 'bg-primary-container text-on-primary font-semibold hover:bg-primary';
  } else if (modifiers.preview_endpoint) {
    state = 'text-primary font-semibold ring-1 ring-inset ring-secondary';
  } else if (modifiers.band_middle || modifiers.preview_middle) {
    state = 'text-primary hover:bg-on-surface/6';
  } else if (modifiers.marked) {
    state = 'bg-mint-surface text-primary font-semibold hover:bg-secondary-container';
  } else if (modifiers.today) {
    state = 'text-secondary font-semibold hover:bg-on-surface/6';
  } else {
    state = 'text-on-surface hover:bg-on-surface/6';
  }

  // Small dot under today's number, in whatever colour the number is
  const todayMark = modifiers.today
    ? 'after:absolute after:bottom-1 after:left-1/2 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-current'
    : '';

  return (
    <DayButton
      {...props}
      className={`relative mx-auto flex size-9 items-center justify-center rounded-full text-body-md tabular-nums outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-1 ${state} ${todayMark}`}
    />
  );
}

function CalendarChevron({ orientation }) {
  return (
    <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
      {orientation === 'left' ? 'chevron_left' : 'chevron_right'}
    </span>
  );
}

// overflow-hidden: until the icon font loads, the ligature text is wide and would cover the other arrow
const NAV_BUTTON =
  'inline-flex size-8 items-center justify-center overflow-hidden rounded-full text-on-surface-variant transition-colors hover:bg-on-surface/6 hover:text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-secondary aria-disabled:pointer-events-none aria-disabled:opacity-30 disabled:pointer-events-none disabled:opacity-30';

const CLASS_NAMES = {
  root: 'w-full',
  months: 'relative',
  month: 'w-full',
  month_caption: 'flex h-8 items-center pl-1',
  caption_label: 'text-title-md font-semibold text-on-surface',
  nav: 'absolute right-0 top-0 flex h-8 items-center gap-0.5',
  button_previous: NAV_BUTTON,
  button_next: NAV_BUTTON,
  month_grid: 'mt-2 w-full table-fixed border-separate border-spacing-x-0 border-spacing-y-1',
  weekday: 'h-7 text-label-sm font-semibold uppercase text-on-surface-variant',
};

const COMPONENTS = { Day: CalendarDay, DayButton: CalendarDayButton, Chevron: CalendarChevron };

export default function Calendar({
  mode = 'single',
  value,
  onChange,
  minDate,
  maxRangeDays,
  markedDays,
  disabled = false,
  month,
  onMonthChange,
}) {
  const [hoverDate, setHoverDate] = useState(null);
  const isRange = mode === 'range';

  const from = isRange ? value?.from : value;
  const to = isRange ? value?.to : value;
  const committed = isRange && from && to && !isSameDay(from, to) ? [from, to] : null;
  const preview = isRange && from && !to && hoverDate && !isSameDay(hoverDate, from) ? ordered(from, hoverDate) : null;

  // Custom modifiers drive every visual state in CalendarDay / CalendarDayButton above
  const modifiers = {
    endpoint: from ? (to && !isSameDay(from, to) ? [from, to] : [from]) : false,
    preview_endpoint: preview ? hoverDate : false,
    band_start: committed ? committed[0] : false,
    band_end: committed ? committed[1] : false,
    band_middle: committed ? { after: committed[0], before: committed[1] } : false,
    preview_start: preview ? preview[0] : false,
    preview_end: preview ? preview[1] : false,
    preview_middle: preview ? { after: preview[0], before: preview[1] } : false,
    marked: markedDays?.length ? markedDays : false, // e.g. days that already have slots
  };

  const selectionProps = isRange
    ? { mode: 'range', required: true, resetOnSelect: true, max: maxRangeDays, selected: value, onSelect: onChange }
    : { mode: 'single', required: true, selected: value, onSelect: onChange };

  // Controlled month when the parent needs to move the view (e.g. a "Today" button)
  const monthProps = month ? { month, onMonthChange } : { defaultMonth: from ?? minDate };

  return (
    <DayPicker
      {...selectionProps}
      {...monthProps}
      disabled={disabled ? true : minDate ? { before: minDate } : undefined}
      startMonth={minDate}
      weekStartsOn={1}
      fixedWeeks
      showOutsideDays={false}
      modifiers={modifiers}
      onDayMouseEnter={isRange ? (date, dayModifiers) => setHoverDate(dayModifiers.disabled ? null : date) : undefined}
      onDayMouseLeave={isRange ? () => setHoverDate(null) : undefined}
      classNames={CLASS_NAMES}
      components={COMPONENTS}
    />
  );
}
