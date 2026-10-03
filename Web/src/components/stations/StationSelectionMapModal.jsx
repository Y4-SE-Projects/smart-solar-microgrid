// File: StationSelectionMapModal.jsx
// Purpose: Full-map station selection for the slot schedules page.

import { useEffect, useId, useMemo, useRef } from 'react';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { ACTIVE_STATION_PIN_ICON, DEACTIVATED_STATION_PIN_ICON } from './mapPinIcons';

const MAP_CONTAINER_STYLE = { width: '100%', height: '100%' };
const DEFAULT_CENTER = { lat: 7.8731, lng: 80.7718 };
const MAP_OPTIONS = { streetViewControl: false, mapTypeControl: false, fullscreenControl: false };

function hasCoordinates(station) {
  return Number.isFinite(station.latitude) && Number.isFinite(station.longitude) &&
    Math.abs(station.latitude) <= 90 && Math.abs(station.longitude) <= 180;
}

export default function StationSelectionMapModal({ stations, selectedStationId, onSelect, onClose }) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef(null);
  const apiKey = import.meta.env.VITE_GOOGLE_MAP_API;
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'heliogrid-google-map-script',
    googleMapsApiKey: apiKey ?? '',
  });

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
      if (event.key === 'Escape' && !event.defaultPrevented) onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const mappedStations = stations.filter(hasCoordinates);
  const selectedStation = mappedStations.find((station) => station.stationId === selectedStationId);
  const initialStation = selectedStation ?? mappedStations[0];
  const center = initialStation
    ? { lat: initialStation.latitude, lng: initialStation.longitude }
    : DEFAULT_CENTER;
  const mapOptions = useMemo(() => isLoaded ? {
    ...MAP_OPTIONS,
    zoomControlOptions: { position: window.google.maps.ControlPosition.LEFT_BOTTOM },
  } : MAP_OPTIONS, [isLoaded]);

  function fitStations(map) {
    const hasDifferentLocations = mappedStations.some((station) =>
      station.latitude !== mappedStations[0].latitude || station.longitude !== mappedStations[0].longitude
    );
    if (hasDifferentLocations) {
      const bounds = new window.google.maps.LatLngBounds();
      mappedStations.forEach((station) => bounds.extend({ lat: station.latitude, lng: station.longitude }));
      const compact = map.getDiv().clientWidth < 800;
      map.fitBounds(bounds, compact
        ? { top: 180, right: 28, bottom: 48, left: 28 }
        : { top: 48, right: 340, bottom: 48, left: 48 });
    } else {
      map.setZoom(13);
    }
  }

  let mapContent;
  if (!apiKey) {
    mapContent = 'Map unavailable. Select a station from the dropdown.';
  } else if (loadError) {
    mapContent = 'Could not load Google Maps. Select a station from the dropdown.';
  } else if (!isLoaded) {
    mapContent = 'Loading map...';
  } else if (mappedStations.length === 0) {
    mapContent = 'No stations have map coordinates. Select a station from the dropdown.';
  } else {
    mapContent = (
      <GoogleMap
        mapContainerStyle={MAP_CONTAINER_STYLE}
        center={center}
        zoom={mappedStations.length === 1 ? 13 : 7}
        onLoad={fitStations}
        options={mapOptions}
      >
        {mappedStations.map((station) => (
          <Marker
            key={station.stationId}
            position={{ lat: station.latitude, lng: station.longitude }}
            title={`${station.stationId} · ${station.name}${station.isActive ? '' : ' (deactivated)'}`}
            icon={station.isActive ? ACTIVE_STATION_PIN_ICON : DEACTIVATED_STATION_PIN_ICON}
            onClick={() => onSelect(station.stationId)}
          />
        ))}
      </GoogleMap>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="fixed inset-y-0 right-0 z-40 overflow-hidden bg-canvas-bg"
      style={{ left: 'var(--app-sidebar-width, 5rem)' }}
    >
      <div className="absolute inset-0">
        {typeof mapContent === 'string' ? (
          <div role="status" className="flex h-full items-center justify-center p-6 text-center text-body-sm text-on-surface-variant">
            {mapContent}
          </div>
        ) : mapContent}
      </div>

      <section
        ref={panelRef}
        tabIndex={-1}
        className="absolute right-3 top-3 z-10 w-[min(320px,calc(100%-1.5rem))] rounded-2xl bg-surface-container-lowest p-4 shadow-xl outline-none sm:right-5 sm:top-5 sm:p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-headline-sm font-bold text-primary">Select a station</h2>
            <p id={descriptionId} className="mt-1 text-body-sm text-on-surface-variant">
              Click a pin to view its slot schedule.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close station map"
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-on-surface-variant outline-none transition-colors hover:bg-surface-container-low hover:text-on-surface focus-visible:ring-2 focus-visible:ring-secondary"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
          </button>
        </div>
        <div className="mt-3 flex items-center gap-4 border-t border-border-slate pt-3 text-body-sm text-on-surface-variant">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-secondary" aria-hidden="true" /> Active
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-error" aria-hidden="true" /> Deactivated
          </span>
        </div>
      </section>
    </div>
  );
}
