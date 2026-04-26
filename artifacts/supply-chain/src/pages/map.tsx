import { useEffect, useState, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTranslation } from "react-i18next";
import { useListShipments, useListWarehouses, useListDisruptions } from "@workspace/api-client-react";
import {
  Search, Navigation, X, AlertTriangle, Loader2,
  ArrowRight, PencilRuler, Map as MapIcon, Package, Building2,
  LocateFixed, LocateOff, Crosshair, Truck
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useGeolocation } from "@/hooks/use-geolocation";

/* ── Leaflet icon fix ─────────────────────────────────────────── */
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

/* ── Helpers ─────────────────────────────────────────────────── */
function dotIcon(color: string, size = 12) {
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.85);box-shadow:0 0 8px ${color}88"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function labelIcon(label: string, color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="background:${color};color:#fff;font-size:10px;font-weight:800;padding:3px 8px;border-radius:4px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.5);font-family:monospace;letter-spacing:.05em">${label}</div>`,
    iconAnchor: [label.length * 4, 10],
  });
}

const STATUS_COLOR: Record<string, string> = {
  in_transit: "#3b82f6",
  delayed:    "#ef4444",
  at_risk:    "#f59e0b",
  delivered:  "#22c55e",
  pending:    "#6b7280",
};

const warehouseIcon = L.divIcon({
  className: "",
  html: `<div style="width:13px;height:13px;border-radius:3px;background:#8b5cf6;border:2px solid rgba(255,255,255,0.8);box-shadow:0 0 7px #8b5cf688"></div>`,
  iconSize: [13, 13],
  iconAnchor: [6, 6],
});

/* ── Live vehicle marker (rotates with heading) ──────────────── */
function vehicleIcon(heading: number | null) {
  const rot = heading == null || Number.isNaN(heading) ? 0 : heading;
  return L.divIcon({
    className: "",
    html: `
      <div style="position:relative;width:32px;height:32px;display:flex;align-items:center;justify-content:center">
        <div style="position:absolute;inset:0;border-radius:50%;background:#22c55e33;animation:pulse 1.6s ease-out infinite"></div>
        <div style="position:relative;width:22px;height:22px;border-radius:50%;background:#22c55e;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center">
          <div style="transform:rotate(${rot}deg);color:#fff;font-size:11px;line-height:1">▲</div>
        </div>
      </div>
      <style>
        @keyframes pulse {
          0%   { transform: scale(0.6); opacity: 0.9; }
          100% { transform: scale(2.2); opacity: 0;   }
        }
      </style>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

/* Pans the map to follow the live location when "follow" is on */
function FollowMeController({
  position, follow,
}: { position: [number, number] | null; follow: boolean }) {
  const map = useMap();
  const firstFix = useRef(true);
  useEffect(() => {
    if (!position || !follow) return;
    if (firstFix.current) {
      map.flyTo(position, Math.max(map.getZoom(), 14), { duration: 1.2 });
      firstFix.current = false;
    } else {
      map.panTo(position, { animate: true, duration: 0.6 });
    }
  }, [position, follow, map]);
  useEffect(() => {
    if (!follow) firstFix.current = true;
  }, [follow]);
  return null;
}

/* ── Great-circle path (works for any two points on Earth) ───── */
function greatCircle(from: [number, number], to: [number, number], steps = 80): [number, number][] {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const [lat1, lon1] = from.map(toRad);
  const [lat2, lon2] = to.map(toRad);
  const d = 2 * Math.asin(Math.sqrt(
    Math.sin((lat2 - lat1) / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2,
  ));
  if (d < 0.0001) return [from, to];
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t  = i / steps;
    const A  = Math.sin((1 - t) * d) / Math.sin(d);
    const B  = Math.sin(t * d) / Math.sin(d);
    const x  = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
    const y  = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
    const z  = A * Math.sin(lat1) + B * Math.sin(lat2);
    const la = Math.atan2(z, Math.sqrt(x * x + y * y));
    const lo = Math.atan2(y, x);
    pts.push([toDeg(la), toDeg(lo)]);
  }
  return pts;
}

function haversineKm(from: [number, number], to: [number, number]): number {
  const R = 6371;
  const dLat = ((to[0] - from[0]) * Math.PI) / 180;
  const dLon = ((to[1] - from[1]) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((from[0] * Math.PI) / 180) * Math.cos((to[0] * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ── Nominatim geocoding ─────────────────────────────────────── */
interface GeoResult { lat: string; lon: string; display_name: string }

async function geocode(query: string): Promise<GeoResult | null> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=0`,
      { headers: { "Accept-Language": "en", "User-Agent": "SupplyChainOptimizer/1.0" } },
    );
    if (!r.ok) return null;
    const data = await r.json();
    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  } catch { return null; }
}

