// File: stationsApi.js
// Purpose: Thin wrappers around apiClient for every Station endpoint this app calls. Every call already carries the Bearer token via apiClient's request interceptor.

import apiClient from './api';

// Lists every station (active and inactive) so Backoffice can still find and reactivate a deactivated one.
export function fetchStations(activeOnly = false) {
  return apiClient.get(
    '/stations',
    activeOnly ? { params: { activeOnly: true } } : undefined
  );
}

export function createStation(payload) {
  return apiClient.post('/stations', payload);
}

// Full replace — send every field every time, the API has no partial-patch endpoint.
export function updateStation(stationId, payload) {
  return apiClient.put(`/stations/${stationId}`, payload);
}

export function deactivateStation(stationId) {
  return apiClient.put(`/stations/${stationId}/deactivate`);
}

export function reactivateStation(stationId) {
  return apiClient.put(`/stations/${stationId}/reactivate`);
}

export function deleteStation(stationId) {
  return apiClient.delete(`/stations/${stationId}`);
}
