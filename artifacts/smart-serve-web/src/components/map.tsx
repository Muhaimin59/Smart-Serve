/* Leaflet map with OSM tiles (no API key) + graceful fallback when offline. */
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Navigation } from "lucide-react";

export type MapPoint = { lat: number; lon: number; label: string; kind?: "customer" | "provider" };

export function MapView({ points = [], height = 260, route, onPick, center, zoom }: {
  points?: MapPoint[];
  height?: number;
  route?: { from?: MapPoint; to?: MapPoint } | null;
  onPick?: (lat: number, lon: number) => void;
  center?: [number, number];
  zoom?: number;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const [tilesFailed, setTilesFailed] = useState(false);

  // init once
  useEffect(() => {
    const el = divRef.current;
    if (!el || mapRef.current) return;
    const c = center ?? [12.9716, 77.5946];
    const map = L.map(el, { zoomControl: true, attributionControl: false, scrollWheelZoom: false });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).on("tileerror", () => setTilesFailed(true)).addTo(map);
    map.setView(c, zoom ?? 14);
    layerRef.current = L.layerGroup().addTo(map);
    if (onPick) {
      map.on("click", (e: L.LeafletMouseEvent) => onPick(e.latlng.lat, e.latlng.lng));
    }
    mapRef.current = map;
    const t = setTimeout(() => map.invalidateSize(), 250);
    return () => {
      clearTimeout(t);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // update markers
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const icon = (kind?: string) =>
      L.divIcon({ className: "", html: `<div class="map-marker ${kind ?? ""}">${kind === "customer" ? "👤" : "🔧"}</div>`, iconSize: [38, 38], iconAnchor: [19, 36], popupAnchor: [0, -34] });
    for (const p of points) {
      L.marker([p.lat, p.lon], { icon: icon(p.kind) }).addTo(layer).bindPopup(p.label);
    }
    if (route?.from && route?.to) {
      L.polyline(
        [
          [route.from.lat, route.from.lon],
          [route.to.lat, route.to.lon],
        ],
        { color: getComputedStyle(document.documentElement).getPropertyValue("--primary").trim() || "#ec4899", weight: 4, dashArray: "8 8", opacity: 0.85 },
      ).addTo(layer);
      map.fitBounds(L.latLngBounds([[route.from.lat, route.from.lon], [route.to.lat, route.to.lon]]).pad(0.35));
    } else if (points.length > 0) {
      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lon] as [number, number]));
      map.fitBounds(bounds.pad(0.4));
    }
  }, [JSON.stringify(points), route?.from?.lat, route?.from?.lon, route?.to?.lat, route?.to?.lon]);

  const navigate = (p: MapPoint) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}&travelmode=driving`;
    window.open(url, "_blank", "noopener");
  };

  return (
    <div className="relative rounded-2xl overflow-hidden border" style={{ height, borderColor: "var(--border)", background: "var(--surface-2)" }}>
      <div ref={divRef} className="w-full h-full" />
      {tilesFailed && (
        <div className="absolute bottom-2 left-2 right-2 glass-solid px-3 py-2 text-xs flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
          <MapPin size={14} />
          Map tiles unavailable - showing coordinates: {points.map((p) => `${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}`).join(" · ")}
        </div>
      )}
      {route?.to && (
        <button className="absolute top-2 right-2 btn btn-primary btn-sm" onClick={() => navigate(route.to!)}>
          <Navigation size={15} /> Directions
        </button>
      )}
    </div>
  );
}

/** Pick-a-location wrapper used by the booking wizard. */
export function LocationPicker({ onPick, height = 300, marker }: { onPick: (lat: number, lon: number) => void; height?: number; marker?: [number, number] | null }) {
  return (
    <div>
      <MapView onPick={onPick} height={height} center={marker ?? [12.9716, 77.5946]} points={marker ? [{ lat: marker[0], lon: marker[1], label: "Your location", kind: "customer" }] : []} />
      <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
        Tap the map to drop a pin, or use "Use my location".
      </p>
    </div>
  );
}
