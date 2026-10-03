// File: LocationPickerMap.jsx
// Purpose: Google Map location picker for the station form.

import { useMemo } from 'react';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { ACTIVE_STATION_PIN_ICON, DEACTIVATED_STATION_PIN_ICON } from './mapPinIcons';

// Fills its parent so the station form can use it as a full-screen map canvas.
const MAP_CONTAINER_STYLE = { width: '100%', height: '100%' };

// Roughly the centre of Sri Lanka — a sensible default view before a location is chosen.
const DEFAULT_CENTER = { lat: 7.8731, lng: 80.7718 };

const MAP_OPTIONS = { streetViewControl: false, mapTypeControl: false, fullscreenControl: false };

export default function LocationPickerMap({ latitude, longitude, onChange, isActive = true, fullBleed = false, className = '' }) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAP_API;

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'heliogrid-google-map-script',
    googleMapsApiKey: apiKey ?? '',
  });

  const hasPin = Number.isFinite(latitude) && Number.isFinite(longitude);
  const center = useMemo(
    () => hasPin ? { lat: latitude, lng: longitude } : DEFAULT_CENTER,
    [hasPin, latitude, longitude]
  );
  const mapOptions = useMemo(() => isLoaded ? {
    ...MAP_OPTIONS,
    zoomControlOptions: { position: window.google.maps.ControlPosition.LEFT_TOP },
  } : MAP_OPTIONS, [isLoaded]);
  const frameClass = fullBleed
    ? 'h-full w-full'
    : 'h-full min-h-[260px] rounded-xl border border-border-slate';
  const fallbackLayout = fullBleed
    ? 'items-start justify-start px-6 pt-20'
    : 'items-center justify-center p-4';

  // Reads the clicked/dropped point off a Maps event and reports it back as plain numbers.
  function emitPosition(latLng) {
    onChange(Number(latLng.lat().toFixed(6)), Number(latLng.lng().toFixed(6)));
  }

  if (!apiKey) {
    return (
      <div className={`${frameClass} flex ${fallbackLayout} bg-canvas-bg text-body-sm text-on-surface-variant ${className}`}>
        Map unavailable. Enter the coordinates manually.
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={`${frameClass} flex ${fallbackLayout} bg-error-container text-body-sm text-on-error-container ${className}`}>
        Could not load Google Maps.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className={`${frameClass} flex ${fallbackLayout} bg-canvas-bg text-body-sm text-on-surface-variant ${className}`}>
        Loading map...
      </div>
    );
  }

  return (
    <div className={`${frameClass} overflow-hidden ${className}`}>
      <GoogleMap
        mapContainerStyle={MAP_CONTAINER_STYLE}
        center={center}
        zoom={hasPin ? 14 : 7}
        onClick={(event) => emitPosition(event.latLng)}
        options={mapOptions}
      >
        {hasPin && (
          <Marker
            position={center}
            icon={isActive ? ACTIVE_STATION_PIN_ICON : DEACTIVATED_STATION_PIN_ICON}
            draggable
            onDragEnd={(event) => emitPosition(event.latLng)}
          />
        )}
      </GoogleMap>
    </div>
  );
}
