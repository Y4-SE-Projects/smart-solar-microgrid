/* File: TopBar.jsx
 * Purpose: Fixed header shown above every authenticated page.
 * ( breadcrumb on the left, global search and notification bell together on the right )
 * Its left offset must match the sidebar's current width, so AppLayout passes
 * the same isSidebarCollapsed state down here.
 */

export default function TopBar({ breadcrumb, isSidebarCollapsed }) {
  return (
    <header
      className={`fixed top-0 right-0 h-16 bg-surface-container-lowest/90 backdrop-blur-md border-b border-border-slate z-40 px-8 flex items-center justify-between gap-6 transition-all duration-200 ${
        isSidebarCollapsed ? 'left-20' : 'left-64'
      }`}
    >
      <div className="flex items-center gap-2 text-sm text-on-surface-variant">
        <span className="text-outline">Operations Console</span>
        <span className="text-outline-variant">/</span>
        <span className="text-on-surface font-semibold">{breadcrumb}</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="relative w-72">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-outline">search</span>
          <input
            className="w-full h-9 pl-10 pr-4 rounded-full border border-border-slate bg-canvas-bg text-xs text-on-surface placeholder:text-outline focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-all"
            placeholder="Search stations, nodes, prosumers..."
            type="text"
          />
        </div>
        <button
          aria-label="Notifications"
          className="relative w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors shrink-0"
          type="button"
        >
          <span className="material-symbols-outlined text-[20px]">notifications</span>
          <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
            <span className="relative inline-flex rounded-full h-2 w-2 bg-error"></span>
          </span>
        </button>
      </div>
    </header>
  );
}