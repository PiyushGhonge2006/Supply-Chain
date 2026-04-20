import { useEffect, useRef, useState, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, LayersControl } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useListShipments, useListWarehouses, useListDisruptions } from "@workspace/api-client-react";
import { Search, Navigation, X, AlertTriangle, Package, Warehouse, Loader2, ArrowRight, Clock, DollarSign, Ruler } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const makeIcon = (color: string, size = 12) =>
  L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.8);box-shadow:0 0 6px ${color}"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

const shipmentStatusColor: Record<string, string> = {
  in_transit: "#3b82f6",
  delayed: "#ef4444",
  at_risk: "#f59e0b",
  delivered: "#22c55e",
  pending: "#6b7280",
};

const warehouseIcon = L.divIcon({
  className: "",
  html: `<div style="width:14px;height:14px;border-radius:3px;background:#8b5cf6;border:2px solid rgba(255,255,255,0.8);box-shadow:0 0 6px #8b5cf6"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

interface GeoResult {
  lat: string;
  lon: string;
  display_name: string;
}

interface RouteResult {
  geometry: { coordinates: [number, number][] };
  distance: number;
  duration: number;
}

function FlyTo({ coords }: { coords: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (coords) map.flyTo(coords, 5, { duration: 1.5 });
  }, [coords, map]);
  return null;
}

function FitRoute({ bounds }: { bounds: L.LatLngBounds | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [60, 60] });
  }, [bounds, map]);
  return null;
}

async function geocode(query: string): Promise<GeoResult | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      { headers: { "Accept-Language": "en" } }
    );
    const data = await res.json();
    return data[0] ?? null;
  } catch {
    return null;
  }
}

async function fetchRoute(
  from: [number, number],
  to: [number, number]
): Promise<RouteResult | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.code !== "Ok") return null;
    return data.routes[0];
  } catch {
    return null;
  }
}

export default function MapPage() {
  const { data: shipments } = useListShipments();
  const { data: warehouses } = useListWarehouses();
  const { data: disruptions } = useListDisruptions({ resolved: false });

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GeoResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null);

  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [originGeo, setOriginGeo] = useState<GeoResult | null>(null);
  const [destGeo, setDestGeo] = useState<GeoResult | null>(null);
  const [routePath, setRoutePath] = useState<[number, number][] | null>(null);
  const [routeBounds, setRouteBounds] = useState<L.LatLngBounds | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number } | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState("");

  const [activeFilter, setActiveFilter] = useState<"all" | "shipments" | "warehouses">("all");
  const [selectedShipment, setSelectedShipment] = useState<string | null>(null);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!q.trim()) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5`,
          { headers: { "Accept-Language": "en" } }
        );
        const data: GeoResult[] = await res.json();
        setSearchResults(data);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 400);
  }, []);

  const handleSearchSelect = (result: GeoResult) => {
    setFlyTo([parseFloat(result.lat), parseFloat(result.lon)]);
    setSearchQuery(result.display_name.split(",").slice(0, 2).join(", "));
    setSearchResults([]);
  };

  const handleRouteSearch = async () => {
    if (!origin.trim() || !destination.trim()) {
      setRouteError("Please enter both origin and destination.");
      return;
    }
    setRouteLoading(true);
    setRouteError("");
    setRoutePath(null);
    setRouteInfo(null);

    const [og, dg] = await Promise.all([geocode(origin), geocode(destination)]);
    if (!og) { setRouteError(`Could not find location: "${origin}"`); setRouteLoading(false); return; }
    if (!dg) { setRouteError(`Could not find location: "${destination}"`); setRouteLoading(false); return; }

    setOriginGeo(og);
    setDestGeo(dg);

    const fromCoords: [number, number] = [parseFloat(og.lat), parseFloat(og.lon)];
    const toCoords: [number, number] = [parseFloat(dg.lat), parseFloat(dg.lon)];

    const route = await fetchRoute(fromCoords, toCoords);
    if (route) {
      const path = route.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
      setRoutePath(path);
      setRouteInfo({ distance: route.distance, duration: route.duration });
      const bounds = L.latLngBounds([fromCoords, toCoords]);
      setRouteBounds(bounds);
    } else {
      const fallback: [number, number][] = [fromCoords, toCoords];
      setRoutePath(fallback);
      setRouteBounds(L.latLngBounds(fallback));
      setRouteInfo(null);
    }

    setRouteLoading(false);
  };

  const clearRoute = () => {
    setRoutePath(null);
    setRouteInfo(null);
    setOriginGeo(null);
    setDestGeo(null);
    setRouteError("");
    setRouteBounds(null);
  };

  const shipmentsOnMap = (shipments ?? []).filter(
    (s) => s.latitude != null && s.longitude != null
  );
  const warehousesOnMap = warehouses ?? [];

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem-3rem)] gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">World Map</h1>
          <p className="text-sm text-muted-foreground">Live shipment tracking and route planning</p>
        </div>
        <div className="flex gap-2">
          {(["all", "shipments", "warehouses"] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={activeFilter === f ? "default" : "outline"}
              onClick={() => setActiveFilter(f)}
              className="text-xs uppercase tracking-wider font-mono"
            >
              {f}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        <div className="flex flex-col gap-3 w-80 shrink-0">
          <Card className="bg-card">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Location Search</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search any city, port, airport..."
                  className="pl-8 bg-background text-sm"
                />
                {searchLoading && (
                  <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              {searchResults.length > 0 && (
                <div className="mt-1 rounded-md border border-border bg-background shadow-lg overflow-hidden">
                  {searchResults.map((r, i) => (
                    <button
                      key={i}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors border-b border-border last:border-0"
                      onClick={() => handleSearchSelect(r)}
                    >
                      <span className="font-medium">{r.display_name.split(",")[0]}</span>
                      <span className="text-muted-foreground ml-1 text-[10px]">
                        {r.display_name.split(",").slice(1, 3).join(",")}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Navigation className="h-3.5 w-3.5" />
                Route Planner
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 flex flex-col gap-2">
              <div className="relative">
                <div className="absolute left-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border border-emerald-300" />
                <Input
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRouteSearch()}
                  placeholder="Origin (e.g. Shanghai)"
                  className="pl-8 bg-background text-sm"
                />
              </div>
              <div className="relative">
                <div className="absolute left-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-red-500 border border-red-300" />
                <Input
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRouteSearch()}
                  placeholder="Destination (e.g. Los Angeles)"
                  className="pl-8 bg-background text-sm"
                />
              </div>
              {routeError && (
                <p className="text-xs text-destructive">{routeError}</p>
              )}
              <div className="flex gap-2">
                <Button
                  onClick={handleRouteSearch}
                  disabled={routeLoading}
                  className="flex-1 text-xs font-mono uppercase tracking-wider"
                >
                  {routeLoading ? (
                    <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Calculating...</>
                  ) : (
                    <><Navigation className="h-3.5 w-3.5 mr-1.5" />Show Route</>
                  )}
                </Button>
                {routePath && (
                  <Button variant="outline" size="icon" onClick={clearRoute} className="shrink-0">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {routeInfo && originGeo && destGeo && (
                <div className="mt-2 rounded-md border border-border bg-background p-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="text-muted-foreground">From:</span>
                    <span className="font-medium truncate">{originGeo.display_name.split(",")[0]}</span>
                  </div>
                  <div className="flex items-center justify-center">
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className="h-2 w-2 rounded-full bg-red-500" />
                    <span className="text-muted-foreground">To:</span>
                    <span className="font-medium truncate">{destGeo.display_name.split(",")[0]}</span>
                  </div>
                  <div className="border-t border-border pt-2 grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-1.5 text-xs">
                      <Ruler className="h-3 w-3 text-primary" />
                      <div>
                        <div className="text-muted-foreground">Distance</div>
                        <div className="font-mono font-bold">{(routeInfo.distance / 1000).toFixed(0)} km</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <Clock className="h-3 w-3 text-amber-500" />
                      <div>
                        <div className="text-muted-foreground">Est. Time</div>
                        <div className="font-mono font-bold">
                          {routeInfo.duration >= 3600
                            ? `${Math.round(routeInfo.duration / 3600)}h`
                            : `${Math.round(routeInfo.duration / 60)}m`}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {routePath && !routeInfo && (
                <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                  Showing direct path — road routing unavailable for this region.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card flex-1 overflow-hidden">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-mono uppercase tracking-wider text-muted-foreground">Legend</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2 text-xs">
              {Object.entries(shipmentStatusColor).map(([status, color]) => (
                <div key={status} className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full shrink-0" style={{ background: color }} />
                  <span className="capitalize text-muted-foreground">{status.replace("_", " ")}</span>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-sm shrink-0 bg-violet-500" />
                <span className="text-muted-foreground">Warehouse / Port</span>
              </div>
              {(disruptions ?? []).filter((d) => !d.resolved).length > 0 && (
                <div className="mt-3 pt-3 border-t border-border space-y-1">
                  <div className="text-muted-foreground font-mono uppercase text-[10px] tracking-wider mb-2">Active Disruptions</div>
                  {(disruptions ?? []).filter((d) => !d.resolved).slice(0, 4).map((d) => (
                    <div key={d.id} className="flex items-start gap-1.5">
                      <AlertTriangle className={`h-3 w-3 mt-0.5 shrink-0 ${
                        d.severity === "critical" ? "text-destructive" :
                        d.severity === "high" ? "text-amber-500" : "text-blue-400"
                      }`} />
                      <span className="text-muted-foreground leading-tight line-clamp-1">{d.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex-1 rounded-lg overflow-hidden border border-border relative">
          <MapContainer
            center={[20, 0]}
            zoom={2}
            style={{ height: "100%", width: "100%" }}
            className="z-0"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {flyTo && !routePath && <FlyTo coords={flyTo} />}
            {routeBounds && <FitRoute bounds={routeBounds} />}

            {routePath && originGeo && (
              <>
                <Polyline
                  positions={routePath}
                  pathOptions={{ color: "#3b82f6", weight: 4, opacity: 0.85, dashArray: undefined }}
                />
                <Marker
                  position={[parseFloat(originGeo.lat), parseFloat(originGeo.lon)]}
                  icon={L.divIcon({
                    className: "",
                    html: `<div style="background:#22c55e;color:white;font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.4);font-family:monospace">FROM</div>`,
                    iconAnchor: [20, 10],
                  })}
                >
                  <Popup>{originGeo.display_name}</Popup>
                </Marker>
                {destGeo && (
                  <Marker
                    position={[parseFloat(destGeo.lat), parseFloat(destGeo.lon)]}
                    icon={L.divIcon({
                      className: "",
                      html: `<div style="background:#ef4444;color:white;font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.4);font-family:monospace">TO</div>`,
                      iconAnchor: [14, 10],
                    })}
                  >
                    <Popup>{destGeo.display_name}</Popup>
                  </Marker>
                )}
              </>
            )}

            {(activeFilter === "all" || activeFilter === "shipments") &&
              shipmentsOnMap.map((s) => (
                <Marker
                  key={s.id}
                  position={[s.latitude!, s.longitude!]}
                  icon={makeIcon(shipmentStatusColor[s.status] ?? "#6b7280")}
                  eventHandlers={{ click: () => setSelectedShipment(String(s.id)) }}
                >
                  <Popup>
                    <div className="min-w-[180px]">
                      <div className="font-mono font-bold text-sm">{s.trackingId}</div>
                      <div className="text-xs mt-1 space-y-0.5">
                        <div><span className="text-gray-500">From:</span> {s.origin}</div>
                        <div><span className="text-gray-500">To:</span> {s.destination}</div>
                        <div><span className="text-gray-500">Now:</span> {s.currentLocation}</div>
                        <div><span className="text-gray-500">Mode:</span> {s.transportMode}</div>
                        <div className="flex items-center gap-1 mt-1">
                          <span
                            style={{ background: shipmentStatusColor[s.status] }}
                            className="text-white text-[10px] px-1.5 py-0.5 rounded font-bold uppercase"
                          >
                            {s.status.replace("_", " ")}
                          </span>
                          <span className="text-gray-500 text-[10px]">Risk: {s.riskScore.toFixed(0)}/100</span>
                        </div>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}

            {(activeFilter === "all" || activeFilter === "warehouses") &&
              warehousesOnMap.map((w) => (
                <Marker
                  key={w.id}
                  position={[w.latitude, w.longitude]}
                  icon={warehouseIcon}
                >
                  <Popup>
                    <div className="min-w-[180px]">
                      <div className="font-bold text-sm">{w.name}</div>
                      <div className="text-xs mt-1 space-y-0.5">
                        <div><span className="text-gray-500">Type:</span> {w.type.replace("_", " ")}</div>
                        <div><span className="text-gray-500">Location:</span> {w.city}, {w.country}</div>
                        <div><span className="text-gray-500">Congestion:</span> <span className={
                          w.congestionLevel === "critical" ? "text-red-600 font-bold" :
                          w.congestionLevel === "high" ? "text-orange-500 font-bold" :
                          "text-green-600"
                        }>{w.congestionLevel}</span></div>
                        <div><span className="text-gray-500">Occupancy:</span> {((w.currentOccupancy / w.capacity) * 100).toFixed(0)}%</div>
                        <div><span className="text-gray-500">Status:</span> {w.operationalStatus}</div>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
          </MapContainer>

          <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-1.5 pointer-events-none">
            <div className="bg-background/90 backdrop-blur-sm rounded px-2 py-1.5 text-xs font-mono text-muted-foreground border border-border">
              <span className="text-primary font-bold">{shipmentsOnMap.length}</span> shipments
            </div>
            <div className="bg-background/90 backdrop-blur-sm rounded px-2 py-1.5 text-xs font-mono text-muted-foreground border border-border">
              <span className="text-violet-400 font-bold">{warehousesOnMap.length}</span> facilities
            </div>
            {(disruptions ?? []).filter((d) => !d.resolved).length > 0 && (
              <div className="bg-background/90 backdrop-blur-sm rounded px-2 py-1.5 text-xs font-mono text-amber-400 border border-amber-500/30">
                <AlertTriangle className="inline h-3 w-3 mr-1" />
                <span className="font-bold">{(disruptions ?? []).filter((d) => !d.resolved).length}</span> alerts
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
