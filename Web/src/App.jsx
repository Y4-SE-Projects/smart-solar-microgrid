// File: App.jsx
// Purpose: Top-level routing. Wraps the app in AuthProvider (session state) and BrowserRouter, then defines every route.

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './router/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import StationsManagementPage from './pages/StationsManagementPage';
import ProsumerManagementPage from './pages/ProsumerManagementPage';
import StaffManagementPage from './pages/StaffManagementPage';
import SlotSchedulesPage from './pages/SlotSchedulesPage';
import { Roles, homePathForRole } from './constants/roles';
import ReservationOversightPage from './pages/ReservationOversightPage';

// "/" has no single fixed destination anymore. 
// Backoffice and GridOperator land on different home pages, so this picks the right one.
function RoleHomeRedirect() {
  const { role } = useAuth();

  // This route already sits behind the guard below, which turns away any role without a console home. 
  // The fallback is only here so a null could never reach <Navigate> as a destination.
  return <Navigate to={homePathForRole(role) ?? '/login'} replace />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* Shared web area: Backoffice and GridOperator both land inside the same chrome,
              but see different nav items and routes per the role table. */}
          <Route element={<ProtectedRoute allowedRoles={[Roles.Backoffice, Roles.GridOperator]} />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<RoleHomeRedirect />} />

              {/* Shared page: Backoffice manages slot time windows, GridOperator manages
                  availability — the API gates each action separately, the page mirrors that. */}
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