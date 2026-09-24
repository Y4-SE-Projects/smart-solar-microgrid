/* File: AuthContext.jsx
 * Purpose: App-wide session state (token, role, identifier, fullName).
 *          This is the one piece of state genuinely shared across the whole Web app. 
 *          State is mirrored to localStorage (via authStorage.js) so a page refresh doesn't log the user out.
 */

import { createContext, useContext, useState, useCallback } from 'react';
import { getStoredAuth, setStoredAuth, clearStoredAuth } from '../utils/authStorage';

const AuthContext = createContext(undefined);

// Provider: wraps the whole app. 
// ( Initializes from whatever session, if any, is already sitting in localStorage from a previous visit. )
export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => getStoredAuth());

  // Called after a successful POST /api/users/login. 
  // Accepts the response's "data" object as-is: { token, role, identifier, fullName }.
  const login = useCallback((authData) => {
    setStoredAuth(authData);
    setAuth(authData);
  }, []);

  // Clears session state and storage. Does not navigate. (the Sidebar's Sign Out button) 
  const logout = useCallback(() => {
    clearStoredAuth();
    setAuth(null);
  }, []);

  const value = {
    token: auth?.token ?? null,
    role: auth?.role ?? null,
    identifier: auth?.identifier ?? null,
    fullName: auth?.fullName ?? null,
    isAuthenticated: Boolean(auth?.token),
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Hook: the only way components should read/change auth state.
// Throws loudly if used outside <AuthProvider> rather than silently returning undefined.
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}