// File: App.jsx
// Purpose: Top-level routing. Wraps the app in AuthProvider (session state) and BrowserRouter, then defines every route.

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './router/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import StationsManagementPage from './pages/StationsManagementPage';
import ProsumerManagementPage from './pages/ProsumerManagementPage';
import StaffManagementPage from './pages/StaffManagementPage';
import SlotSchedulesPage from './pages/SlotSchedulesPage';
import { Roles, homePathForRole } from './constants/roles';
import ReservationOversightPage from './pages/ReservationOversightPage';

// "/" is public: a signed-out visitor sees the marketing landing page. A signed-in
// Backoffice/GridOperator is bounced straight to their own console home instead —
// this sits outside the auth guard below, so it has to make that call itself.
function RootRoute() {
  const { isAuthenticated, role } = useAuth();

  if (isAuthenticated) {
    return <Navigate to={homePathForRole(role) ?? '/login'} replace />;
  }

  return <LandingPage />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRoute />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Shared web area: Backoffice and GridOperator both land inside the same chrome,
              but see different nav items and routes per the role table. */}
          <Route element={<ProtectedRoute allowedRoles={[Roles.Backoffice, Roles.GridOperator]} />}>
            <Route element={<AppLayout />}>
              {/* Shared page */}
              <Route path="/schedules" element={<SlotSchedulesPage />} />

              {/* Backoffice-only pages */}
              <Route element={<ProtectedRoute allowedRoles={[Roles.Backoffice]} />}>
                <Route path="/stations" element={<StationsManagementPage />} />
                <Route path="/prosumers" element={<ProsumerManagementPage />} />
                <Route path="/staff" element={<StaffManagementPage />} />
              </Route>

              {/* GridOperator-only pages */}
              <Route element={<ProtectedRoute allowedRoles={[Roles.GridOperator]} />}>
                <Route path="/reservations" element={<ReservationOversightPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;