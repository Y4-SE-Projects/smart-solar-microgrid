// File: SlotSchedulesPage.jsx
// Purpose: Shared Backoffice + Grid Operator page for a station's bookable slots.
//          Backoffice manages the slot time windows themselves (create/edit/delete);
//          Grid Operator manages only live availability — each role only sees the actions
//          the API actually authorizes them to perform, everything else stays hidden.

import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Roles } from '../constants/roles';
import { fetchStations } from '../services/stationsApi';
import { fetchSlotsForStation, generateRecurringSlots, updateSlot, setSlotAvailability, deleteSlot } from '../services/slotsApi';
import SlotFormModal from '../components/slots/SlotFormModal';
import GenerateSlotsModal from '../components/slots/GenerateSlotsModal';
import Modal from '../components/ui/Modal';

export default function SlotSchedulesPage() {
  const { role } = useAuth();
  const isBackoffice = role === Roles.Backoffice;
  const isGridOperator = role === Roles.GridOperator;

  const [stations, setStations] = useState([]);
  const [stationsError, setStationsError] = useState('');
  const [selectedStationId, setSelectedStationId] = useState('');

  const [slots, setSlots] = useState([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(true); // starts true: nothing to show until the first station resolves
  const [slotsError, setSlotsError] = useState('');

  const [formModal, setFormModal] = useState(null); // null | { mode: 'create' } | { mode: 'edit', slot }
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [pendingSlotId, setPendingSlotId] = useState(null);
  const [actionError, setActionError] = useState(null); // { slotId, message } | null

  // Loads the station list once, and auto-selects the first one so the page isn't empty on arrival.
  useEffect(() => {
    let cancelled = false;
    fetchStations()
      .then((response) => {
        if (cancelled) return;
        const list = response.data.data;
        setStations(list);
        if (list.length > 0) {
          setSelectedStationId((prev) => prev || list[0].stationId);
        } else {
          setIsLoadingSlots(false); // nothing to ever load
        }
      })
      .catch((error) => {
        if (!cancelled) setStationsError(error.response?.data?.message || 'Could not load stations.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Used by the Retry button and after any create/edit/action succeeds.
  async function reloadSlots() {
    if (!selectedStationId) return;
    setIsLoadingSlots(true);
    setSlotsError('');
    try {
      const response = await fetchSlotsForStation(selectedStationId);
      setSlots(response.data.data);
    } catch (error) {
      setSlotsError(error.response?.data?.message || 'Could not load slots for this station.');
    } finally {
      setIsLoadingSlots(false);
    }
  }

  // Re-fetches whenever the selected station changes. isLoadingSlots/slotsError are reset by
  // whatever caused selectedStationId to change (the initial load, or the station <select>'s
  // onChange below) — not here, so there's no setState synchronously in the effect body.
  useEffect(() => {
    if (!selectedStationId) return;
    let cancelled = false;
    fetchSlotsForStation(selectedStationId)
      .then((response) => {
        if (!cancelled) setSlots(response.data.data);
      })
      .catch((error) => {
        if (!cancelled) setSlotsError(error.response?.data?.message || 'Could not load slots for this station.');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSlots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedStationId]);

  // Runs a mutating action (availability toggle / delete), tracks per-row loading, and
  // surfaces the server's own error message on failure rather than pre-guessing one.
  async function runAction(slotId, action) {
    setPendingSlotId(slotId);
    setActionError(null);
    try {
      await action();
      await reloadSlots();
    } catch (error) {
      setActionError({ slotId, message: error.response?.data?.message || 'The request failed.' });
    } finally {
      setPendingSlotId(null);
    }
  }

  // Returns the { created, skipped } summary so GenerateSlotsModal can show it — the modal
  // stays open on its own result screen rather than closing immediately like a normal form.
  async function handleGenerate(payload) {
    const response = await generateRecurringSlots(selectedStationId, payload);
    await reloadSlots();
    return response.data.data;
  }

  async function handleEdit(payload) {
    await updateSlot(formModal.slot.slotId, payload);
    setFormModal(null);
    await reloadSlots();
  }

  async function handleDeleteConfirm() {
    const slotId = deleteTarget.slotId;
    setDeleteTarget(null);
    await runAction(slotId, () => deleteSlot(slotId));
  }

  const hasStations = stations.length > 0;

  return (
    <div className="flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-headline-lg font-bold text-primary tracking-tight">Energy Slot Schedules</h1>
          <p className="text-body-md text-on-surface-variant mt-1">
            {isGridOperator
              ? 'Update live battery slot availability for each station.'
              : 'Define the bookable time windows offered at each station.'}
          </p>
        </div>
        <div className="flex items-center gap-3 self-start md:self-auto shrink-0">
          {stationsError ? (
            <p className="text-body-sm text-alert-danger">{stationsError}</p>
          ) : (
            <select
              className="h-10 px-4 pr-8 bg-canvas-bg border border-border-slate rounded-full text-xs text-on-surface font-medium focus:outline-none focus:border-secondary cursor-pointer transition-all w-84"
              value={selectedStationId}
              onChange={(e) => {
                setIsLoadingSlots(true);
                setSlotsError('');
                setSelectedStationId(e.target.value);
              }}
              disabled={!hasStations}
            >
              {!hasStations && <option value="">No stations registered yet</option>}
              {stations.map((s) => (
                <option key={s.stationId} value={s.stationId}>
                  {s.stationId} — {s.name}
                  {!s.isActive ? ' (Deactivated)' : ''}
                </option>
              ))}
            </select>
          )}
          {isBackoffice && selectedStationId && (
            <button
              type="button"
              onClick={() => setFormModal({ mode: 'create' })}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary-container text-on-primary font-semibold text-xs shadow-sm hover:bg-primary transition-all shrink-0"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              <span>Add Slots</span>
            </button>
          )}
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
              <strong>{actionError.slotId}:</strong> {actionError.message}
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

      <div className="bg-surface-container-lowest border border-border-slate flex flex-col overflow-hidden shadow-sm rounded-2xl">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-canvas-bg text-outline font-semibold uppercase tracking-wider border-b border-border-slate">
              <th className="py-4 px-5 whitespace-nowrap">Slot ID</th>
              <th className="py-4 px-5 whitespace-nowrap">Starts</th>
              <th className="py-4 px-5 whitespace-nowrap">Ends</th>
              <th className="py-4 px-5 whitespace-nowrap">Availability</th>
              <th className="py-4 px-5 whitespace-nowrap text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-slate">
            {isLoadingSlots && (
              <tr>
                <td colSpan={5} className="py-10 px-5 text-center text-on-surface-variant">
                  Loading slots...
                </td>
              </tr>
            )}

            {!isLoadingSlots && slotsError && (
              <tr>
                <td colSpan={5} className="py-10 px-5 text-center">
                  <p className="text-alert-danger mb-3">{slotsError}</p>
                  <button
                    type="button"
                    onClick={reloadSlots}
                    className="px-4 py-1.5 rounded-full bg-surface-container-high text-on-surface font-semibold text-xs"
                  >
                    Retry
                  </button>
                </td>
              </tr>
            )}

            {!isLoadingSlots && !slotsError && slots.length === 0 && (
              <tr>
                <td colSpan={5} className="py-10 px-5 text-center text-on-surface-variant">
                  {selectedStationId ? 'No slots defined for this station yet.' : 'Select a station to view its slots.'}
                </td>
              </tr>
            )}

            {!isLoadingSlots &&
              !slotsError &&
              slots.map((slot) => (
                <tr key={slot.slotId} className="hover:bg-surface-container-low transition-colors">
                  <td className="py-4 px-5 whitespace-nowrap">
                    <span className="px-3 py-1 rounded-full bg-surface-container-high text-on-surface text-[11px] font-semibold">
                      {slot.slotId}
                    </span>
                  </td>
                  <td className="py-4 px-5 whitespace-nowrap text-on-surface-variant font-medium tabular-nums">
                    {new Date(slot.startTime).toLocaleString()}
                  </td>
                  <td className="py-4 px-5 whitespace-nowrap text-on-surface-variant font-medium tabular-nums">
                    {new Date(slot.endTime).toLocaleString()}
                  </td>
                  <td className="py-4 px-5 whitespace-nowrap">
                    {slot.isAvailable ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-mint-surface text-primary font-semibold text-[11px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                        Available
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-error-container text-alert-danger font-semibold text-[11px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-alert-danger" />
                        Unavailable
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-5 whitespace-nowrap text-right">
                    <div className="inline-flex items-center gap-2 justify-end">
                      {isGridOperator && (
                        <button
                          type="button"
                          onClick={() => runAction(slot.slotId, () => setSlotAvailability(slot.slotId, !slot.isAvailable))}
                          disabled={pendingSlotId === slot.slotId}
                          className={`w-8 h-8 shrink-0 flex items-center justify-center rounded-full transition-colors disabled:opacity-60 ${
                            slot.isAvailable ? 'text-secondary hover:text-alert-danger' : 'text-outline-variant hover:text-secondary'
                          }`}
                          title={slot.isAvailable ? 'Mark unavailable' : 'Mark available'}
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            {slot.isAvailable ? 'toggle_on' : 'toggle_off'}
                          </span>
                        </button>
                      )}
                      {isBackoffice && (
                        <>
                          <button
                            type="button"
                            onClick={() => setFormModal({ mode: 'edit', slot })}
                            disabled={pendingSlotId === slot.slotId}
                            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full text-on-surface-variant hover:text-primary transition-colors disabled:opacity-60"
                            title="Edit Slot"
                          >
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(slot)}
                            disabled={pendingSlotId === slot.slotId}
                            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full text-outline-variant hover:text-alert-danger transition-colors disabled:opacity-60"
                            title="Delete Slot"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {formModal?.mode === 'create' && (
        <GenerateSlotsModal
          station={stations.find((s) => s.stationId === selectedStationId)}
          onClose={() => setFormModal(null)}
          onSubmit={handleGenerate}
        />
      )}
      {formModal?.mode === 'edit' && (
        <SlotFormModal slot={formModal.slot} onClose={() => setFormModal(null)} onSubmit={handleEdit} />
      )}

      {deleteTarget && (
        <Modal title={`Delete ${deleteTarget.slotId}?`} onClose={() => setDeleteTarget(null)} maxWidthClassName="max-w-md">
          <p className="text-body-md text-on-surface-variant mb-space-lg">
            This permanently removes the slot. Blocked if any reservation was ever made against it.
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
              Delete Slot
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