async function geocodeSuggest(query: string): Promise<GeoResult[]> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=0`,
      { headers: { "Accept-Language": "en", "User-Agent": "SupplyChainOptimizer/1.0" } },
    );
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

/* ── Map controller components ───────────────────────────────── */
function FitBoundsController({ bounds }: { bounds: L.LatLngBoundsExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [70, 70], maxZoom: 8 });
  }, [bounds, map]);
  return null;
}

function FlyToController({ center }: { center: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, 6, { duration: 1.4 });
  }, [center, map]);
  return null;
}

/* ── Main component ──────────────────────────────────────────── */
export default function MapPage() {
  const { t } = useTranslation();
  const { data: shipments = [] } = useListShipments();
  const { data: warehouses = [] } = useListWarehouses();
  const { data: disruptions = [] } = useListDisruptions({ resolved: false });

  /* location search */
  const [searchText, setSearchText]     = useState("");
  const [suggestions, setSuggestions]   = useState<GeoResult[]>([]);
  const [searching, setSearching]       = useState(false);
  const [flyCenter, setFlyCenter]       = useState<[number, number] | null>(null);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* route planner */
  const [origin, setOrigin]             = useState("");
  const [dest, setDest]                 = useState("");
  const [routePath, setRoutePath]       = useState<[number, number][] | null>(null);
  const [routeBounds, setRouteBounds]   = useState<L.LatLngBoundsExpression | null>(null);
  const [originGeo, setOriginGeo]       = useState<GeoResult | null>(null);
  const [destGeo, setDestGeo]           = useState<GeoResult | null>(null);
  const [distKm, setDistKm]             = useState<number | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError]     = useState("");

  /* filter */
  const [filter, setFilter] = useState<"all" | "shipments" | "warehouses">("all");

  /* live location tracking */
  const { tracking, location, error: geoError, start: startTracking, stop: stopTracking } = useGeolocation();
  const [followMe, setFollowMe] = useState(true);
  const [vehicleLabel, setVehicleLabel] = useState("My Vehicle");

  const toggleTracking = () => {
    if (tracking) stopTracking();
    else { setFollowMe(true); startTracking(); }
  };

  const livePosition: [number, number] | null = location
    ? [location.latitude, location.longitude]
    : null;
  const speedKmh = location?.speed != null && location.speed >= 0
    ? location.speed * 3.6
    : null;

  /* search suggestions */
  const handleSearchChange = useCallback((val: string) => {
    setSearchText(val);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (!val.trim()) { setSuggestions([]); return; }
    searchDebounce.current = setTimeout(async () => {
      setSearching(true);
      const res = await geocodeSuggest(val);
      setSuggestions(res);
      setSearching(false);
    }, 450);
  }, []);

  const selectSuggestion = (r: GeoResult) => {
    setFlyCenter([parseFloat(r.lat), parseFloat(r.lon)]);
    setSearchText(r.display_name.split(",").slice(0, 2).join(", "));
    setSuggestions([]);
  };

  /* route planner */
  const handleShowRoute = async () => {
    if (!origin.trim() || !dest.trim()) {
      setRouteError(t("map.enterBoth"));
      return;
    }
    setRouteLoading(true);
    setRouteError("");
    setRoutePath(null);
    setRouteBounds(null);
    setDistKm(null);

    const [og, dg] = await Promise.all([geocode(origin), geocode(dest)]);

    if (!og) { setRouteError(t("map.cannotFind", { q: origin })); setRouteLoading(false); return; }
    if (!dg) { setRouteError(t("map.cannotFind", { q: dest }));   setRouteLoading(false); return; }

    setOriginGeo(og);
    setDestGeo(dg);

    const fromPt: [number, number] = [parseFloat(og.lat), parseFloat(og.lon)];
    const toPt:   [number, number] = [parseFloat(dg.lat), parseFloat(dg.lon)];

    let path: [number, number][] = greatCircle(fromPt, toPt);
    let km   = haversineKm(fromPt, toPt);

    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${fromPt[1]},${fromPt[0]};${toPt[1]},${toPt[0]}?overview=full&geometries=geojson`;
      const resp = await fetch(url);
      if (resp.ok) {
        const data = await resp.json();
        const route = data?.routes?.[0];
        if (route?.geometry?.coordinates?.length) {
          path = route.geometry.coordinates.map(
            ([lon, lat]: [number, number]) => [lat, lon] as [number, number],
          );
          if (typeof route.distance === "number") {
            km = route.distance / 1000;
          }
        }
      }
    } catch {
      // fall back to great-circle if OSRM is unreachable
    }

    setRoutePath(path);
    setDistKm(km);
    setRouteBounds([[fromPt[0], fromPt[1]], [toPt[0], toPt[1]]]);
    setRouteLoading(false);
  };

  const clearRoute = () => {
    setRoutePath(null);
    setRouteBounds(null);
    setOriginGeo(null);
    setDestGeo(null);
    setDistKm(null);
    setRouteError("");
    setOrigin("");
    setDest("");
  };

  const shipmentsOnMap = shipments.filter((s) => s.latitude != null && s.longitude != null);
  const activeDisruptions = disruptions.filter((d) => !d.resolved);

  /* estimated travel time by distance (approximate) */
  const seaHours   = distKm ? Math.round(distKm / 20)   : null;  // ~20 km/h average ship
  const airHours   = distKm ? Math.round(distKm / 900)  : null;  // ~900 km/h plane
  const roadHours  = distKm ? Math.round(distKm / 80)   : null;  // ~80 km/h truck

  return (
    <div className="flex flex-col gap-4" style={{ height: "calc(100vh - 3.5rem - 3rem)" }}>
      {/* header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MapIcon className="h-6 w-6 text-primary" /> {t("map.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("map.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          {(["all", "shipments", "warehouses"] as const).map((f) => (
            <Button key={f} size="sm"
              variant={filter === f ? "default" : "outline"}
              className="text-xs uppercase tracking-wider font-mono"
              onClick={() => setFilter(f)}
            >
              {t(`map.filters.${f}`)}
            </Button>
          ))}
        </div>
      </div>

      {/* body */}
      <div className="flex gap-4 flex-1 min-h-0">

        {/* ── sidebar ── */}
        <div className="flex flex-col gap-3 w-[300px] shrink-0 overflow-y-auto pr-0.5">

          {/* location search */}
          <Card className="bg-card shrink-0">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5" /> {t("map.locationSearch")}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={searchText}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder={t("map.locationPlaceholder")}
                  className="pl-8 bg-background text-sm h-9"
                />
                {searching && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
              {suggestions.length > 0 && (
                <div className="mt-1.5 rounded border border-border bg-background shadow-lg overflow-hidden z-50">
                  {suggestions.map((s, i) => (
                    <button key={i} onClick={() => selectSuggestion(s)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-muted border-b border-border last:border-0 transition-colors">
                      <span className="font-semibold">{s.display_name.split(",")[0]}</span>
                      <span className="text-muted-foreground ml-1 text-[10px]">
                        {s.display_name.split(",").slice(1, 3).join(",")}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* route planner */}
          <Card className="bg-card shrink-0">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Navigation className="h-3.5 w-3.5" /> {t("map.routePlanner")}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              <div className="relative">
                <span className="absolute left-2.5 top-2.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-emerald-300 pointer-events-none" />
                <Input value={origin} onChange={(e) => setOrigin(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleShowRoute()}
                  placeholder={t("map.originPlaceholder")}
                  className="pl-8 bg-background text-sm h-9" />
              </div>
              <div className="flex justify-center">
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="relative">
                <span className="absolute left-2.5 top-2.5 h-3 w-3 rounded-full bg-red-500 border-2 border-red-300 pointer-events-none" />
                <Input value={dest} onChange={(e) => setDest(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleShowRoute()}
                  placeholder={t("map.destPlaceholder")}
                  className="pl-8 bg-background text-sm h-9" />
              </div>

              {routeError && <p className="text-xs text-destructive">{routeError}</p>}

              <div className="flex gap-2 pt-1">
                <Button onClick={handleShowRoute} disabled={routeLoading} className="flex-1 text-xs font-mono uppercase tracking-wider h-9">
                  {routeLoading
                    ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />{t("map.locating")}</>
                    : <><Navigation className="h-3.5 w-3.5 mr-1.5" />{t("map.showRoute")}</>}
                </Button>
                {routePath && (
                  <Button variant="outline" size="icon" onClick={clearRoute} className="h-9 w-9 shrink-0">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* route result card */}
              {distKm && originGeo && destGeo && (
                <div className="rounded border border-primary/30 bg-primary/5 p-3 space-y-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-muted-foreground">{t("map.from")}</span>
                    <span className="font-semibold truncate">{originGeo.display_name.split(",")[0]}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
                    <span className="text-muted-foreground">{t("map.to")}</span>
                    <span className="font-semibold truncate">{destGeo.display_name.split(",")[0]}</span>
                  </div>
                  <div className="border-t border-border/50 pt-2">
                    <div className="flex items-center gap-1.5 mb-2">
                      <PencilRuler className="h-3 w-3 text-primary" />
                      <span className="text-muted-foreground">{t("map.distance")}</span>
                      <span className="font-mono font-bold text-primary">{distKm.toLocaleString()} km</span>
                    </div>
                    <div className="text-muted-foreground text-[10px] uppercase tracking-wider mb-1">{t("map.estimatedTransit")}</div>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { label: t("map.air"),  value: airHours,  color: "text-blue-400" },
                        { label: t("map.sea"),  value: seaHours,  color: "text-cyan-400" },
                        { label: t("map.road"), value: roadHours, color: "text-amber-400" },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="bg-background rounded p-1.5 text-center border border-border">
                          <div className={`font-mono font-bold text-[11px] ${color}`}>
                            {value! >= 24 ? `${Math.round(value! / 24)}d` : `${value}h`}
                          </div>
                          <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* live tracking */}
          <Card className="bg-card shrink-0">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5" /> {t("map.liveTracking")}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              <Input
                value={vehicleLabel}
                onChange={(e) => setVehicleLabel(e.target.value)}
                placeholder={t("map.vehicleLabelPlaceholder")}
                className="bg-background text-sm h-9"
              />

              <Button
                onClick={toggleTracking}
                variant={tracking ? "destructive" : "default"}
                className="w-full text-xs font-mono uppercase tracking-wider h-9"
              >
                {tracking
                  ? <><LocateOff className="h-3.5 w-3.5 mr-1.5" />{t("map.stopTracking")}</>
                  : <><LocateFixed className="h-3.5 w-3.5 mr-1.5" />{t("map.startTracking")}</>}
              </Button>

              {tracking && (
                <div className="flex items-center justify-between rounded border border-border bg-background px-2.5 py-2">
                  <div className="flex items-center gap-1.5 text-xs">
                    <Crosshair className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-muted-foreground">{t("map.followVehicle")}</span>
                  </div>
                  <Switch checked={followMe} onCheckedChange={setFollowMe} />
                </div>
              )}

              {geoError && (
                <p className="text-xs text-destructive flex items-start gap-1.5">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>{geoError}</span>
                </p>
              )}

              {tracking && location && (
                <div className="rounded border border-emerald-500/30 bg-emerald-500/5 p-2.5 space-y-1.5 text-[11px] font-mono">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-emerald-500 font-bold uppercase tracking-wider text-[10px]">
                      {t("map.liveSignal")}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{t("map.lat")}</div>
                      <div className="font-bold">{location.latitude.toFixed(5)}°</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{t("map.lon")}</div>
                      <div className="font-bold">{location.longitude.toFixed(5)}°</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{t("map.speed")}</div>
                      <div className="font-bold">
                        {speedKmh != null ? `${speedKmh.toFixed(1)} km/h` : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{t("map.accuracy")}</div>
                      <div className="font-bold">±{Math.round(location.accuracy)} m</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* legend + stats */}
          <Card className="bg-card shrink-0">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{t("map.legend")}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-1.5 text-xs">
              {Object.entries(STATUS_COLOR).map(([s, c]) => (
                <div key={s} className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full shrink-0" style={{ background: c }} />
                  <span className="capitalize text-muted-foreground">{t(`map.status.${s}`)}</span>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm shrink-0 bg-violet-500" />
                <span className="text-muted-foreground">{t("map.warehousePort")}</span>
              </div>

              {activeDisruptions.length > 0 && (
                <div className="pt-2 border-t border-border space-y-1.5 mt-2">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">{t("map.activeAlerts")}</div>
                  {activeDisruptions.slice(0, 4).map((d) => (
                    <div key={d.id} className="flex items-start gap-1.5">
                      <AlertTriangle className={`h-3 w-3 mt-0.5 shrink-0 ${
                        d.severity === "critical" ? "text-destructive" :
                        d.severity === "high"     ? "text-amber-400" : "text-blue-400"}`} />
                      <span className="text-muted-foreground leading-tight line-clamp-1">{d.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* quick stats */}
          <div className="grid grid-cols-2 gap-2 shrink-0">
            <Card className="bg-card">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Package className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">{t("map.shipments")}</span>
                </div>
                <div className="text-xl font-bold font-mono">{shipmentsOnMap.length}</div>
                <div className="text-[10px] text-muted-foreground">{t("map.plottedOnMap")}</div>
              </CardContent>
            </Card>
            <Card className="bg-card">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Building2 className="h-3.5 w-3.5 text-violet-400" />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">{t("map.facilities")}</span>
                </div>
                <div className="text-xl font-bold font-mono">{warehouses.length}</div>
                <div className="text-[10px] text-muted-foreground">{t("map.portsAndWarehouses")}</div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── map ── */}
        <div className="flex-1 rounded-lg overflow-hidden border border-border min-h-0 relative">
          <MapContainer
            center={[20, 10]}
            zoom={2}
            style={{ height: "100%", width: "100%" }}
            worldCopyJump={true}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              maxZoom={18}
            />

            <FlyToController center={!routePath && !tracking ? flyCenter : null} />
            <FitBoundsController bounds={!tracking ? routeBounds : null} />
            <FollowMeController position={livePosition} follow={tracking && followMe} />

            {/* ── great-circle route ── */}
            {routePath && (
              <>
                {/* glow under-layer */}
                <Polyline positions={routePath}
                  pathOptions={{ color: "#3b82f6", weight: 8, opacity: 0.25 }} />
                {/* main line */}
                <Polyline positions={routePath}
                  pathOptions={{ color: "#60a5fa", weight: 3, opacity: 0.95, dashArray: "8 4" }} />
              </>
            )}

            {/* origin marker */}
            {originGeo && routePath && (
              <Marker
                position={[parseFloat(originGeo.lat), parseFloat(originGeo.lon)]}
                icon={labelIcon("FROM", "#22c55e")}
              >
                <Popup><strong>{originGeo.display_name.split(",")[0]}</strong><br />{originGeo.display_name}</Popup>
              </Marker>
            )}

            {/* destination marker */}
            {destGeo && routePath && (
              <Marker
                position={[parseFloat(destGeo.lat), parseFloat(destGeo.lon)]}
                icon={labelIcon("TO", "#ef4444")}
              >
                <Popup><strong>{destGeo.display_name.split(",")[0]}</strong><br />{destGeo.display_name}</Popup>
              </Marker>
            )}

            {/* ── shipments ── */}
            {(filter === "all" || filter === "shipments") &&
              shipmentsOnMap.map((s) => (
                <Marker key={s.id}
                  position={[s.latitude!, s.longitude!]}
                  icon={dotIcon(STATUS_COLOR[s.status] ?? "#6b7280")}
                >
                  <Popup>
                    <div style={{ minWidth: 190, fontFamily: "monospace" }}>
                      <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 4 }}>{s.trackingId}</div>
                      <table style={{ fontSize: 11, borderCollapse: "collapse", width: "100%" }}>
                        <tbody>
                          {[
                            ["From", s.origin],
                            ["To", s.destination],
                            ["Now", s.currentLocation],
                            ["Mode", s.transportMode],
                            ["Carrier", s.carrier],
                          ].map(([k, v]) => (
                            <tr key={k}>
                              <td style={{ color: "#888", paddingRight: 6, paddingBottom: 2 }}>{k}</td>
                              <td style={{ paddingBottom: 2 }}>{v}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div style={{ marginTop: 6, display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{
                          background: STATUS_COLOR[s.status] ?? "#6b7280",
                          color: "#fff", fontSize: 10, padding: "2px 6px",
                          borderRadius: 3, fontWeight: 700, textTransform: "uppercase",
                        }}>{s.status.replace(/_/g, " ")}</span>
                        <span style={{ fontSize: 10, color: "#888" }}>Risk: {s.riskScore.toFixed(0)}/100</span>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}

            {/* ── live vehicle ── */}
            {tracking && livePosition && (
              <>
                <Circle
                  center={livePosition}
                  radius={Math.max(20, location?.accuracy ?? 30)}
                  pathOptions={{ color: "#22c55e", fillColor: "#22c55e", fillOpacity: 0.12, weight: 1, opacity: 0.5 }}
                />
                <Marker position={livePosition} icon={vehicleIcon(location?.heading ?? null)}>
                  <Popup>
                    <div style={{ minWidth: 180, fontFamily: "monospace" }}>
                      <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 4, color: "#22c55e" }}>
                        {vehicleLabel || "My Vehicle"}
                      </div>
                      <table style={{ fontSize: 11, borderCollapse: "collapse", width: "100%" }}>
                        <tbody>
                          <tr>
                            <td style={{ color: "#888", paddingRight: 6, paddingBottom: 2 }}>Lat</td>
                            <td style={{ paddingBottom: 2 }}>{location!.latitude.toFixed(5)}°</td>
                          </tr>
                          <tr>
                            <td style={{ color: "#888", paddingRight: 6, paddingBottom: 2 }}>Lon</td>
                            <td style={{ paddingBottom: 2 }}>{location!.longitude.toFixed(5)}°</td>
                          </tr>
                          <tr>
                            <td style={{ color: "#888", paddingRight: 6, paddingBottom: 2 }}>Accuracy</td>
                            <td style={{ paddingBottom: 2 }}>±{Math.round(location!.accuracy)} m</td>
                          </tr>
                          <tr>
                            <td style={{ color: "#888", paddingRight: 6, paddingBottom: 2 }}>Speed</td>
                            <td style={{ paddingBottom: 2 }}>
                              {speedKmh != null ? `${speedKmh.toFixed(1)} km/h` : "—"}
                            </td>
                          </tr>
                          <tr>
                            <td style={{ color: "#888", paddingRight: 6, paddingBottom: 2 }}>Heading</td>
                            <td style={{ paddingBottom: 2 }}>
                              {location!.heading != null ? `${Math.round(location!.heading)}°` : "—"}
                            </td>
                          </tr>
                          <tr>
                            <td style={{ color: "#888", paddingRight: 6, paddingBottom: 2 }}>Updated</td>
                            <td style={{ paddingBottom: 2 }}>
                              {new Date(location!.timestamp).toLocaleTimeString()}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </Popup>
                </Marker>
              </>
            )}

            {/* ── warehouses ── */}
            {(filter === "all" || filter === "warehouses") &&
              warehouses.map((w) => (
                <Marker key={w.id}
                  position={[w.latitude, w.longitude]}
                  icon={warehouseIcon}
                >
                  <Popup>
                    <div style={{ minWidth: 180, fontFamily: "monospace" }}>
                      <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 4 }}>{w.name}</div>
                      <table style={{ fontSize: 11, borderCollapse: "collapse" }}>
                        <tbody>
                          {[
                            ["Type", w.type.replace(/_/g, " ")],
                            ["Location", `${w.city}, ${w.country}`],
                            ["Congestion", w.congestionLevel],
                            ["Occupancy", `${((w.currentOccupancy / w.capacity) * 100).toFixed(0)}%`],
                            ["Status", w.operationalStatus],
                          ].map(([k, v]) => (
                            <tr key={k}>
                              <td style={{ color: "#888", paddingRight: 6, paddingBottom: 2 }}>{k}</td>
                              <td style={{ paddingBottom: 2, color: k === "Congestion" && v === "critical" ? "#ef4444" : "inherit", fontWeight: k === "Congestion" && v !== "low" ? 700 : 400 }}>{v}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Popup>
                </Marker>
              ))}
          </MapContainer>

          {/* overlay counters */}
          <div className="absolute top-3 right-3 z-[400] flex flex-col gap-1.5 pointer-events-none select-none">
            <div className="bg-background/90 backdrop-blur-sm border border-border rounded px-2.5 py-1.5 text-xs font-mono">
              <span className="text-primary font-bold">{shipmentsOnMap.length}</span>
              <span className="text-muted-foreground ml-1">shipments</span>
            </div>
            <div className="bg-background/90 backdrop-blur-sm border border-border rounded px-2.5 py-1.5 text-xs font-mono">
              <span className="text-violet-400 font-bold">{warehouses.length}</span>
              <span className="text-muted-foreground ml-1">facilities</span>
            </div>
            {activeDisruptions.length > 0 && (
              <div className="bg-background/90 backdrop-blur-sm border border-amber-500/30 rounded px-2.5 py-1.5 text-xs font-mono text-amber-400">
                <AlertTriangle className="inline h-3 w-3 mr-1" />
                <span className="font-bold">{activeDisruptions.length}</span>
                <span className="ml-1">alerts</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
