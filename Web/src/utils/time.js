// File: time.js
// Purpose: Date and minute-of-day helpers shared by the calendars, time pickers and slot screens.

export const STEP_MINUTES = 30;
export const LAST_END_MINUTES = 23 * 60 + 30; // the API cannot express an end time of 24:00

export function stepsBetween(fromMinutes, toMinutes) {
  const list = [];
  for (let m = fromMinutes; m <= toMinutes; m += STEP_MINUTES) list.push(m);
  return list;
}

export function minutesToTime(minutes) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

export function timeToMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function minutesOfDay(date) {
  return date.getHours() * 60 + date.getMinutes();
}

export function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

export function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function startOfToday() {
  return startOfDay(new Date());
}

export function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// "2026-09" in local time, the format the API's month filter expects
export function toMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function formatShortDate(date) {
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatLongDate(date) {
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

// The browser's offset from UTC on this date, in minutes east of UTC (330 for Sri Lanka)
export function utcOffsetMinutes(date) {
  return -date.getTimezoneOffset();
}

export function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}
