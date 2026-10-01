// File: StationSelectionMapModal.jsx
// Purpose: Select a station from the full station list by clicking its map pin.

import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import Modal from '../ui/Modal';

const MAP_CONTAINER_STYLE = { width: '100%', height: '100%' };
const DEFAULT_CENTER = { lat: 7.8731, lng: 80.7718 };
const MAP_OPTIONS = { streetViewControl: false, mapTypeControl: false, fullscreenControl: false };
// Use the site's secondary green for active stations and error red for deactivated ones.
function stationPinIcon(color) {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24"><path fill="${color}" stroke="#ffffff" stroke-width="0.7" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`
  )}`;
}

const ACTIVE_PIN_ICON = stationPinIcon('#006c4a');
const DEACTIVATED_PIN_ICON = stationPinIcon('#ba1a1a');

function hasCoordinates(station) {
  return Number.isFinite(station.latitude) && Number.isFinite(station.longitude) &&
    Math.abs(station.latitude) <= 90 && Math.abs(station.longitude) <= 180;
}

export default function StationSelectionMapModal({ stations, selectedStationId, onSelect, onClose }) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAP_API;
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'heliogrid-google-map-script',
    googleMapsApiKey: apiKey ?? '',
  });

  const mappedStations = stations.filter(hasCoordinates);
  const selectedStation = mappedStations.find((station) => station.stationId === selectedStationId);
  const initialStation = selectedStation ?? mappedStations[0];
  const center = initialStation
    ? { lat: initialStation.latitude, lng: initialStation.longitude }
    : DEFAULT_CENTER;

  function fitStations(map) {
    const hasDifferentLocations = mappedStations.some((station) =>
      station.latitude !== mappedStations[0].latitude || station.longitude !== mappedStations[0].longitude
    );
    if (hasDifferentLocations) {
      const bounds = new window.google.maps.LatLngBounds();
      mappedStations.forEach((station) => bounds.extend({ lat: station.latitude, lng: station.longitude }));
      map.fitBounds(bounds, 48);
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
        options={MAP_OPTIONS}
      >
        {mappedStations.map((station) => (
          <Marker
            key={station.stationId}
            position={{ lat: station.latitude, lng: station.longitude }}
            title={`${station.stationId} · ${station.name}${station.isActive ? '' : ' (deactivated)'}`}
            icon={station.isActive ? ACTIVE_PIN_ICON : DEACTIVATED_PIN_ICON}
            onClick={() => onSelect(station.stationId)}
          />
        ))}
      </GoogleMap>
    );
  }

  return (
    <Modal
      title="Select a station on the map"
      description="Click a station pin to select it."
      onClose={onClose}
      maxWidthClassName="max-w-4xl"
    >
      <div className="h-[min(55vh,480px)] min-h-[260px] overflow-hidden rounded-xl border border-border-slate bg-canvas-bg">
        {typeof mapContent === 'string' ? (
          <div role="status" className="flex h-full items-center justify-center p-6 text-center text-body-sm text-on-surface-variant">
            {mapContent}
          </div>
        ) : mapContent}
      </div>
    </Modal>
  );
}
