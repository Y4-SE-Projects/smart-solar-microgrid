/* File: Sidebar.jsx
 * Purpose: Persistent left navigation rail, shared by every authenticated Backoffice/GridOperator screen.
 *          Collapsible to an icon-only rail — AppLayout owns the isCollapsed state so it can
 *          keep TopBar's and the page content's offsets in sync with the sidebar's width.
 */

import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Roles } from '../../constants/roles';

// Nav items this phase actually has pages for.
const NAV_ITEMS = [
  { label: 'Solar Stations & Nodes', to: '/stations', icon: 'solar_power', roles: [Roles.Backoffice] },
  { label: 'Prosumer Users', to: '/prosumers', icon: 'group', roles: [Roles.Backoffice] },
  { label: 'Staff Accounts', to: '/staff', icon: 'badge', roles: [Roles.Backoffice] },
  { label: 'Energy Slot Schedules', to: '/schedules', icon: 'calendar_today' },
  { label: 'Reservation Oversight', to: '/reservations', icon: 'event_available', roles: [Roles.GridOperator] },
];

// Computes the "BA" / "JD"-style initials shown in the footer avatar from the session's fullName.
// Falls back to "?" if fullName is empty.
function getInitials(fullName) {
  if (!fullName) return '?';
  const parts = fullName.trim().split(/\s+/);
  const initials = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '');
  return initials.join('') || '?';
}

export default function Sidebar({ isCollapsed, onToggleCollapsed }) {
  const { role, fullName, identifier, logout } = useAuth();

  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));

  return (
    <aside
      className={`fixed left-0 top-0 h-full ${isCollapsed ? 'w-20' : 'w-64'} bg-surface-container-lowest border-r border-border-slate z-50 flex flex-col justify-between select-none transition-all duration-200`}
    >
      {/* Collapse / expand toggle — overlaps the sidebar's right border so it's reachable in both states */}
      <button
        type="button"
        onClick={onToggleCollapsed}
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="absolute -right-3 top-6 w-6 h-6 rounded-full bg-surface-container-lowest border border-border-slate flex items-center justify-center text-on-surface-variant hover:text-primary hover:border-outline-variant shadow-sm transition-colors"
      >
        <span className="material-symbols-outlined text-[16px]">{isCollapsed ? 'chevron_right' : 'chevron_left'}</span>
      </button>

      <div className="flex flex-col min-w-0">
        {/* Logo Header */}
        <div className={`h-16 flex items-center border-b border-border-slate ${isCollapsed ? 'justify-center px-2' : 'gap-3 px-5'}`}>
          <img alt="HelioGrid Logo" className="w-8 h-8 object-contain rounded-lg shrink-0" src="/logo.svg" />
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-headline-sm text-primary leading-tight font-bold tracking-tight truncate">HelioGrid</span>
              <span className="text-[11px] text-on-surface-variant uppercase tracking-wider font-semibold">
                {role === Roles.GridOperator ? 'Grid Operator' : 'Backoffice Core'}
              </span>
            </div>
          )}
        </div>

        {/* Navigation Section */}
        {!isCollapsed && (
          <div className="px-5 pt-5 pb-2">
            <span className="text-label-sm text-outline uppercase font-semibold tracking-wider">Navigation</span>
          </div>
        )}
        <nav className={`flex flex-col gap-1 ${isCollapsed ? 'px-2 pt-5' : 'px-3'}`}>
          {visibleItems.map((item) =>
            item.disabled ? (
              <span
                key={item.label}
                className={`flex items-center rounded-full text-outline text-sm font-medium cursor-not-allowed opacity-60 ${
                  isCollapsed ? 'justify-center py-2.5' : 'justify-between px-4 py-2.5'
                }`}
                title={isCollapsed ? `${item.label} (Coming soon)` : 'Coming soon'}
              >
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                  {!isCollapsed && <span>{item.label}</span>}
                </span>
              </span>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                title={isCollapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `flex items-center rounded-full text-sm font-medium transition-colors ${
                    isCollapsed ? 'justify-center py-2.5' : 'justify-between px-4 py-2.5'
                  } ${
                    isActive
                      ? 'bg-mint-surface text-primary font-semibold'
                      : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                  }`
                }
              >
                <span className="flex items-center gap-2">
                  {item.icon && <span className="material-symbols-outlined text-[18px]">{item.icon}</span>}
                  {!isCollapsed && <span>{item.label}</span>}
                </span>
              </NavLink>
            )
          )}
        </nav>
      </div>

      {/* User Profile & Sign Out Footer */}
      <div className={`border-t border-border-slate bg-surface-container-lowest flex flex-col gap-3 ${isCollapsed ? 'p-2 items-center' : 'p-4'}`}>
        <div className={`flex items-center gap-3 ${isCollapsed ? '' : 'px-1'}`}>
          <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center text-sm font-bold shrink-0 shadow-sm">
            {getInitials(fullName)}
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm text-on-surface font-semibold leading-tight truncate">{fullName}</span>
              <span className="text-xs text-on-surface-variant truncate">{identifier}</span>
            </div>
          )}
        </div>
        <button
          onClick={logout}
          title={isCollapsed ? 'Sign Out' : undefined}
          className={`flex items-center justify-center gap-2 rounded-full border border-border-slate bg-canvas-bg text-xs font-semibold text-on-surface-variant hover:bg-error-container hover:text-alert-danger hover:border-transparent transition-all ${
            isCollapsed ? 'w-10 h-10 p-0' : 'w-full py-2 px-4'
          }`}
          type="button"
        >
          <span className="material-symbols-outlined text-[16px]">logout</span>
          {!isCollapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
