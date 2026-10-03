// File: mapPinIcons.js
// Purpose: Brand-colored map pins shared by station selection and location editing.

function stationPinIcon(color) {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24"><path fill="${color}" stroke="#ffffff" stroke-width="0.7" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`
  )}`;
}

export const ACTIVE_STATION_PIN_ICON = stationPinIcon('#006c4a');
export const DEACTIVATED_STATION_PIN_ICON = stationPinIcon('#ba1a1a');
