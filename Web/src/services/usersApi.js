/* File: usersApi.js
 * Purpose: This file contains all the API calls related to user management, in one place.
 *          Components call these functions instead of holding endpoint strings themselves.
 *          Each function unwraps the API's standard envelope, so callers receive the payload directly.
 * Author: IT23218512
 */

import apiClient from './api';

// Lists every Prosumer account, active and deactivated. ( Backoffice only )
export function getProsumers() {
  return apiClient.get('/users/prosumers').then((response) => response.data.data ?? []);
}

// Lists the deactivated Prosumer accounts that have asked to be restored, oldest request first. ( Backoffice only )
// Note: this is not every deactivated account; an account only appears here once its owner requests reactivation.
export function getReactivationRequests() {
  return apiClient.get('/users/reactivation-requests').then((response) => response.data.data ?? []);
}

// Restores a deactivated Prosumer account.  ( Backoffice only )
// Returns the full response body rather than `data`, since this endpoint replies with a message instead of a payload.
export function reactivateProsumer(nic) {
  return apiClient.put(`/users/${nic}/reactivate`).then((response) => response.data);
}

// Declines a pending reactivation request. ( Backoffice only )
// The account stays deactivated and leaves the queue, but the reason is kept so the Prosumer is told why the next time they try to log in.
export function rejectReactivation(nic, reason) {
  return apiClient
    .put(`/users/${nic}/reject-reactivation`, { reason })
    .then((response) => response.data);
}

// Lists every Backoffice/GridOperator account. ( Backoffice only )
export function getStaff() {
  return apiClient.get('/users/staff').then((response) => response.data.data ?? []);
}

// Creates an account.
// The API keeps Prosumer registration public for the mobile app.
// But requires an authenticated Backoffice caller for the other two roles.
export function registerUser(payload) {
  return apiClient.post('/users/register', payload).then((response) => response.data);
}