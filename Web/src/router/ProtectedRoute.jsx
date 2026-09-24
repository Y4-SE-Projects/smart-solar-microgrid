/* File: ProtectedRoute.jsx
 * Purpose: Route guard used as a layout route in App.jsx. 
 *          Redirects to /login when no session exists. 
 */

import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Roles } from '../constants/roles';

// allowedRoles: optional array of Roles values.
export default function ProtectedRoute({ allowedRoles }) {
  const { isAuthenticated, role } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    // Signed in, but as the wrong role for this area of the app — send them to their own
    // home instead of back to the login form (they're not logged out, just in the wrong place).
    return <Navigate to={role === Roles.GridOperator ? '/schedules' : '/stations'} replace />;
  }

  return <Outlet />;
}