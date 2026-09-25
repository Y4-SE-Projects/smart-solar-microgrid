// File: LocationPickerMap.jsx
// Purpose: Google Map location picker for the station form.

import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';

// Fills whatever height its parent gives it (the form places this in a grid cell that
// stretches to match the input column), rather than a fixed height.
const MAP_CONTAINER_STYLE = { width: '100%', height: '100%' };

// Roughly the centre of Sri Lanka — a sensible default view before a location is chosen.
const DEFAULT_CENTER = { lat: 7.8731, lng: 80.7718 };

const MAP_OPTIONS = { streetViewControl: false, mapTypeControl: false, fullscreenControl: false };

export default function LocationPickerMap({ latitude, longitude, onChange, className = '' }) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAP_API;

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'heliogrid-google-map-script',
    googleMapsApiKey: apiKey ?? '',
  });

  const hasPin = Number.isFinite(latitude) && Number.isFinite(longitude);
  const center = hasPin ? { lat: latitude, lng: longitude } : DEFAULT_CENTER;

  // Reads the clicked/dropped point off a Maps event and reports it back as plain numbers.
  function emitPosition(latLng) {
    onChange(Number(latLng.lat().toFixed(6)), Number(latLng.lng().toFixed(6)));
  }

  if (!apiKey) {
    return (
      <div className={`h-full min-h-[260px] rounded-xl border border-dashed border-border-slate bg-canvas-bg p-4 text-body-sm text-on-surface-variant ${className}`}>
        Map unavailable — set VITE_GOOGLE_MAP_API in Web/.env.
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={`h-full min-h-[260px] rounded-xl border border-border-slate bg-error-container p-4 text-body-sm text-on-error-container ${className}`}>
        Could not load Google Maps.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className={`h-full min-h-[260px] rounded-xl border border-border-slate bg-canvas-bg flex items-center justify-center text-body-sm text-on-surface-variant ${className}`}>
        Loading map...
      </div>
    );
  }

  return (
    <div className={`h-full min-h-[260px] rounded-xl overflow-hidden border border-border-slate ${className}`}>
      <GoogleMap
        mapContainerStyle={MAP_CONTAINER_STYLE}
        center={center}
        zoom={hasPin ? 14 : 7}
        onClick={(event) => emitPosition(event.latLng)}
        options={MAP_OPTIONS}
      >
        {hasPin && <Marker position={center} draggable onDragEnd={(event) => emitPosition(event.latLng)} />}
      </GoogleMap>
    </div>
  );
}
