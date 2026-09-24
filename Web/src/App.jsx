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
import { Roles } from './constants/roles';

// "/" has no single fixed destination anymore — Backoffice and GridOperator each land
// on a different home page, so this picks the right one from the logged-in session.
function RoleHomeRedirect() {
  const { role } = useAuth();
  return <Navigate to={role === Roles.GridOperator ? '/schedules' : '/stations'} replace />;
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
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;