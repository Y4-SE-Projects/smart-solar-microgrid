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

// Usernames are encoded in the four staff URLs below, so a character such as "/" or "#" can never change which address is called.

// Updates a staff member's contact details. ( Backoffice only )
// Username and role aren't editable. 
// ( the username is the login identifier, and a role change is a privilege change rather than a profile edit. )
export function updateStaff(username, payload) {
  return apiClient.put(`/users/staff/${encodeURIComponent(username)}`, payload).then((response) => response.data);
}

// Switches off a staff account's access. ( Backoffice only )
// The API refuses this for your own account and for the last active Backoffice account.
export function deactivateStaff(username) {
  return apiClient.put(`/users/staff/${encodeURIComponent(username)}/deactivate`).then((response) => response.data);
}

// Restores a deactivated staff account. ( Backoffice only )
export function reactivateStaff(username) {
  return apiClient.put(`/users/staff/${encodeURIComponent(username)}/reactivate`).then((response) => response.data);
}

// Sets a new password on a staff account. ( Backoffice only )
// The current password isn't required. 
// ( because this is an administrative reset for someone who has forgotten theirs, so the admin has no way of knowing it. )
export function resetStaffPassword(username, newPassword) {
  return apiClient
    .put(`/users/staff/${encodeURIComponent(username)}/password`, { newPassword })
    .then((response) => response.data);
}