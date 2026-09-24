// File: App.jsx
// Purpose: Top-level routing. Wraps the app in AuthProvider (session state) and BrowserRouter, then defines every route.

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './router/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import StationsManagementPage from './pages/StationsManagementPage';
import ProsumerManagementPage from './pages/ProsumerManagementPage';
import StaffManagementPage from './pages/StaffManagementPage';
import { Roles } from './constants/roles';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* Backoffice-only area. GridOperator is Web + Mobile per the role table. */}
          <Route element={<ProtectedRoute allowedRoles={[Roles.Backoffice]} />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/stations" replace />} />
              <Route path="/stations" element={<StationsManagementPage />} />
              <Route path="/prosumers" element={<ProsumerManagementPage />} />
              <Route path="/staff" element={<StaffManagementPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;