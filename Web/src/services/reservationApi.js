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

// Approves or declines a Pending reservation ( GridOperator only ). status is 'Approved' or 'Declined'.
export async function updateReservationStatus(reservationId, status) {
  const response = await apiClient.put(
    `/reservations/${encodeURIComponent(reservationId)}/status`,
    { status }
  );
  return response.data;
}

// Loads one page of reservations for the operator list. Empty filters are left out of the query string.
export async function fetchReservations({
  page,
  pageSize,
  status,
  search,
  stationId,
  dateFrom,
  dateTo,
}) {
  const params = { page, pageSize };

  if (status && status !== 'All') params.status = status;
  if (search) params.search = search;
  if (stationId) params.stationId = stationId;
  if (dateFrom) params.dateFrom = dateFrom;
  if (dateTo) params.dateTo = dateTo;

  const response = await apiClient.get('/reservations', { params });
  return response.data.data;
}
