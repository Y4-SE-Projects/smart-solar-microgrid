/* File: ProtectedRoute.jsx
 * Purpose: Route guard used as a layout route in App.jsx.
 *          Redirects to /login when no session exists, and away from screens the signed-in role isn't allowed on.
 */

import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { homePathForRole } from '../constants/roles';

// allowedRoles: optional array of Roles values.
export default function ProtectedRoute({ allowedRoles }) {
  const { isAuthenticated, role } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    const home = homePathForRole(role);

    // No home means the stored role has no console screens, so there is nowhere inside the app to bounce to.  
    // So, /login is the only route outside the guard, so it's the only way out. 
    // The login screen can clear the session and say what happened.
    if (!home) {
      return <Navigate to="/login" replace state={{ reason: 'ROLE_NOT_SUPPORTED' }} />;
    }

    // Signed in, but as the wrong role for this area of the app. 
    // Send them to their own home instead of back to the login form.
    return <Navigate to={home} replace />;
  }

  return <Outlet />;
}