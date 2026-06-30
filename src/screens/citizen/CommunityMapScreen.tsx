import React, { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { db } from '../../config/firebase';
import { collection, query, onSnapshot, Timestamp } from 'firebase/firestore';
import { isClusterTerminal } from '../../utils/clusterStatus';
import { Crosshair, Loader2, AlertCircle, MapPin, Clock, Users } from 'lucide-react';

/* ─── Fix default Leaflet marker icon ─── */
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/* ─── Cluster data shape ─── */
interface ClusterMarker {
  id: string;
  lat: number;
  lng: number;
  category: string;
  severity: string;
  status: string;
  affected_count: number;
  created_at: Timestamp;
}

/* ─── Severity-coloured divIcon ─── */
function clusterIcon(severity: string): L.DivIcon {
  const palette: Record<string, string> = { High: '#dc2626', Medium: '#d97706', Low: '#16a34a' };
  const c = palette[severity] || '#6366f1';
  return L.divIcon({
    className: '',
    html: `<svg width="28" height="38" viewBox="0 0 28 38" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 24 14 24s14-13.5 14-24C28 6.268 21.732 0 14 0z" fill="${c}"/><circle cx="14" cy="13" r="6" fill="#fff"/></svg>`,
    iconSize: [28, 38],
    iconAnchor: [14, 38],
    tooltipAnchor: [0, -40],
  });
}

/* ─── Pulse icon for user location ─── */
function userIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="position:relative"><div style="width:18px;height:18px;background:#3b82f6;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 4px rgba(59,130,246,.3);"></div><div style="position:absolute;inset:-4px;border-radius:50%;border:2px solid rgba(59,130,246,.4);animation:pulse 2s infinite"></div></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

/* ─── Auto-centre map on location change ─── */
function MapBoundsFitter({ clusters, userPos }: { clusters: ClusterMarker[]; userPos: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (clusters.length === 0 && userPos) {
      map.setView(userPos, 12);
      return;
    }
    if (clusters.length > 0) {
      const bounds = L.latLngBounds(clusters.map(c => [c.lat, c.lng]));
      if (userPos) bounds.extend(userPos);
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [clusters, userPos, map]);
  return null;
}

/* ─── Geolocation hook ─── */
function useUserPosition(): [position: [number, number] | null, loading: boolean, error: string | null, refresh: () => void] {
  const [pos, setPos] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not available');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (p) => { setPos([p.coords.latitude, p.coords.longitude]); setLoading(false); },
      (e) => { setError(e.message); setLoading(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => { request(); }, [request]);

  return [pos, loading, error, request];
}

/* ─── Format relative time ─── */
function timeAgo(ts: Timestamp): string {
  const diff = Date.now() - ts.toMillis();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/* ─── Component ─── */
export default function CommunityMapScreen() {
  const [clusters, setClusters] = useState<ClusterMarker[]>([]);
  const [userPos, userLoading, userErr, refreshGeo] = useUserPosition();
  const [hoveredCluster, setHoveredCluster] = useState<ClusterMarker | null>(null);

  /* Fetch open clusters */
  useEffect(() => {
    const q = query(collection(db, 'clusters'));
    const unsub = onSnapshot(q, (snap) => {
      const list: ClusterMarker[] = [];
      snap.forEach((d) => {
        const data = d.data();
        if (isClusterTerminal(data.status)) return;
        if (data.centroid_lat == null || data.centroid_lng == null) return;
        list.push({
          id: d.id,
          lat: data.centroid_lat,
          lng: data.centroid_lng,
          category: data.category || 'Unknown',
          severity: data.severity || 'Low',
          status: data.status,
          affected_count: data.affected_count ?? 0,
          created_at: data.created_at,
        });
      });
      setClusters(list);
    });
    return () => unsub();
  }, []);

  return (
    <div className="relative flex min-h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 border-b border-border bg-surface px-4 py-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold">Community Map</h2>
        </div>
        <div className="flex items-center gap-2 text-xs text-on-surface-variant">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" /> High
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-600" /> Med
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-600" /> Low
          </span>
        </div>
      </div>

      {/* Loading overlay */}
      {userLoading && (
        <div className="absolute inset-0 z-[2000] flex items-center justify-center bg-background/60">
          <div className="flex items-center gap-2 rounded-xl border-4 border-border bg-surface p-4 shadow-[4px_4px_0_0_var(--cp-border)]">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm font-bold">Getting your location...</span>
          </div>
        </div>
      )}

      {/* Map */}
      <div className="h-[50vh] min-h-[280px] md:h-[60vh]">
        <MapContainer
          center={userPos || [28.6139, 77.2090]}
          zoom={12}
          className="h-full w-full rounded-lg border-2 border-border"
          zoomControl={true}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapBoundsFitter clusters={clusters} userPos={userPos} />

          {/* Cluster markers */}
          {clusters.map((c) => (
            <Marker
              key={c.id}
              position={[c.lat, c.lng]}
              icon={clusterIcon(c.severity)}
            >
              <Tooltip
                direction="top"
                offset={[0, -8]}
                opacity={1}
                permanent={false}
                className="!border-2 !border-border !rounded-xl !bg-surface !shadow-[4px_4px_0_0_var(--cp-border)] !p-0 !text-text-primary"
              >
                <div className="min-w-[180px] p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-sm font-bold leading-tight">{c.category}</span>
                    <span className={`shrink-0 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      c.severity === 'High' ? 'bg-red-100 text-red-700' :
                      c.severity === 'Medium' ? 'bg-amber-100 text-amber-700' :
                      'bg-green-100 text-green-700'
                    }`}>{c.severity}</span>
                  </div>
                  <div className="space-y-1 text-xs text-on-surface-variant">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      {c.created_at ? timeAgo(c.created_at) : '—'}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3 w-3" />
                      {c.affected_count} {c.affected_count === 1 ? 'person' : 'people'} affected
                    </div>
                  </div>
                </div>
              </Tooltip>
            </Marker>
          ))}

          {/* User location marker */}
          {userPos && (
            <Marker position={userPos} icon={userIcon()}>
              <Tooltip direction="top" offset={[0, -10]} opacity={1} permanent={false}
                className="!border-2 !border-border !rounded-xl !bg-surface !shadow-[4px_4px_0_0_var(--cp-border)] !text-xs !font-bold !text-text-primary !px-3 !py-1.5"
              >
                You are here
              </Tooltip>
            </Marker>
          )}
        </MapContainer>

        {/* Re-centre button */}
        {userPos && (
          <button
            type="button"
            onClick={refreshGeo}
            className="absolute bottom-4 left-4 z-[1000] flex items-center gap-1.5 rounded-full border-2 border-border bg-surface px-3 py-1.5 text-xs font-bold shadow-[2px_2px_0_0_var(--cp-border)] hover:bg-surface-container-low transition-colors"
          >
            <Crosshair className="h-3.5 w-3.5 text-primary" />
            Re-centre
          </button>
        )}

        {/* Geo error banner */}
        {userErr && (
          <div className="absolute bottom-4 right-4 z-[1000] max-w-[220px] rounded-xl border-2 border-border bg-surface p-3 shadow-[2px_2px_0_0_var(--cp-border)]">
            <p className="text-[10px] text-on-surface-variant">
              Could not get your location. Map shows all open issues.
            </p>
            <button type="button" onClick={refreshGeo}
              className="mt-1 text-[10px] font-bold text-primary underline"
            >
              Try again
            </button>
          </div>
        )}
      </div>

      {/* Bottom legend / summary */}
      <div className="shrink-0 border-t border-border bg-surface px-4 py-2">
        <p className="text-xs text-on-surface-variant flex items-center gap-1">
          <AlertCircle className="h-3.5 w-3.5 text-primary" />
          {clusters.length} open {clusters.length === 1 ? 'issue' : 'issues'} near you
        </p>
      </div>
    </div>
  );
}
