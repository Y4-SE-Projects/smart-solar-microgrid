/* File: authStorage.js
 * Purpose: Single place that reads/writes the persisted auth session (token, role, identifier, fullName) to localStorage. 
 * Both AuthContext (React state) and api.js (the Axios interceptor) need the same session data. 
 * Avoids the two ever drifting out of sync.
 */

const STORAGE_KEY = 'heliogrid_auth';

// Reads the persisted session. 
// Returns null if nothing is stored, or if what's stored is corrupted/unparsable.
export function getStoredAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Persists the session. 
// Expects the shape returned by POST /api/users/login's "data" field: { token, role, identifier, fullName }.
export function setStoredAuth(auth) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
}

// Clears the session (logout, or a 401 forcing a re-login).
export function clearStoredAuth() {
  localStorage.removeItem(STORAGE_KEY);
}