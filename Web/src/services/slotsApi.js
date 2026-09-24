// File: slotsApi.js
// Purpose: Thin wrappers around apiClient for every Slot endpoint this app calls.

import apiClient from './api';

export function fetchSlotsForStation(stationId) {
  return apiClient.get(`/stations/${stationId}/slots`);
}

// Backoffice only.
export function createSlot(stationId, payload) {
  return apiClient.post(`/stations/${stationId}/slots`, payload);
}

// Backoffice only.
export function updateSlot(slotId, payload) {
  return apiClient.put(`/slots/${slotId}`, payload);
}

// Grid Operator only.
export function setSlotAvailability(slotId, isAvailable) {
  return apiClient.put(`/slots/${slotId}/availability`, { isAvailable });
}

// Backoffice only.
export function deleteSlot(slotId) {
  return apiClient.delete(`/slots/${slotId}`);
}
