/* File: AppLayout.jsx
 * Purpose: Shared page chrome for every authenticated screen.
 * ( Sidebar + TopBar + the page content itself. (via React Router's <Outlet/>) ) 
 */

import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

// Maps a route path to the breadcrumb label TopBar shows. 
const BREADCRUMB_LABELS = {
  '/prosumers': 'Prosumer Users',
  '/staff': 'Staff Accounts',
};

export default function AppLayout() {
  const location = useLocation();
  const breadcrumb = BREADCRUMB_LABELS[location.pathname] ?? 'Dashboard';

  return (
    <div className="min-h-screen bg-canvas-bg">
      <Sidebar />
      <TopBar breadcrumb={breadcrumb} />
      <div className="pl-64 pt-16">
        <main className="w-full px-8 py-8 max-w-7xl mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}