import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  CircleMarker,
  Tooltip as LeafletTooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTranslation } from "react-i18next";
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
import { Input } from "@/components/ui/input";
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
  Activity,
  RefreshCw,
  BellRing,
  X,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Search,
  Loader2,
} from "lucide-react";
import {
  buildGraph,
  applyIncidents,
  yenKShortestPaths,
  distancePointToSegmentKm,
  haversineKm,
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

const ORIGIN_ID = "__origin";
const DEST_ID = "__dest";

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
  before: PathResult;
  after: PathResult;
  trigger: string;
  acknowledged: boolean;
}

interface ResolvedPoint {
  position: LatLng;
  label: string;
  shortLabel: string;
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

async function geocode(query: string): Promise<{ lat: string; lon: string; display_name: string } | null> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=0`,
      { headers: { "Accept-Language": "en" } },
    );
    if (!r.ok) return null;
    const data = await r.json();
    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  } catch {
    return null;
  }
}

function matchNodeByText(text: string, nodes: GraphNode[]): GraphNode | null {
  const q = text.trim().toLowerCase();
  if (!q) return null;
  return (
    nodes.find((n) => n.city?.toLowerCase() === q) ??
    nodes.find((n) => n.name.toLowerCase() === q) ??
    nodes.find(
      (n) =>
        n.city?.toLowerCase().startsWith(q) ||
        n.name.toLowerCase().startsWith(q),
    ) ??
    null
  );
}

async function resolvePoint(
  text: string,
  nodes: GraphNode[],
): Promise<ResolvedPoint | null> {
  const matched = matchNodeByText(text, nodes);
  if (matched) {
    return {
      position: matched.position,
      label: matched.name,
      shortLabel: matched.city ?? matched.name,
    };
  }
  const geo = await geocode(text);
  if (!geo) return null;
  const lat = parseFloat(geo.lat);
  const lon = parseFloat(geo.lon);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
  const short = geo.display_name.split(",")[0]?.trim() || text;
  return {
    position: [lat, lon],
    label: geo.display_name,
    shortLabel: short,
  };
}

export default function RouteFinder() {
  const { t } = useTranslation();
  const { data: warehouses } = useListWarehouses();
  const { data: disruptions, refetch: refetchDisruptions } = useListDisruptions({});

  const [originText, setOriginText] = useState<string>("Pune");
  const [destText, setDestText] = useState<string>("Mumbai");
  const [originPoint, setOriginPoint] = useState<ResolvedPoint | null>(null);
  const [destPoint, setDestPoint] = useState<ResolvedPoint | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string>("");
  const [k, setK] = useState<number>(6);
  const [activePath, setActivePath] = useState<number>(0);
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

  const warehouseNodes: GraphNode[] = useMemo(() => {
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

  /* ── Resolve initial defaults once warehouseNodes are ready ── */
  const initialResolved = useRef(false);
  useEffect(() => {
    if (initialResolved.current) return;
    if (warehouseNodes.length === 0) return;
    initialResolved.current = true;
    void runSearch(originText, destText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseNodes]);

  async function runSearch(oText: string, dText: string) {
    if (!oText.trim() || !dText.trim()) {
      setSearchError(t("routeFinder.enterBoth"));
      return;
    }
    setSearching(true);
    setSearchError("");
    const [og, dg] = await Promise.all([
      resolvePoint(oText, warehouseNodes),
      resolvePoint(dText, warehouseNodes),
    ]);
    if (!og) {
      setSearchError(t("routeFinder.cannotFind", { q: oText }));
      setSearching(false);
      return;
    }
    if (!dg) {
      setSearchError(t("routeFinder.cannotFind", { q: dText }));
      setSearching(false);
      return;
    }
    setOriginPoint(og);
    setDestPoint(dg);
    setActivePath(0);
    setSearching(false);
  }

  const allIncidents: Incident[] = useMemo(() => {
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

  /* ── Build a graph that includes the user's origin/dest as virtual nodes ── */
  const baseGraph = useMemo(() => {
    if (!originPoint || !destPoint) return null;

    const originNode: GraphNode = {
      id: ORIGIN_ID,
      name: originPoint.shortLabel,
      city: originPoint.shortLabel,
      position: originPoint.position,
    };
    const destNode: GraphNode = {
      id: DEST_ID,
      name: destPoint.shortLabel,
      city: destPoint.shortLabel,
      position: destPoint.position,
    };

    const directDist = haversineKm(originPoint.position, destPoint.position);
    const allNodes = [...warehouseNodes, originNode, destNode];

    /* If the route is short enough, allow direct routing without intermediate
       warehouses by giving each user node enough neighbors to reach the other.
       For long-haul we still let warehouses act as transshipment points. */
    const maxNeighbors = directDist < 300 ? 6 : 5;
    const g = buildGraph(allNodes, { maxNeighbors });

    /* Always guarantee a direct edge between origin and destination so that
       even when no good warehouse path exists, we still surface the user's
       exact route. */
    const ensureEdge = (from: string, to: string, distKm: number) => {
      const list = g.adjacency.get(from);
      if (!list) return;
      if (!list.find((e) => e.to === to)) {
        list.push({ from, to, distanceKm: distKm });
      }
    };
    ensureEdge(ORIGIN_ID, DEST_ID, directDist);
    ensureEdge(DEST_ID, ORIGIN_ID, directDist);

    return g;
  }, [warehouseNodes, originPoint, destPoint]);

  /* ── Step 1: clean baseline paths (no incident effects) ── */
  const cleanPaths: PathResult[] = useMemo(() => {
    if (!baseGraph) return [];
    return yenKShortestPaths(baseGraph, ORIGIN_ID, DEST_ID, k);
  }, [baseGraph, k]);

  /* ── Step 2: detect ONLY the incidents that intersect the user's routes ── */
  const onRouteIncidents: Incident[] = useMemo(() => {
    if (!baseGraph || cleanPaths.length === 0) return [];
    const segments: [LatLng, LatLng][] = [];
    for (const p of cleanPaths) {
      for (let i = 0; i < p.nodes.length - 1; i++) {
        const a = baseGraph.nodes.get(p.nodes[i]);
        const b = baseGraph.nodes.get(p.nodes[i + 1]);
        if (a && b) segments.push([a.position, b.position]);
      }
    }
    return allIncidents.filter((inc) =>
      segments.some(
        ([a, b]) => distancePointToSegmentKm(inc.position, a, b) <= inc.radiusKm,
      ),
    );
  }, [cleanPaths, baseGraph, allIncidents]);

  /* ── Step 3: re-cost the graph using only on-route incidents ── */
  const graph = useMemo(() => {
    if (!baseGraph) return null;
    return applyIncidents(baseGraph, onRouteIncidents);
  }, [baseGraph, onRouteIncidents]);

  const paths: PathResult[] = useMemo(() => {
    if (!graph) return [];
    return yenKShortestPaths(graph, ORIGIN_ID, DEST_ID, k);
  }, [graph, k]);

  const lastBestRef = useRef<{
    key: string;
    path: PathResult;
    incidentIds: string[];
  } | null>(null);

  useEffect(() => {
    if (!graph || paths.length === 0 || !originPoint || !destPoint) return;
    const best = paths[0];
    const key = `${originPoint.label}|${destPoint.label}`;
    const currentIncidentIds = onRouteIncidents.map((i) => i.id).sort();
    const prev = lastBestRef.current;

    if (!prev || prev.key !== key) {
      lastBestRef.current = { key, path: best, incidentIds: currentIncidentIds };
      return;
    }

    const samePath =
      prev.path.nodes.length === best.nodes.length &&
      prev.path.nodes.every((n, i) => n === best.nodes[i]);

    if (!samePath) {
      const newIds = currentIncidentIds.filter(
        (id) => !prev.incidentIds.includes(id),
      );
      const trigger =
        newIds.length > 0
          ? onRouteIncidents.find((i) => i.id === newIds[0])?.title ??
            t("routeFinder.newIncidentDetected")
          : t("routeFinder.networkChanged");

      const alert: RerouteAlert = {
        id: `rr-${Date.now()}`,
        at: Date.now(),
        before: prev.path,
        after: best,
        trigger,
        acknowledged: false,
      };
      setReroutes((cur) => [alert, ...cur].slice(0, 8));

      if (!muted && typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "granted") {
          new Notification(t("routeFinder.optimalRouteChanged"), {
            body: trigger,
          });
        }
      }
    }

    lastBestRef.current = { key, path: best, incidentIds: currentIncidentIds };
  }, [paths, graph, originPoint, destPoint, onRouteIncidents, muted, t]);

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

  /* ── Map points (for fit-bounds) ── */
  const allMapPoints: LatLng[] = useMemo(() => {
    const p: LatLng[] = [];
    if (originPoint) p.push(originPoint.position);
    if (destPoint) p.push(destPoint.position);
    if (paths.length > 0 && graph) {
      for (const node of paths[0].nodes) {
        const n = graph.nodes.get(node);
        if (n) p.push(n.position);
      }
    }
    return p;
  }, [originPoint, destPoint, paths, graph]);

  /* ── OSRM road geometry cache ── */
  const ROAD_CACHE_KEY = "supply-chain.roadGeom.v1";
  const roadGeomRef = useRef<Map<string, LatLng[]>>(
    (() => {
      const m = new Map<string, LatLng[]>();
      try {
        const raw = localStorage.getItem(ROAD_CACHE_KEY);
        if (raw) {
          const obj = JSON.parse(raw) as Record<string, LatLng[]>;
          for (const [k, v] of Object.entries(obj)) m.set(k, v);
        }
      } catch {
        // ignore
      }
      return m;
    })(),
  );
  const [roadGeomTick, setRoadGeomTick] = useState(0);
  const [roadProgress, setRoadProgress] = useState({ done: 0, total: 0 });

  useEffect(() => {
    if (!graph || paths.length === 0) return;
    let cancelled = false;

    const edgeKeys = new Set<string>();
    const userNodeIds = new Set([ORIGIN_ID, DEST_ID]);
    for (const p of paths) {
      for (let i = 0; i < p.nodes.length - 1; i++) {
        const a = p.nodes[i];
        const b = p.nodes[i + 1];
        /* The user origin/dest can move on every search — use a position-keyed
           cache key for those edges so we don't reuse a stale geometry. */
        const aKey = userNodeIds.has(a)
          ? `${a}@${graph.nodes.get(a)?.position.join(",")}`
          : a;
        const bKey = userNodeIds.has(b)
          ? `${b}@${graph.nodes.get(b)?.position.join(",")}`
          : b;
        edgeKeys.add(`${aKey}|${bKey}`);
      }
    }
    const cache = roadGeomRef.current;
    const missing = Array.from(edgeKeys).filter((k) => !cache.has(k));
    setRoadProgress({
      done: edgeKeys.size - missing.length,
      total: edgeKeys.size,
    });
    if (missing.length === 0) return;

    function nodeIdFromCacheKey(k: string): string {
      return k.includes("@") ? k.split("@")[0] : k;
    }

    async function fetchEdge(key: string): Promise<LatLng[] | null> {
      const [aKey, bKey] = key.split("|");
      if (!graph) return null;
      const na = graph.nodes.get(nodeIdFromCacheKey(aKey));
      const nb = graph.nodes.get(nodeIdFromCacheKey(bKey));
      if (!na || !nb) return null;
      const url = `https://router.project-osrm.org/route/v1/driving/${na.position[1]},${na.position[0]};${nb.position[1]},${nb.position[0]}?overview=full&geometries=geojson`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const r = await fetch(url, { signal: controller.signal });
        if (!r.ok) return null;
        const data = await r.json();
        const coords = data?.routes?.[0]?.geometry?.coordinates;
        if (!Array.isArray(coords) || coords.length === 0) return null;
        return coords.map(
          ([lon, lat]: [number, number]) => [lat, lon] as LatLng,
        );
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
      }
    }

    (async () => {
      const concurrency = 2;
      const queue = [...missing];
      let completed = edgeKeys.size - missing.length;

      async function worker() {
        while (queue.length > 0) {
          if (cancelled) return;
          const key = queue.shift()!;
          const geom = await fetchEdge(key);
          if (cancelled) return;
          if (geom) {
            roadGeomRef.current.set(key, geom);
          } else {
            const [aKey, bKey] = key.split("|");
            const na = graph!.nodes.get(nodeIdFromCacheKey(aKey));
            const nb = graph!.nodes.get(nodeIdFromCacheKey(bKey));
            if (na && nb) roadGeomRef.current.set(key, [na.position, nb.position]);
          }
          completed += 1;
          setRoadProgress({ done: completed, total: edgeKeys.size });
          setRoadGeomTick((t) => t + 1);
        }
      }

      await Promise.all(
        Array(Math.min(concurrency, queue.length))
          .fill(null)
          .map(() => worker()),
      );

      if (!cancelled) {
        try {
          /* Don't persist user-specific edges (they bloat the cache). */
          const obj: Record<string, LatLng[]> = {};
          for (const [k, v] of roadGeomRef.current.entries()) {
            if (!k.includes("@")) obj[k] = v;
          }
          localStorage.setItem(ROAD_CACHE_KEY, JSON.stringify(obj));
        } catch {
          // localStorage might be full; ignore
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [paths, graph]);

  function pathPolyline(p: PathResult): LatLng[] {
    void roadGeomTick;
    if (!graph) return [];
    const userNodeIds = new Set([ORIGIN_ID, DEST_ID]);
    const out: LatLng[] = [];
    for (let i = 0; i < p.nodes.length - 1; i++) {
      const a = p.nodes[i];
      const b = p.nodes[i + 1];
      const aKey = userNodeIds.has(a)
        ? `${a}@${graph.nodes.get(a)?.position.join(",")}`
        : a;
      const bKey = userNodeIds.has(b)
        ? `${b}@${graph.nodes.get(b)?.position.join(",")}`
        : b;
      const key = `${aKey}|${bKey}`;
      const geom = roadGeomRef.current.get(key);
      if (geom && geom.length > 0) {
        if (out.length === 0) out.push(geom[0]);
        for (let j = 1; j < geom.length; j++) out.push(geom[j]);
      } else {
        const na = graph.nodes.get(a);
        const nb = graph.nodes.get(b);
        if (na && nb) {
          if (out.length === 0) out.push(na.position);
          out.push(nb.position);
        }
      }
    }
    return out;
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

  function nodeLabel(id: string): string {
    if (id === ORIGIN_ID) return originPoint?.shortLabel ?? "Origin";
    if (id === DEST_ID)   return destPoint?.shortLabel ?? "Destination";
    return graph?.nodes.get(id)?.city ?? graph?.nodes.get(id)?.name ?? id;
  }

  const best = paths[0];
  const onRouteCount = onRouteIncidents.length;

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1 flex items-center gap-2">
            <RouteIcon className="h-6 w-6" /> {t("routeFinder.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("routeFinder.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {onRouteCount > 0 && (
            <Badge variant="destructive" className="font-mono text-[10px] uppercase flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {t("routeFinder.onRouteDetected", { n: onRouteCount })}
            </Badge>
          )}
          {roadProgress.total > 0 && roadProgress.done < roadProgress.total && (
            <Badge variant="outline" className="font-mono text-[10px] uppercase flex items-center gap-1">
              <RefreshCw className="h-3 w-3 animate-spin" />
              {t("routeFinder.roads", { done: roadProgress.done, total: roadProgress.total })}
            </Badge>
          )}
          <Badge variant="outline" className="font-mono text-[10px] uppercase flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            {t("routeFinder.liveScan", { tick: scanTick })}
          </Badge>
          <Button
            variant={muted ? "outline" : "ghost"}
            size="sm"
            onClick={() => setMuted((m) => !m)}
          >
            <BellRing className={`h-3 w-3 mr-1 ${muted ? "opacity-40" : ""}`} />
            {muted ? t("routeFinder.muted") : t("routeFinder.alerts")}
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
            <RefreshCw className="h-3 w-3 mr-1" /> {t("routeFinder.refreshFeed")}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-4 flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
              {t("routeFinder.origin")}
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-2.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-emerald-300 pointer-events-none" />
              <Input
                value={originText}
                onChange={(e) => setOriginText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void runSearch(originText, destText);
                }}
                placeholder={t("routeFinder.originPlaceholder")}
                className="pl-8 h-9 text-sm"
              />
            </div>
          </div>
          <div className="md:col-span-4 flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
              {t("routeFinder.destination")}
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-2.5 h-3 w-3 rounded-full bg-red-500 border-2 border-red-300 pointer-events-none" />
              <Input
                value={destText}
                onChange={(e) => setDestText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void runSearch(originText, destText);
                }}
                placeholder={t("routeFinder.destPlaceholder")}
                className="pl-8 h-9 text-sm"
              />
            </div>
          </div>
          <div className="md:col-span-2 flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
              {t("routeFinder.routesToCompare")}
            </label>
            <Select value={String(k)} onValueChange={(v) => setK(Number(v))}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[3, 4, 5, 6, 7, 8].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {t("routeFinder.topN", { n })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono opacity-0">
              .
            </label>
            <Button
              onClick={() => runSearch(originText, destText)}
              disabled={searching}
              className="h-9 gap-2"
            >
              {searching ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("routeFinder.searching")}
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  {t("routeFinder.findRoutes")}
                </>
              )}
            </Button>
          </div>

          {(searchError || originPoint || destPoint) && (
            <div className="md:col-span-12 flex flex-wrap items-center gap-2 text-xs">
              {searchError && (
                <span className="text-destructive font-mono">{searchError}</span>
              )}
              {!searchError && originPoint && destPoint && (
                <>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {t("routeFinder.routedVia")} {originPoint.shortLabel} → {destPoint.shortLabel}
                  </Badge>
                  <span className="text-muted-foreground text-[10px] truncate">
                    {originPoint.label} → {destPoint.label}
                  </span>
                </>
              )}
            </div>
          )}

          <div className="md:col-span-12 flex gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={injectSimulatedIncident} className="gap-1">
              <AlertTriangle className="h-3 w-3" /> {t("routeFinder.simIncident")}
            </Button>
            <Button variant="ghost" size="sm" onClick={clearSimulated}>
              {t("routeFinder.clear")}
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
                    {t("routeFinder.optimalRouteChanged")}
                  </div>
                  <div className="text-sm truncate">
                    {a.trigger} —{" "}
                    <span className="text-muted-foreground">
                      {t("routeFinder.nowVia")}{" "}
                      {a.after.nodes.map(nodeLabel).join(" → ")}
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
                  {t("routeFinder.compare")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => acknowledgeAlert(a.id)}
                >
                  {t("routeFinder.ack")}
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
              {t("routeFinder.moreReroutes", { n: unacknowledged.length - 2 })}
            </div>
          )}
        </div>
      )}

      {showCompare && (
        <Card className="border-primary/40">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-mono uppercase tracking-wider flex items-center gap-2">
              <ArrowRight className="h-4 w-4" /> {t("routeFinder.beforeAfter")}
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
                        {t("routeFinder.beforeOriginal")}
                      </span>
                    </div>
                    <div className="text-lg font-bold">
                      {showCompare.before.totalDistance.toFixed(0)} km
                    </div>
                    <div className="text-[11px] font-mono text-muted-foreground">
                      {showCompare.before.nodes.length} {t("routeFinder.stops")} ·{" "}
                      {(showCompare.before.totalDistance / 60).toFixed(1)} h
                    </div>
                    <div className="mt-2 text-xs">
                      {showCompare.before.nodes.map(nodeLabel).join(" → ")}
                    </div>
                  </div>
                  <div className="border border-primary/40 rounded-md p-3 bg-primary/5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="font-mono text-[10px] uppercase tracking-wider text-green-500">
                        {t("routeFinder.afterNew")}
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
                      {showCompare.after.nodes.length} {t("routeFinder.stops")}{" "}
                      {stopsDelta !== 0 &&
                        `(${stopsDelta > 0 ? "+" : ""}${stopsDelta})`}{" "}
                      · {(showCompare.after.totalDistance / 60).toFixed(1)} h
                    </div>
                    <div className="mt-2 text-xs">
                      {showCompare.after.nodes.map(nodeLabel).join(" → ")}
                    </div>
                  </div>
                  <div className="md:col-span-2 text-[11px] font-mono text-muted-foreground border-t border-border pt-2">
                    {t("routeFinder.trigger")} <span className="text-foreground">{showCompare.trigger}</span>
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
              worldCopyJump
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                maxZoom={18}
              />

              <FitBounds points={allMapPoints} />

              {/* Show warehouse nodes that are NOT on the active route as small grey markers */}
              {warehouseNodes.map((n) => (
                <Marker key={n.id} position={n.position} icon={nodeIcon}>
                  <LeafletTooltip direction="top" offset={[0, -6]}>
                    {n.name}
                  </LeafletTooltip>
                </Marker>
              ))}

              {paths
                .map((p, i) => ({ p, i }))
                .reverse()
                .map(({ p, i }) => {
                  const isActive = i === activePath;
                  const color = i === 0 ? PATH_COLORS[0] : PATH_COLORS[i % PATH_COLORS.length];
                  return (
                    <Polyline
                      key={`path-${i}-${scanTick}-${roadGeomTick}`}
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

              {/* On-route incidents in red, off-route in muted gray */}
              {allIncidents.map((inc) => {
                const isOnRoute = onRouteIncidents.some((i) => i.id === inc.id);
                return (
                  <CircleMarker
                    key={inc.id}
                    center={inc.position}
                    radius={isOnRoute ? 8 + inc.severity : 6}
                    pathOptions={{
                      color: isOnRoute ? "#ef4444" : "#64748b",
                      fillColor: isOnRoute ? "#ef4444" : "#64748b",
                      fillOpacity: isOnRoute
                        ? 0.35 + (scanTick % 2) * 0.25
                        : 0.18,
                      weight: isOnRoute ? 2 : 1,
                      dashArray: isOnRoute ? undefined : "3 3",
                    }}
                  >
                    <LeafletTooltip direction="top" offset={[0, -4]}>
                      <div className="font-mono text-[10px]">
                        <div className="font-bold uppercase">{inc.type}</div>
                        <div>{inc.title}</div>
                        <div>radius: {inc.radiusKm} km</div>
                        {isOnRoute && (
                          <div className="text-red-500 font-bold mt-0.5">
                            {t("routeFinder.incidentOnRoute")}
                          </div>
                        )}
                      </div>
                    </LeafletTooltip>
                  </CircleMarker>
                );
              })}

              {originPoint && (
                <Marker
                  position={originPoint.position}
                  icon={pinIcon("ORIGIN", "#22c55e")}
                />
              )}
              {destPoint && (
                <Marker
                  position={destPoint.position}
                  icon={pinIcon("DEST", "#3b82f6")}
                />
              )}
            </MapContainer>

            <div className="absolute bottom-3 left-3 z-[400] bg-background/85 backdrop-blur border border-border rounded px-3 py-2 text-[10px] font-mono uppercase tracking-wider flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-green-500" /> {t("routeFinder.legend.optimal")}
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" /> {t("routeFinder.legend.incident")}
              </span>
              <span className="flex items-center gap-1">
                <Activity className="h-3 w-3" /> {t("routeFinder.legend.active", { n: onRouteIncidents.length })}
              </span>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono uppercase tracking-wider flex items-center gap-2">
              <Navigation className="h-4 w-4" /> {t("routeFinder.routesFound", { n: paths.length })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 max-h-[460px] overflow-auto">
            {paths.length === 0 && (
              <div className="p-6 text-sm text-muted-foreground text-center">
                {!originPoint || !destPoint
                  ? t("routeFinder.enterBoth")
                  : t("routeFinder.noPath")}
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
                        {t("routeFinder.routeN", { n: i + 1 })}
                      </span>
                      {i === 0 && (
                        <Badge className="text-[9px] py-0 h-4 bg-primary text-primary-foreground flex items-center gap-1">
                          <Zap className="h-2.5 w-2.5" /> {t("routeFinder.optimal")}
                        </Badge>
                      )}
                      {p.affectedByIncidents && (
                        <Badge variant="destructive" className="text-[9px] py-0 h-4 flex items-center gap-1">
                          <AlertTriangle className="h-2.5 w-2.5" /> {t("routeFinder.incident")}
                        </Badge>
                      )}
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {p.nodes.length} {t("routeFinder.stops")}
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
                    {p.nodes.map(nodeLabel).join(" → ")}
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
