/* File: AppLayout.jsx
 * Purpose: Shared page chrome for every authenticated screen.
 * Sidebar and page content via React Router's Outlet.
 * Owns the sidebar's collapsed state and the matching content offset.
 */

import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

const COMPACT_NAV_QUERY = '(max-width: 767px)';

export default function AppLayout() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    () => window.matchMedia(COMPACT_NAV_QUERY).matches
  );

  useEffect(() => {
    const media = window.matchMedia(COMPACT_NAV_QUERY);
    const handleResize = (event) => setIsSidebarCollapsed(event.matches);
    media.addEventListener('change', handleResize);
    return () => media.removeEventListener('change', handleResize);
  }, []);

  function handleNavigate() {
    if (window.matchMedia(COMPACT_NAV_QUERY).matches) setIsSidebarCollapsed(true);
  }

  return (
    <div className="min-h-screen bg-canvas-bg">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapsed={() => setIsSidebarCollapsed((prev) => !prev)}
        onNavigate={handleNavigate}
      />
      <div className={`pl-20 transition-all duration-200 ${isSidebarCollapsed ? '' : 'md:pl-64'}`}>
        <main className="mx-auto w-full max-w-7xl px-5 py-8 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
