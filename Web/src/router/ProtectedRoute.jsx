/* File: ProtectedRoute.jsx
 * Purpose: Route guard used as a layout route in App.jsx. 
 *          Redirects to /login when no session exists. 
 */

import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// allowedRoles: optional array of Roles values. 
export default function ProtectedRoute({ allowedRoles }) {
  const { isAuthenticated, role } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    // Signed in, but as the wrong role for this area of the app.
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}