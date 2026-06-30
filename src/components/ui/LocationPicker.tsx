import React, { useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import { Crosshair } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface LocationPickerProps {
  lat: number;
  lng: number;
  onLocationChange: (lat: number, lng: number) => void;
  onRecenter?: () => void;
}

function DraggableMarker({ position, onDragEnd }: { position: L.LatLngExpression; onDragEnd: (lat: number, lng: number) => void }) {
  const markerRef = useRef<L.Marker>(null);

  const eventHandlers = {
    dragend() {
      const marker = markerRef.current;
      if (marker) {
        const latlng = marker.getLatLng();
        onDragEnd(latlng.lat, latlng.lng);
      }
    },
  };

  return (
    <Marker
      draggable={true}
      position={position}
      ref={markerRef}
      eventHandlers={eventHandlers}
    />
  );
}

function MapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapRecenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const prevRef = useRef({ lat, lng });
  if (prevRef.current.lat !== lat || prevRef.current.lng !== lng) {
    map.setView([lat, lng], map.getZoom());
    prevRef.current = { lat, lng };
  }
  return null;
}

export default function LocationPicker({ lat, lng, onLocationChange, onRecenter }: LocationPickerProps) {
  const handleDragEnd = useCallback((newLat: number, newLng: number) => {
    onLocationChange(newLat, newLng);
  }, [onLocationChange]);

  const handleMapClick = useCallback((newLat: number, newLng: number) => {
    onLocationChange(newLat, newLng);
  }, [onLocationChange]);

  return (
    <div className="relative overflow-hidden rounded-xl border-4 border-border shadow-[4px_4px_0_0_var(--cp-border)]">
      <MapContainer
        center={[lat, lng]}
        zoom={16}
        className="h-64 w-full"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <DraggableMarker position={[lat, lng]} onDragEnd={handleDragEnd} />
        <MapClickHandler onClick={handleMapClick} />
        <MapRecenter lat={lat} lng={lng} />
      </MapContainer>
      {onRecenter && (
        <button
          type="button"
          onClick={onRecenter}
          className="absolute bottom-3 left-3 z-[1000] flex items-center gap-1.5 rounded-full border-2 border-border bg-surface-container-lowest px-3 py-1.5 text-xs font-bold shadow-[2px_2px_0_0_var(--cp-border)] hover:bg-surface transition-colors"
        >
          <Crosshair className="h-3.5 w-3.5 text-primary" />
          Use GPS
        </button>
      )}
      <div className="absolute bottom-3 right-3 z-[1000] rounded-full border-2 border-border bg-surface-container-lowest px-2.5 py-1 text-[10px] font-bold shadow-[2px_2px_0_0_var(--cp-border)]">
        Drag pin to adjust
      </div>
    </div>
  );
}
