import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  CircleMarker,
  LayersControl,
  Tooltip as LeafletTooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  useListWarehouses,
  useListDisruptions,
} from "@workspace/api-client-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Navigation,
  Zap,
  AlertTriangle,
  Clock,
  Route as RouteIcon,
  Satellite,
  Activity,
  RefreshCw,
  BellRing,
  X,
  ArrowRight,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import {
  buildGraph,
  applyIncidents,
  yenKShortestPaths,
  type GraphNode,
  type LatLng,
  type PathResult,
} from "@/lib/graph";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const SEED_NODES: GraphNode[] = [
  { id: "mum",  name: "Mumbai Port",     city: "Mumbai",    country: "IN", position: [19.0760, 72.8777] },
  { id: "blr",  name: "Bangalore Hub",   city: "Bangalore", country: "IN", position: [12.9716, 77.5946] },
  { id: "del",  name: "Delhi DC",        city: "Delhi",     country: "IN", position: [28.7041, 77.1025] },
  { id: "che",  name: "Chennai Port",    city: "Chennai",   country: "IN", position: [13.0827, 80.2707] },
  { id: "kol",  name: "Kolkata Hub",     city: "Kolkata",   country: "IN", position: [22.5726, 88.3639] },
  { id: "hyd",  name: "Hyderabad DC",    city: "Hyderabad", country: "IN", position: [17.3850, 78.4867] },
  { id: "ahd",  name: "Ahmedabad Hub",   city: "Ahmedabad", country: "IN", position: [23.0225, 72.5714] },
  { id: "jai",  name: "Jaipur DC",       city: "Jaipur",    country: "IN", position: [26.9124, 75.7873] },
  { id: "pun",  name: "Pune Hub",        city: "Pune",      country: "IN", position: [18.5204, 73.8567] },
  { id: "luk",  name: "Lucknow DC",      city: "Lucknow",   country: "IN", position: [26.8467, 80.9462] },
  { id: "bho",  name: "Bhopal Hub",      city: "Bhopal",    country: "IN", position: [23.2599, 77.4126] },
  { id: "nag",  name: "Nagpur Junction", city: "Nagpur",    country: "IN", position: [21.1458, 79.0882] },
  { id: "vsk",  name: "Visakhapatnam",   city: "Vizag",     country: "IN", position: [17.6868, 83.2185] },
  { id: "coc",  name: "Cochin Port",     city: "Kochi",     country: "IN", position: [9.9312, 76.2673]  },
];

const PATH_COLORS = [
  "#22c55e",
  "#3b82f6",
  "#a855f7",
  "#06b6d4",
  "#eab308",
  "#f97316",
  "#ec4899",
  "#94a3b8",
];

