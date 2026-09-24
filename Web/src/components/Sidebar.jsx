/* File: Sidebar.jsx
 * Purpose: Persistent left navigation rail, shared by every authenticated Backoffice/GridOperator screen. 
 */

import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Roles } from '../../constants/roles';

// Nav items this phase actually has pages for. 
const NAV_ITEMS = [
  { label: 'Solar Stations & Nodes', disabled: true },
  { label: 'Prosumer Users', to: '/prosumers', icon: 'group', roles: [Roles.Backoffice] },
  { label: 'Staff Accounts', to: '/staff', icon: 'badge', roles: [Roles.Backoffice] },
  { label: 'Energy Slot Schedules', disabled: true },
  { label: 'Reservation Oversight', disabled: true },
];

// Computes the "BA" / "JD"-style initials shown in the footer avatar from the session's fullName. 
// Falls back to "?" if fullName is empty.
function getInitials(fullName) {
  if (!fullName) return '?';
  const parts = fullName.trim().split(/\s+/);
  const initials = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '');
  return initials.join('') || '?';
}

export default function Sidebar() {
  const { role, fullName, identifier, logout } = useAuth();

  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-surface-container-lowest border-r border-border-slate z-50 flex flex-col justify-between select-none">
      <div className="flex flex-col">
        {/* Logo Header */}
        <div className="h-16 px-5 flex items-center gap-3 border-b border-border-slate">
          <img alt="HelioGrid Logo" className="w-8 h-8 object-contain rounded-lg" src="/logo.svg" />
          <div className="flex flex-col min-w-0">
            <span className="text-headline-sm text-primary leading-tight font-bold tracking-tight truncate">HelioGrid</span>
            <span className="text-[11px] text-on-surface-variant uppercase tracking-wider font-semibold">
              {role === Roles.GridOperator ? 'Grid Operator' : 'Backoffice Core'}
            </span>
          </div>
        </div>

        {/* Navigation Section */}
        <div className="px-5 pt-5 pb-2">
          <span className="text-label-sm text-outline uppercase font-semibold tracking-wider">Navigation</span>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {visibleItems.map((item) =>
            item.disabled ? (
              <span
                key={item.label}
                className="flex items-center justify-between px-4 py-2.5 rounded-full text-outline text-sm font-medium cursor-not-allowed opacity-60"
                title="Coming soon"
              >
                <span>{item.label}</span>
              </span>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center justify-between px-4 py-2.5 rounded-full text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-mint-surface text-primary font-semibold'
                      : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                  }`
                }
              >
                <span className="flex items-center gap-2">
                  {item.icon && <span className="material-symbols-outlined text-[18px]">{item.icon}</span>}
                  <span>{item.label}</span>
                </span>
              </NavLink>
            )
          )}
        </nav>
      </div>

      {/* User Profile & Sign Out Footer */}
      <div className="p-4 border-t border-border-slate bg-surface-container-lowest flex flex-col gap-3">
        <div className="flex items-center gap-3 px-1">
          <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center text-sm font-bold shrink-0 shadow-sm">
            {getInitials(fullName)}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm text-on-surface font-semibold leading-tight truncate">{fullName}</span>
            <span className="text-xs text-on-surface-variant truncate">{identifier}</span>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center justify-center gap-2 w-full py-2 px-4 rounded-full border border-border-slate bg-canvas-bg text-xs font-semibold text-on-surface-variant hover:bg-error-container hover:text-alert-danger hover:border-transparent transition-all"
          type="button"
        >
          <span className="material-symbols-outlined text-[16px]">logout</span>
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}