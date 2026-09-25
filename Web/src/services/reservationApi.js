// File: reservationApi.js
// Purpose: reservation lifecycle API calls.

import apiClient from './api';

export async function createReservation(request) {
  const response = await apiClient.post('/reservations', request);
  return response.data;
}

export async function updateReservation(reservationId, request) {
  const response = await apiClient.put(
    `/reservations/${encodeURIComponent(reservationId)}`,
    request
  );
  return response.data;
}

export async function cancelReservation(reservationId) {
  const response = await apiClient.put(
    `/reservations/${encodeURIComponent(reservationId)}/cancel`
  );
  return response.data;
}