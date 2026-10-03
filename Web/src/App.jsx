// File: App.jsx
// Purpose: Top-level routing. Wraps the app in AuthProvider (session state) and BrowserRouter, then defines every route.

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
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
        <Toaster
          position="top-center"
          containerStyle={{ top: 20, zIndex: 120 }}
          toastOptions={{
            duration: 4000,
            style: {
              background: '#000',
              color: '#fff',
              border: '1px solid #222',
              borderRadius: '12px',
              boxShadow: '0 6px 18px rgba(0, 0, 0, 0.28)',
              fontFamily: 'Inter, sans-serif',
              fontSize: '14px',
              lineHeight: 1.45,
              padding: '12px 16px',
              maxWidth: 'min(520px, calc(100vw - 32px))',
            },
            success: {
              duration: 3500,
              iconTheme: {
                primary: 'var(--color-secondary-container)',
                secondary: '#000',
              },
            },
            // Errors carry the server's own wording, which runs much longer than a success
            // line. They get a wider box and a smaller type size so the message stays on a
            // couple of lines instead of becoming a tall wrapped block.
            error: {
              duration: 5000,
              style: {
                fontSize: '13px',
                maxWidth: 'min(640px, calc(100vw - 32px))',
                padding: '12px 18px',
              },
              iconTheme: {
                primary: 'var(--color-error)',
                secondary: '#fff',
              },
            },
          }}
        />
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