function pinIcon(label: string, color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;flex-direction:column;align-items:center">
      <div style="background:${color};color:#fff;font-size:10px;font-weight:800;padding:3px 8px;border-radius:4px;font-family:monospace;letter-spacing:.05em;box-shadow:0 2px 8px rgba(0,0,0,0.5);white-space:nowrap">${label}</div>
      <div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;margin-top:2px;box-shadow:0 0 10px ${color}"></div>
    </div>`,
    iconAnchor: [40, 26],
  });
}

const nodeIcon = L.divIcon({
  className: "",
  html: `<div style="width:10px;height:10px;border-radius:50%;background:#94a3b8;border:2px solid rgba(255,255,255,0.7);box-shadow:0 0 4px rgba(0,0,0,0.4)"></div>`,
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length < 2) return;
    const bounds = L.latLngBounds(points.map((p) => L.latLng(p[0], p[1])));
    map.fitBounds(bounds, { padding: [60, 60] });
  }, [points, map]);
  return null;
}

interface Incident {
  id: string;
  position: LatLng;
  radiusKm: number;
  severity: number;
  title: string;
  type: string;
}

interface RerouteAlert {
  id: string;
  at: number;
  source: string;
  target: string;
  before: PathResult;
  after: PathResult;
  trigger: string;
  acknowledged: boolean;
}

function severityNumber(s: string): number {
  switch (s) {
    case "critical": return 5;
    case "high":     return 4;
    case "medium":   return 3;
    case "low":      return 2;
    default:         return 2;
  }
}

const SIM_INCIDENT_POOL: Omit<Incident, "id">[] = [
  { position: [21.1458, 79.0882], radiusKm: 90, severity: 4, title: "Highway accident on NH44", type: "accident" },
  { position: [25.0, 78.0],       radiusKm: 110, severity: 5, title: "Bridge collapse — full closure", type: "infrastructure" },
  { position: [16.5, 80.6],       radiusKm: 80, severity: 3, title: "Heavy monsoon flooding",     type: "weather" },
  { position: [27.0, 75.0],       radiusKm: 70, severity: 4, title: "Truck strike blocking road", type: "labor" },
  { position: [20.0, 73.5],       radiusKm: 60, severity: 3, title: "Multi-vehicle pileup",       type: "accident" },
];

export default function RouteFinder() {
  const { data: warehouses } = useListWarehouses();
  const { data: disruptions, refetch: refetchDisruptions } = useListDisruptions({});

  const [source, setSource] = useState<string>("mum");
  const [target, setTarget] = useState<string>("del");
  const [k, setK] = useState<number>(6);
  const [activePath, setActivePath] = useState<number>(0);
  const [satellite, setSatellite] = useState<boolean>(true);
  const [scanTick, setScanTick] = useState(0);
  const [simIncidents, setSimIncidents] = useState<Incident[]>([
    { id: "sim-0", ...SIM_INCIDENT_POOL[0] },
    { id: "sim-1", ...SIM_INCIDENT_POOL[1] },
  ]);
  const [reroutes, setReroutes] = useState<RerouteAlert[]>([]);
  const [showCompare, setShowCompare] = useState<RerouteAlert | null>(null);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setScanTick((x) => x + 1), 4000);
    return () => clearInterval(t);
  }, []);

  const nodes: GraphNode[] = useMemo(() => {
    if (warehouses && warehouses.length >= 4) {
      return warehouses.map((w: any) => ({
        id: String(w.id),
        name: w.name,
        city: w.city,
        country: w.country,
        position: [Number(w.latitude), Number(w.longitude)] as LatLng,
      }));
    }
    return SEED_NODES;
  }, [warehouses]);

  useEffect(() => {
    if (nodes.length === 0) return;
    if (!nodes.find((n) => n.id === source)) setSource(nodes[0].id);
    if (!nodes.find((n) => n.id === target))
      setTarget(nodes[nodes.length - 1].id);
  }, [nodes, source, target]);

  const liveIncidents: Incident[] = useMemo(() => {
    const out: Incident[] = [...simIncidents];
    (disruptions ?? []).forEach((d: any, i: number) => {
      if (d.resolved) return;
      if (d.latitude == null || d.longitude == null) return;
      out.push({
        id: `live-${d.id ?? i}`,
        position: [Number(d.latitude), Number(d.longitude)],
        radiusKm: 80 + severityNumber(d.severity) * 20,
        severity: severityNumber(d.severity),
        title: d.title ?? "Live disruption",
        type: d.type ?? "incident",
      });
    });
    return out;
  }, [disruptions, simIncidents]);

  const baseGraph = useMemo(
    () => buildGraph(nodes, { maxNeighbors: 5 }),
    [nodes],
  );
  const graph = useMemo(
    () => applyIncidents(baseGraph, liveIncidents),
    [baseGraph, liveIncidents],
  );

  const paths: PathResult[] = useMemo(() => {
    if (source === target) return [];
    return yenKShortestPaths(graph, source, target, k);
  }, [graph, source, target, k]);

  useEffect(() => {
    setActivePath(0);
  }, [source, target, k]);

  const lastBestRef = useRef<{
    key: string;
    path: PathResult;
    incidentIds: string[];
  } | null>(null);

  useEffect(() => {
    if (paths.length === 0) return;
    const best = paths[0];
    const key = `${source}|${target}`;
    const currentIncidentIds = liveIncidents.map((i) => i.id).sort();
    const prev = lastBestRef.current;

    if (!prev || prev.key !== key) {
      lastBestRef.current = { key, path: best, incidentIds: currentIncidentIds };
      return;
    }

    const samePath =
      prev.path.nodes.length === best.nodes.length &&
      prev.path.nodes.every((n, i) => n === best.nodes[i]);

    if (!samePath) {
      const newIds = currentIncidentIds.filter((id) => !prev.incidentIds.includes(id));
      const trigger =
        newIds.length > 0
          ? liveIncidents.find((i) => i.id === newIds[0])?.title ?? "New incident detected"
          : "Network conditions changed";

      const alert: RerouteAlert = {
        id: `rr-${Date.now()}`,
        at: Date.now(),
        source,
        target,
        before: prev.path,
        after: best,
        trigger,
        acknowledged: false,
      };
      setReroutes((cur) => [alert, ...cur].slice(0, 8));

      if (!muted && typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "granted") {
          new Notification("Optimal route changed", { body: trigger });
        }
      }
    }

    lastBestRef.current = { key, path: best, incidentIds: currentIncidentIds };
  }, [paths, source, target, liveIncidents, muted]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  const unacknowledged = reroutes.filter((r) => !r.acknowledged);
  function acknowledgeAlert(id: string) {
    setReroutes((cur) =>
      cur.map((r) => (r.id === id ? { ...r, acknowledged: true } : r)),
    );
  }
  function dismissAlert(id: string) {
    setReroutes((cur) => cur.filter((r) => r.id !== id));
  }

  const allMapPoints: LatLng[] = useMemo(() => {
    const p: LatLng[] = nodes.map((n) => n.position);
    return p;
  }, [nodes]);

  function pathPolyline(p: PathResult): LatLng[] {
    return p.nodes
      .map((id) => graph.nodes.get(id)?.position)
      .filter(Boolean) as LatLng[];
  }

  function injectSimulatedIncident() {
    const used = new Set(simIncidents.map((i) => i.title));
    const pool = SIM_INCIDENT_POOL.filter((p) => !used.has(p.title));
    if (pool.length === 0) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    setSimIncidents((cur) => [
      ...cur,
      { id: `sim-${Date.now()}`, ...pick },
    ]);
  }

  function clearSimulated() {
    setSimIncidents([]);
  }

  const sourceNode = graph.nodes.get(source);
  const targetNode = graph.nodes.get(target);
  const best = paths[0];

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1 flex items-center gap-2">
            <RouteIcon className="h-6 w-6" /> Route Finder
          </h1>
          <p className="text-sm text-muted-foreground">
            Multi-path discovery with live incident-aware re-routing
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-[10px] uppercase flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            Live Scan {scanTick}
          </Badge>
          <Button
            variant={muted ? "outline" : "ghost"}
            size="sm"
            onClick={() => setMuted((m) => !m)}
            title={muted ? "Alerts muted" : "Alerts on"}
          >
            <BellRing className={`h-3 w-3 mr-1 ${muted ? "opacity-40" : ""}`} />
            {muted ? "Muted" : "Alerts"}
            {unacknowledged.length > 0 && !muted && (
              <span className="ml-1 inline-flex items-center justify-center text-[9px] font-bold bg-red-500 text-white rounded-full h-4 min-w-4 px-1">
                {unacknowledged.length}
              </span>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchDisruptions()}
          >
            <RefreshCw className="h-3 w-3 mr-1" /> Refresh feed
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
              Origin
            </label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {nodes.map((n) => (
                  <SelectItem key={n.id} value={n.id}>
                    {n.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
              Destination
            </label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {nodes.map((n) => (
                  <SelectItem key={n.id} value={n.id}>
                    {n.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
              Routes to compare
            </label>
            <Select value={String(k)} onValueChange={(v) => setK(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[4, 5, 6, 7, 8].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    Top {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant={satellite ? "default" : "outline"}
            onClick={() => setSatellite((s) => !s)}
            className="gap-2"
          >
            <Satellite className="h-4 w-4" />
            {satellite ? "Satellite" : "Streets"}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={injectSimulatedIncident} className="gap-2 flex-1">
              <AlertTriangle className="h-4 w-4" /> Sim incident
            </Button>
            <Button variant="ghost" onClick={clearSimulated}>
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {unacknowledged.length > 0 && !muted && (
        <div className="flex flex-col gap-2">
          {unacknowledged.slice(0, 2).map((a) => {
            const distDelta = a.after.totalDistance - a.before.totalDistance;
            const longer = distDelta > 0;
            return (
              <div
                key={a.id}
                className="border border-red-500/40 bg-red-500/10 rounded-md p-3 flex items-center gap-3 animate-in fade-in slide-in-from-top-2"
              >
                <div className="h-9 w-9 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                  <BellRing className="h-4 w-4 text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-mono uppercase tracking-wider font-bold text-red-500">
                    Optimal route changed
                  </div>
                  <div className="text-sm truncate">
                    {a.trigger} —{" "}
                    <span className="text-muted-foreground">
                      now via{" "}
                      {a.after.nodes
                        .map((id) => graph.nodes.get(id)?.city ?? id)
                        .join(" → ")}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-muted-foreground mt-0.5 flex items-center gap-2">
                    {longer ? (
                      <span className="text-red-400 flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />+{distDelta.toFixed(0)} km
                      </span>
                    ) : (
                      <span className="text-green-400 flex items-center gap-1">
                        <TrendingDown className="h-3 w-3" />
                        {distDelta.toFixed(0)} km
                      </span>
                    )}
                    <span>·</span>
                    <span>{new Date(a.at).toLocaleTimeString()}</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCompare(a)}
                >
                  Compare
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => acknowledgeAlert(a.id)}
                >
                  Ack
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => dismissAlert(a.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
          {unacknowledged.length > 2 && (
            <div className="text-[11px] font-mono text-muted-foreground px-1">
              + {unacknowledged.length - 2} more re-route alert(s)
            </div>
          )}
        </div>
      )}

      {showCompare && (
        <Card className="border-primary/40">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-mono uppercase tracking-wider flex items-center gap-2">
              <ArrowRight className="h-4 w-4" /> Before / After re-route
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowCompare(null)}
            >
              <X className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(() => {
              const distDelta = showCompare.after.totalDistance - showCompare.before.totalDistance;
              const stopsDelta = showCompare.after.nodes.length - showCompare.before.nodes.length;
              return (
                <>
                  <div className="border border-border rounded-md p-3 bg-secondary/30">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="h-2 w-2 rounded-full bg-muted-foreground" />
                      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        Before — original optimal
                      </span>
                    </div>
                    <div className="text-lg font-bold">
                      {showCompare.before.totalDistance.toFixed(0)} km
                    </div>
                    <div className="text-[11px] font-mono text-muted-foreground">
                      {showCompare.before.nodes.length} stops ·{" "}
                      {(showCompare.before.totalDistance / 60).toFixed(1)} h
                    </div>
                    <div className="mt-2 text-xs">
                      {showCompare.before.nodes
                        .map((id) => graph.nodes.get(id)?.city ?? id)
                        .join(" → ")}
                    </div>
                  </div>
                  <div className="border border-primary/40 rounded-md p-3 bg-primary/5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="font-mono text-[10px] uppercase tracking-wider text-green-500">
                        After — new optimal
                      </span>
                    </div>
                    <div className="text-lg font-bold flex items-center gap-2">
                      {showCompare.after.totalDistance.toFixed(0)} km
                      <span
                        className={`text-xs ${distDelta > 0 ? "text-red-400" : "text-green-400"}`}
                      >
                        ({distDelta > 0 ? "+" : ""}
                        {distDelta.toFixed(0)} km)
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-muted-foreground">
                      {showCompare.after.nodes.length} stops{" "}
                      {stopsDelta !== 0 &&
                        `(${stopsDelta > 0 ? "+" : ""}${stopsDelta})`}{" "}
                      · {(showCompare.after.totalDistance / 60).toFixed(1)} h
                    </div>
                    <div className="mt-2 text-xs">
                      {showCompare.after.nodes
                        .map((id) => graph.nodes.get(id)?.city ?? id)
                        .join(" → ")}
                    </div>
                  </div>
                  <div className="md:col-span-2 text-[11px] font-mono text-muted-foreground border-t border-border pt-2">
                    Trigger: <span className="text-foreground">{showCompare.trigger}</span>
                    {" · "}
                    {new Date(showCompare.at).toLocaleString()}
                  </div>
                </>
              );
            })()}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 overflow-hidden">
          <div className="h-[520px] relative">
            <MapContainer
              center={[22.5, 79]}
              zoom={5}
              scrollWheelZoom
              style={{ height: "100%", width: "100%", background: "#0b0f17" }}
            >
              <LayersControl position="topright">
                <LayersControl.BaseLayer checked={satellite} name="Satellite">
                  <TileLayer
                    attribution='Tiles &copy; Esri'
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  />
                </LayersControl.BaseLayer>
                <LayersControl.BaseLayer checked={!satellite} name="Streets">
                  <TileLayer
                    attribution='&copy; OpenStreetMap'
                    url="https://{s}.tile.openstreetmap.org/{z}/{y}/{x}.png"
                  />
                </LayersControl.BaseLayer>
              </LayersControl>

              <FitBounds points={allMapPoints} />

              {nodes.map((n) => {
                const isSrc = n.id === source;
                const isDst = n.id === target;
                if (isSrc || isDst) return null;
                return (
                  <Marker key={n.id} position={n.position} icon={nodeIcon}>
                    <LeafletTooltip direction="top" offset={[0, -6]}>
                      {n.name}
                    </LeafletTooltip>
                  </Marker>
                );
              })}

              {paths
                .map((p, i) => ({ p, i }))
                .reverse()
                .map(({ p, i }) => {
                  const isActive = i === activePath;
                  const color = i === 0 ? PATH_COLORS[0] : PATH_COLORS[i % PATH_COLORS.length];
                  return (
                    <Polyline
                      key={`path-${i}-${scanTick}`}
                      positions={pathPolyline(p)}
                      pathOptions={{
                        color,
                        weight: i === 0 ? (isActive ? 7 : 6) : isActive ? 5 : 3,
                        opacity: i === 0 ? 1 : isActive ? 0.9 : 0.45,
                        dashArray: i === 0 ? undefined : "8 8",
                      }}
                      eventHandlers={{ click: () => setActivePath(i) }}
                    />
                  );
                })}

              {liveIncidents.map((inc) => (
                <CircleMarker
                  key={inc.id}
                  center={inc.position}
                  radius={8 + inc.severity}
                  pathOptions={{
                    color: "#ef4444",
                    fillColor: "#ef4444",
                    fillOpacity: 0.35 + (scanTick % 2) * 0.25,
                    weight: 2,
                  }}
                >
                  <LeafletTooltip direction="top" offset={[0, -4]}>
                    <div className="font-mono text-[10px]">
                      <div className="font-bold uppercase">{inc.type}</div>
                      <div>{inc.title}</div>
                      <div>radius: {inc.radiusKm} km</div>
                    </div>
                  </LeafletTooltip>
                </CircleMarker>
              ))}

              {sourceNode && (
                <Marker
                  position={sourceNode.position}
                  icon={pinIcon("ORIGIN", "#22c55e")}
                />
              )}
              {targetNode && (
                <Marker
                  position={targetNode.position}
                  icon={pinIcon("DEST", "#3b82f6")}
                />
              )}
            </MapContainer>

            <div className="absolute bottom-3 left-3 z-[400] bg-background/85 backdrop-blur border border-border rounded px-3 py-2 text-[10px] font-mono uppercase tracking-wider flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-green-500" /> Optimal
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" /> Incident
              </span>
              <span className="flex items-center gap-1">
                <Activity className="h-3 w-3" /> {liveIncidents.length} active
              </span>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono uppercase tracking-wider flex items-center gap-2">
              <Navigation className="h-4 w-4" /> {paths.length} Routes Found
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 max-h-[460px] overflow-auto">
            {paths.length === 0 && (
              <div className="p-6 text-sm text-muted-foreground text-center">
                {source === target
                  ? "Pick different origin and destination."
                  : "No path available — too many incidents block the network."}
              </div>
            )}
            {paths.map((p, i) => {
              const color = i === 0 ? PATH_COLORS[0] : PATH_COLORS[i % PATH_COLORS.length];
              const isActive = i === activePath;
              return (
                <button
                  key={i}
                  onClick={() => setActivePath(i)}
                  className={`w-full text-left p-3 border-b border-border hover:bg-secondary/40 transition-colors ${isActive ? "bg-secondary/60" : ""}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ background: color }}
                      />
                      <span className="font-mono text-xs font-bold uppercase">
                        Route {i + 1}
                      </span>
                      {i === 0 && (
                        <Badge className="text-[9px] py-0 h-4 bg-primary text-primary-foreground flex items-center gap-1">
                          <Zap className="h-2.5 w-2.5" /> Optimal
                        </Badge>
                      )}
                      {p.affectedByIncidents && (
                        <Badge variant="destructive" className="text-[9px] py-0 h-4 flex items-center gap-1">
                          <AlertTriangle className="h-2.5 w-2.5" /> Incident
                        </Badge>
                      )}
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {p.nodes.length} stops
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-mono text-muted-foreground">
                    <span>{p.totalDistance.toFixed(0)} km</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {(p.totalDistance / 60).toFixed(1)} h
                    </span>
                    {best && i > 0 && (
                      <span>
                        +{(p.totalDistance - best.totalDistance).toFixed(0)} km
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground truncate">
                    {p.nodes
                      .map((id) => graph.nodes.get(id)?.city ?? id)
                      .join(" → ")}
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
