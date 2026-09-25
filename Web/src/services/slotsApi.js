// File: slotsApi.js
// Purpose: Thin wrappers around apiClient for every Slot endpoint this app calls.

import apiClient from './api';

export function fetchSlotsForStation(stationId) {
  return apiClient.get(`/stations/${stationId}/slots`);
}

// Backoffice only. Creates one slot per selected weekday within a date range, skipping any
// day that already has a slot at that time instead of failing the whole request.
export function generateRecurringSlots(stationId, payload) {
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
