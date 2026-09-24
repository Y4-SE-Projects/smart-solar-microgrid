/* File: AppLayout.jsx
 * Purpose: Shared page chrome for every authenticated screen.
 * ( Sidebar + TopBar + the page content itself. (via React Router's <Outlet/>) )
 * Owns the sidebar's collapsed/expanded state, since TopBar and the content
 * offset both need to shift in sync with it.
 */

import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

// Maps a route path to the breadcrumb label TopBar shows.
const BREADCRUMB_LABELS = {
  '/stations': 'Solar Stations & Nodes',
  '/prosumers': 'Prosumer Users',
  '/staff': 'Staff Accounts',
  '/schedules': 'Energy Slot Schedules',
};

export default function AppLayout() {
  const location = useLocation();
  const breadcrumb = BREADCRUMB_LABELS[location.pathname] ?? 'Dashboard';
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-canvas-bg">
      <Sidebar isCollapsed={isSidebarCollapsed} onToggleCollapsed={() => setIsSidebarCollapsed((prev) => !prev)} />
      <TopBar breadcrumb={breadcrumb} isSidebarCollapsed={isSidebarCollapsed} />
      <div className={`pt-16 transition-all duration-200 ${isSidebarCollapsed ? 'pl-20' : 'pl-64'}`}>
        <main className={`w-full px-8 py-8 ${isSidebarCollapsed ? '' : 'max-w-7xl mx-auto'}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}