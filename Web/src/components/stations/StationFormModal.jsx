// File: StationFormModal.jsx
// Purpose: Create/Edit form for a solar station.

import { useState } from 'react';
import Modal from '../ui/Modal';
import LocationPickerMap from './LocationPickerMap';
import ScheduleField from './ScheduleField';
import { inputClass } from './formStyles';

// Builds the initial form state from an existing station (edit mode) or blank text fields (create mode).
function toFormState(station) {
  if (!station) {
    return { stationId: '', name: '', latitude: '', longitude: '', capacityKWh: '', batterySlotCount: '', schedule: '' };
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
  const [form, setForm] = useState(() => toFormState(station));
  const [generalError, setGeneralError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setGeneralError('');
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
      setGeneralError(error.response?.data?.message || 'Something went wrong while saving the station.');
      setIsSubmitting(false);
    }
  }

  return (
    <Modal title={isEdit ? `Edit ${station.stationId}` : 'Register Station'} onClose={onClose}>
      <form className="space-y-space-md" onSubmit={handleSubmit} noValidate>
        {!isEdit && (
          <Field label="Station ID">
            <input
              className={inputClass}
              value={form.stationId}
              onChange={(e) => updateField('stationId', e.target.value)}
              placeholder="STN-006"
              required
            />
          </Field>
        )}

        <Field label="Station Name">
          <input
            className={inputClass}
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="Colombo Central Hub"
            required
          />
        </Field>

        <Field label="Location">
          <LocationPickerMap
            latitude={form.latitude === '' ? null : Number(form.latitude)}
            longitude={form.longitude === '' ? null : Number(form.longitude)}
            onChange={(lat, lng) => {
              updateField('latitude', String(lat));
              updateField('longitude', String(lng));
            }}
          />
        </Field>

        <div className="grid grid-cols-2 gap-space-md">
          <Field label="Latitude">
            <input
              className={inputClass}
              type="number"
              step="any"
              value={form.latitude}
              onChange={(e) => updateField('latitude', e.target.value)}
              placeholder="6.9271"
              required
            />
          </Field>
          <Field label="Longitude">
            <input
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

        <div className="grid grid-cols-2 gap-space-md">
          <Field label="Capacity (kWh)">
            <input
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
          <Field label="Battery Slots">
            <input
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

        {generalError && (
          <div role="alert" className="flex items-start gap-2 px-space-md py-space-sm bg-error-container text-on-error-container rounded-xl text-body-sm">
            <span className="material-symbols-outlined text-[18px] mt-0.5">error</span>
            <span>{generalError}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-space-sm">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-full text-on-surface-variant font-semibold text-sm hover:bg-surface-container-low transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-full bg-primary-container text-on-primary font-semibold text-sm shadow-sm hover:bg-primary disabled:opacity-60 transition-all"
          >
            {isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Register Station'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Small label + input wrapper, local to this form.
function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <label className="text-label-md font-medium text-on-surface">{label}</label>
      {children}
    </div>
  );
}
