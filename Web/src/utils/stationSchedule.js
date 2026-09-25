// File: stationSchedule.js
// Purpose: Reads and writes a station's operating hours, stored in its `schedule` field as "06:00-22:00".
//          Mirrors the API's StationSchedule parser, which is what actually enforces it; the UI uses
//          this only to limit which times can be picked before the server is asked.

import { timeToMinutes } from './time';

export const DEFAULT_SCHEDULE = '06:00-22:00';

// Finds the first "HH:mm-HH:mm" window, so older text such as "Mon-Sun 06:00-22:00" still reads.
// Returns null when there's no window, or it closes at or before it opens.
export function parseSchedule(text) {
  const match = text?.match(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
  if (!match) return null;
  const [, openTime, closeTime] = match;
  const opens = timeToMinutes(openTime);
  const closes = timeToMinutes(closeTime);
  if (opens >= closes) return null;
  return { openTime, closeTime, opens, closes };
}

export function buildSchedule(openTime, closeTime) {
  return `${openTime}-${closeTime}`;
}

// Why a station can't take slot changes, or null when it can. The API enforces the same two rules.
export function slotBlockReason(station, schedule) {
  if (!station) return null;
  if (!station.isActive) {
    return `${station.stationId} is deactivated. Reactivate it on the Stations page before adding or editing its slots.`;
  }
  if (!schedule) {
    return `${station.stationId}'s schedule ("${station.schedule}") has no operating hours. Edit the station to set them first.`;
  }
  return null;
}
