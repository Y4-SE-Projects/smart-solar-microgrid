// File: StationFormModal.jsx
// Purpose: Full-map create/edit workspace for a solar station.

import { useEffect, useId, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import LocationPickerMap from './LocationPickerMap';
import ScheduleField from './ScheduleField';
import { inputClass } from './formStyles';
import { DEFAULT_SCHEDULE } from '../../utils/stationSchedule';

// Builds the initial form state from an existing station (edit mode) or blank text fields (create mode).
function toFormState(station) {
  if (!station) {
    return { stationId: '', name: '', latitude: '', longitude: '', capacityKWh: '', batterySlotCount: '', schedule: DEFAULT_SCHEDULE };
  }
  return {
    stationId: station.stationId,
    name: station.name,
    latitude: String(station.latitude),
    longitude: String(station.longitude),
    capacityKWh: String(station.capacityKWh),
    batterySlotCount: String(station.batterySlotCount),
    schedule: station.schedule,
  };
}

export default function StationFormModal({ station, onClose, onSubmit }) {
  const isEdit = Boolean(station);
  const formId = useId();
  const panelRef = useRef(null);
  const [form, setForm] = useState(() => toFormState(station));
  const [isSubmitting, setIsSubmitting] = useState(false);

  // The map fills the page content area, so keep the page beneath it still and return
  // keyboard focus to the button that opened this workspace when it closes.
  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape' && !event.defaultPrevented && !isSubmitting) onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSubmitting, onClose]);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);

    const payload = {
      name: form.name.trim(),
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      capacityKWh: Number(form.capacityKWh),
      batterySlotCount: Number(form.batterySlotCount),
      schedule: form.schedule.trim(),
    };
    if (!isEdit) {
      payload.stationId = form.stationId.trim();
    }

    try {
      await onSubmit(payload);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Something went wrong while saving the station.');
      setIsSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${formId}-title`}
      aria-describedby={`${formId}-description`}
      className="fixed inset-y-0 right-0 z-40 overflow-hidden bg-canvas-bg"
      style={{ left: 'var(--app-sidebar-width, 5rem)' }}
    >
      <LocationPickerMap
        fullBleed
        className="absolute inset-0"
        latitude={form.latitude === '' ? null : Number(form.latitude)}
        longitude={form.longitude === '' ? null : Number(form.longitude)}
        isActive={station?.isActive ?? true}
        onChange={(lat, lng) => {
          setForm((prev) => ({ ...prev, latitude: String(lat), longitude: String(lng) }));
        }}
      />

      <div className="pointer-events-none absolute inset-0 z-20 flex items-end justify-center p-3 lg:items-center lg:justify-end lg:p-5">
        <section
          ref={panelRef}
          tabIndex={-1}
          className="pointer-events-auto flex h-[48dvh] w-full flex-col overflow-hidden rounded-2xl bg-surface-container-lowest shadow-xl outline-none lg:h-auto lg:max-h-[calc(100dvh-2.5rem)] lg:w-[360px]"
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border-slate px-5 py-4">
            <div className="min-w-0">
              <h2 id={`${formId}-title`} className="text-headline-sm font-bold text-primary">
                {isEdit ? `Edit ${station.stationId}` : 'Register Station'}
              </h2>
              <p id={`${formId}-description`} className="mt-1 text-body-sm text-on-surface-variant">
                Choose a point on the map and complete the station details.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              aria-label="Close station form"
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-on-surface-variant outline-none transition-colors hover:bg-surface-container-low hover:text-on-surface focus-visible:ring-2 focus-visible:ring-secondary disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-space-md overflow-y-auto overscroll-contain px-5 py-5">
              {!isEdit && (
                <Field label="Station ID" id={`${formId}-station-id`}>
                  <input
                    id={`${formId}-station-id`}
                    className={inputClass}
                    value={form.stationId}
                    onChange={(e) => updateField('stationId', e.target.value)}
                    placeholder="STN-006"
                    required
                  />
                </Field>
              )}

              <Field label="Station Name" id={`${formId}-name`}>
                <input
                  id={`${formId}-name`}
                  className={inputClass}
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="Colombo Central Hub"
                  required
                />
              </Field>

              <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
                <Field label="Latitude" id={`${formId}-latitude`}>
                  <input
                    id={`${formId}-latitude`}
                    className={inputClass}
                    type="number"
                    step="any"
                    value={form.latitude}
                    onChange={(e) => updateField('latitude', e.target.value)}
                    placeholder="6.9271"
                    required
                  />
                </Field>
                <Field label="Longitude" id={`${formId}-longitude`}>
                  <input
                    id={`${formId}-longitude`}
                    className={inputClass}
                    type="number"
                    step="any"
                    value={form.longitude}
                    onChange={(e) => updateField('longitude', e.target.value)}
                    placeholder="79.8612"
                    required
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
                <Field label="Capacity (kWh)" id={`${formId}-capacity`}>
                  <input
                    id={`${formId}-capacity`}
                    className={inputClass}
                    type="number"
                    step="any"
                    min="0.1"
                    value={form.capacityKWh}
                    onChange={(e) => updateField('capacityKWh', e.target.value)}
                    placeholder="120.5"
                    required
                  />
                </Field>
                <Field label="Battery Slots" id={`${formId}-slots`}>
                  <input
                    id={`${formId}-slots`}
                    className={inputClass}
                    type="number"
                    step="1"
                    min="1"
                    value={form.batterySlotCount}
                    onChange={(e) => updateField('batterySlotCount', e.target.value)}
                    placeholder="8"
                    required
                  />
                </Field>
              </div>

              <ScheduleField value={form.schedule} onChange={(next) => updateField('schedule', next)} />
            </div>

            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border-slate bg-surface-container-lowest px-5 py-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-full px-4 py-2.5 text-body-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-full bg-primary-container px-5 py-2.5 text-body-sm font-semibold text-on-primary shadow-sm transition-colors hover:bg-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Register Station'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

function Field({ label, id, children }) {
  return (
    <div className="min-w-0 space-y-1">
      <label htmlFor={id} className="text-label-md font-medium text-on-surface">{label}</label>
      {children}
    </div>
  );
}
