// File: StationsManagementPage.jsx
// Purpose: Backoffice screen for microgrid station management

import { useEffect, useMemo, useState } from 'react';
import {
  fetchStations,
  createStation,
  updateStation,
  deactivateStation,
  reactivateStation,
  deleteStation,
} from '../services/stationsApi';
import StationFormModal from '../components/stations/StationFormModal';
import Modal from '../components/ui/Modal';

const SORT_OPTIONS = [
  { value: 'stationId', label: 'Station ID (Ascending)' },
  { value: 'capacityDesc', label: 'Capacity (Highest)' },
  { value: 'batterySlotsDesc', label: 'Battery Slots (Most)' },
];

export default function StationsManagementPage() {
  const [stations, setStations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | active | inactive
  const [sortBy, setSortBy] = useState('stationId');

  const [formModal, setFormModal] = useState(null); // null | { mode: 'create' } | { mode: 'edit', station }
  const [deleteTarget, setDeleteTarget] = useState(null); // station pending delete confirmation
  const [pendingActionId, setPendingActionId] = useState(null); // stationId currently mid-request
  const [actionError, setActionError] = useState(null); // { stationId, message } | null

  // Re-fetches the station list
  async function reload() {
    setIsLoading(true);
    setLoadError('');
    try {
      const response = await fetchStations();
      setStations(response.data.data);
    } catch (error) {
      setLoadError(error.response?.data?.message || 'Could not load stations from the server.');
    } finally {
      setIsLoading(false);
    }
  }

  // Initial load. isLoading/loadError already start at their "loading" defaults, so this only
  // needs to update them once the request actually settles — no setState synchronously in the effect body.
  useEffect(() => {
    let cancelled = false;

    fetchStations()
      .then((response) => {
        if (!cancelled) setStations(response.data.data);
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error.response?.data?.message || 'Could not load stations from the server.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const kpis = useMemo(() => {
    const total = stations.length;
    const active = stations.filter((s) => s.isActive).length;
    const inactive = total - active;
    const totalCapacityKWh = stations.reduce((sum, s) => sum + s.capacityKWh, 0);
    const totalBatterySlots = stations.reduce((sum, s) => sum + s.batterySlotCount, 0);
    return { total, active, inactive, totalCapacityKWh, totalBatterySlots };
  }, [stations]);

  const visibleStations = useMemo(() => {
    const query = search.trim().toLowerCase();

    let filtered = stations.filter((s) => {
      if (statusFilter === 'active' && !s.isActive) return false;
      if (statusFilter === 'inactive' && s.isActive) return false;
      if (!query) return true;
      return (
        s.stationId.toLowerCase().includes(query) ||
        s.name.toLowerCase().includes(query) ||
        s.schedule.toLowerCase().includes(query)
      );
    });

    filtered = [...filtered].sort((a, b) => {
      if (sortBy === 'capacityDesc') return b.capacityKWh - a.capacityKWh;
      if (sortBy === 'batterySlotsDesc') return b.batterySlotCount - a.batterySlotCount;
      return a.stationId.localeCompare(b.stationId);
    });

    return filtered;
  }, [stations, search, statusFilter, sortBy]);

  // Runs a mutating action (deactivate/reactivate/delete), tracks per-row loading, and
  // surfaces the server's own error message on failure rather than pre-guessing one.
  async function runAction(stationId, action) {
    setPendingActionId(stationId);
    setActionError(null);
    try {
      await action();
      await reload();
    } catch (error) {
      setActionError({ stationId, message: error.response?.data?.message || 'The request failed.' });
    } finally {
      setPendingActionId(null);
    }
  }

  async function handleCreate(payload) {
    await createStation(payload);
    setFormModal(null);
    await reload();
  }

  async function handleEdit(payload) {
    await updateStation(formModal.station.stationId, payload);
    setFormModal(null);
    await reload();
  }

  async function handleDeleteConfirm() {
    const stationId = deleteTarget.stationId;
    setDeleteTarget(null);
    await runAction(stationId, () => deleteStation(stationId));
  }

  return (
    <div className="flex flex-col">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-headline-lg font-bold text-primary tracking-tight">Solar Stations &amp; Nodes</h1>
          <p className="text-body-md text-on-surface-variant mt-1">
            Manage physical solar facilities, energy generation capacity, battery slots, and live operational status.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormModal({ mode: 'create' })}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary-container text-on-primary font-semibold text-xs shadow-sm hover:bg-primary transition-all self-start md:self-auto shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          <span>Register Station</span>
        </button>
      </div>

      {/* KPI Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-6">
        <KpiCard icon="solar_power" label="Total Solar Stations" value={kpis.total} unit="Stations" iconBgClass="bg-mint-surface text-primary">
          <span className="text-secondary font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-secondary" />
            {kpis.active} Active
          </span>
          <span className="text-outline">•</span>
          <span className="text-on-surface-variant flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-outline-variant" />
            {kpis.inactive} Inactive
          </span>
        </KpiCard>

        <KpiCard
          icon="check_circle"
          label="Operational Stations"
          value={kpis.active}
          unit="Online"
          iconBgClass="bg-secondary-container text-primary-container"
        >
          <span className="text-secondary font-bold">
            {kpis.total > 0 ? Math.round((kpis.active / kpis.total) * 100) : 0}%
          </span>
          <span className="text-outline">system availability</span>
        </KpiCard>

        <KpiCard icon="power_off" label="Deactivated" value={kpis.inactive} unit="Stations" iconBgClass="bg-surface-container-high text-outline">
          <span className="text-outline font-medium">Awaiting reactivation or removal</span>
        </KpiCard>

        <KpiCard
          icon="bolt"
          label="Total Grid Capacity"
          value={kpis.totalCapacityKWh.toLocaleString()}
          unit="kWh"
          iconBgClass="bg-surface-container-high text-operational-blue"
        >
          <span className="text-secondary font-bold">{kpis.totalBatterySlots}</span>
          <span className="text-outline">battery slots provisioned</span>
        </KpiCard>
      </section>

      {/* Reservation Protection Policy Banner */}
      <div className="bg-surface-container-low p-5 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-border-slate rounded-2xl shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-full bg-surface-container-high text-operational-blue flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">verified_user</span>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-on-surface">Reservation Protection Policy</h2>
            <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">
              Stations with active reservations cannot be deactivated or deleted until all ongoing charging sessions
              and scheduled bookings are resolved.
            </p>
          </div>
        </div>
      </div>

      {actionError && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 px-5 py-3 mb-6 bg-error-container text-on-error-container rounded-2xl text-body-sm"
        >
          <span className="flex items-start gap-2">
            <span className="material-symbols-outlined text-[18px] mt-0.5">error</span>
            <span>
              <strong>{actionError.stationId}:</strong> {actionError.message}
            </span>
          </span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            aria-label="Dismiss"
            className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full hover:bg-error/10 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* Stations Management Table Container Card */}
      <div className="bg-surface-container-lowest border border-border-slate flex flex-col overflow-hidden shadow-sm rounded-2xl">
        <div className="p-5 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-surface-container-lowest border-b border-border-slate">
          <div className="relative min-w-65 max-w-sm w-full">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[17px] text-outline">
              search
            </span>
            <input
              className="w-full h-10 pl-9 pr-4 rounded-full border border-border-slate bg-canvas-bg text-xs text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-all"
              placeholder="Search by ID, name, or schedule..."
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3 flex-wrap self-start lg:self-auto">
            <div className="flex items-center bg-canvas-bg rounded-full p-1 border border-border-slate text-xs font-medium text-on-surface-variant">
              <FilterPill label={`All Stations (${kpis.total})`} active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
              <FilterPill label={`Active (${kpis.active})`} active={statusFilter === 'active'} onClick={() => setStatusFilter('active')} />
              <FilterPill label={`Inactive (${kpis.inactive})`} active={statusFilter === 'inactive'} onClick={() => setStatusFilter('inactive')} />
            </div>
            <select
              className="h-10 px-4 pr-8 bg-canvas-bg border border-border-slate rounded-full text-xs text-on-surface font-medium focus:outline-none focus:border-secondary cursor-pointer transition-all"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-canvas-bg text-outline font-semibold uppercase tracking-wider border-b border-border-slate">
                <th className="py-4 px-5 whitespace-nowrap min-w-27.5">Station ID</th>
                <th className="py-4 px-5 whitespace-nowrap min-w-50">Station Name</th>
                <th className="py-4 px-5 whitespace-nowrap min-w-42.5">Coordinates</th>
                <th className="py-4 px-5 whitespace-nowrap text-right min-w-30">Capacity</th>
                <th className="py-4 px-5 whitespace-nowrap text-center min-w-32.5">Battery Slots</th>
                <th className="py-4 px-5 whitespace-nowrap min-w-45">Schedule</th>
                <th className="py-4 px-5 whitespace-nowrap min-w-27.5">Status</th>
                <th className="py-4 px-5 whitespace-nowrap text-right min-w-27.5">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-slate">
              {isLoading && (
                <tr>
                  <td colSpan={8} className="py-10 px-5 text-center text-on-surface-variant">
                    Loading stations...
                  </td>
                </tr>
              )}

              {!isLoading && loadError && (
                <tr>
                  <td colSpan={8} className="py-10 px-5 text-center">
                    <p className="text-alert-danger mb-3">{loadError}</p>
                    <button
                      type="button"
                      onClick={reload}
                      className="px-4 py-1.5 rounded-full bg-surface-container-high text-on-surface font-semibold text-xs"
                    >
                      Retry
                    </button>
                  </td>
                </tr>
              )}

              {!isLoading && !loadError && visibleStations.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 px-5 text-center text-on-surface-variant">
                    {stations.length === 0 ? 'No stations registered yet.' : 'No stations match your filters.'}
                  </td>
                </tr>
              )}

              {!isLoading &&
                !loadError &&
                visibleStations.map((station) => (
                  <tr key={station.stationId} className="hover:bg-surface-container-low transition-colors">
                    <td className="py-4 px-5 whitespace-nowrap">
                      <span className="px-3 py-1 rounded-full bg-surface-container-high text-on-surface text-[11px] font-semibold">
                        {station.stationId}
                      </span>
                    </td>
                    <td className="py-4 px-5 whitespace-nowrap font-semibold text-sm text-on-surface">{station.name}</td>
                    <td className="py-4 px-5 whitespace-nowrap text-on-surface-variant font-medium tabular-nums">
                      {station.latitude.toFixed(4)}, {station.longitude.toFixed(4)}
                    </td>
                    <td className="py-4 px-5 whitespace-nowrap text-right font-semibold text-sm text-on-surface tabular-nums">
                      {station.capacityKWh} <span className="text-xs text-outline font-normal">kWh</span>
                    </td>
                    <td className="py-4 px-5 whitespace-nowrap text-center">
                      <span className="inline-block px-3 py-1 rounded-full bg-surface-container-high font-semibold text-primary text-[11px]">
                        {station.batterySlotCount} Slots
                      </span>
                    </td>
                    <td className="py-4 px-5 whitespace-nowrap text-on-surface-variant font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[15px] text-outline">schedule</span>
                        {station.schedule}
                      </span>
                    </td>
                    <td className="py-4 px-5 whitespace-nowrap">
                      <StatusChip isActive={station.isActive} />
                    </td>
                    <td className="py-4 px-5 whitespace-nowrap text-right">
                      <RowActions
                        station={station}
                        isPending={pendingActionId === station.stationId}
                        onEdit={() => setFormModal({ mode: 'edit', station })}
                        onToggleActive={() =>
                          runAction(
                            station.stationId,
                            station.isActive
                              ? () => deactivateStation(station.stationId)
                              : () => reactivateStation(station.stationId)
                          )
                        }
                        onDelete={() => setDeleteTarget(station)}
                      />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {formModal?.mode === 'create' && (
        <StationFormModal onClose={() => setFormModal(null)} onSubmit={handleCreate} />
      )}
      {formModal?.mode === 'edit' && (
        <StationFormModal station={formModal.station} onClose={() => setFormModal(null)} onSubmit={handleEdit} />
      )}

      {deleteTarget && (
        <Modal title={`Delete ${deleteTarget.stationId}?`} onClose={() => setDeleteTarget(null)} maxWidthClassName="max-w-md">
          <p className="text-body-md text-on-surface-variant mb-space-lg">
            This permanently removes <strong className="text-on-surface">{deleteTarget.name}</strong>. Blocked by the
            API if any reservation was ever made against it, or if it still has slots.
          </p>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="px-5 py-2.5 rounded-full text-on-surface-variant font-semibold text-sm hover:bg-surface-container-low transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteConfirm}
              className="px-5 py-2.5 rounded-full bg-alert-danger text-on-error font-semibold text-sm shadow-sm hover:bg-error transition-all"
            >
              Delete Station
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, unit, iconBgClass, children }) {
  return (
    <div className="bg-surface-container-lowest p-6 rounded-2xl border border-border-slate flex flex-col justify-between shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-outline">{label}</span>
        <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${iconBgClass}`}>
          <span className="material-symbols-outlined text-[18px]">{icon}</span>
        </span>
      </div>
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-metric-num font-bold text-on-surface tracking-tight tabular-nums">{value}</span>
          <span className="text-xs font-medium text-outline">{unit}</span>
        </div>
        <div className="mt-2.5 flex items-center gap-2 text-xs">{children}</div>
      </div>
    </div>
  );
}

function FilterPill({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-1.5 rounded-full transition-all ${
        active ? 'bg-surface-container-lowest text-primary font-bold shadow-xs' : 'hover:text-on-surface'
      }`}
    >
      {label}
    </button>
  );
}

function StatusChip({ isActive }) {
  if (isActive) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-mint-surface text-primary font-semibold text-[11px]">
        <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
        Operational
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-error-container text-alert-danger font-semibold text-[11px]">
      <span className="w-1.5 h-1.5 rounded-full bg-alert-danger" />
      Deactivated
    </span>
  );
}

function RowActions({ station, isPending, onEdit, onToggleActive, onDelete }) {
  return (
    <div className="inline-flex items-center gap-2 justify-end">
      <button
        type="button"
        onClick={onToggleActive}
        disabled={isPending}
        className={`w-8 h-8 shrink-0 flex items-center justify-center rounded-full transition-all disabled:opacity-60 ${
          station.isActive
            ? 'text-alert-danger hover:bg-error-container'
            : 'text-secondary hover:bg-mint-surface'
        }`}
        title={isPending ? 'Working...' : station.isActive ? 'Deactivate Station' : 'Reactivate Station'}
      >
        <span className="material-symbols-outlined text-[16px]">
          {station.isActive ? 'power_settings_new' : 'check_circle'}
        </span>
      </button>
      <button
        type="button"
        onClick={onEdit}
        disabled={isPending}
        className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full text-on-surface-variant hover:text-primary transition-colors disabled:opacity-60"
        title="Edit Station"
      >
        <span className="material-symbols-outlined text-[16px]">edit</span>
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={isPending}
        className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full text-outline-variant hover:text-alert-danger transition-colors disabled:opacity-60"
        title="Delete Station"
      >
        <span className="material-symbols-outlined text-[16px]">delete</span>
      </button>
    </div>
  );
}
