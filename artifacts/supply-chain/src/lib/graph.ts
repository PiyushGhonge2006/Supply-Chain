export type LatLng = [number, number];

export interface GraphNode {
  id: string;
  name: string;
  city?: string;
  country?: string;
  position: LatLng;
}

export interface GraphEdge {
  from: string;
  to: string;
  distanceKm: number;
  blocked?: boolean;
  penalty?: number;
}

export interface Graph {
  nodes: Map<string, GraphNode>;
  adjacency: Map<string, GraphEdge[]>;
}

export interface PathResult {
  nodes: string[];
  totalDistance: number;
  blockedSegments: number;
  affectedByIncidents: boolean;
}

const EARTH_R = 6371;

export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const [lat1, lon1] = a;
  const [lat2, lon2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(h));
}

export function distancePointToSegmentKm(
  p: LatLng,
  a: LatLng,
  b: LatLng,
): number {
  const ax = a[1], ay = a[0];
  const bx = b[1], by = b[0];
  const px = p[1], py = p[0];
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projLat = ay + t * dy;
  const projLon = ax + t * dx;
  return haversineKm(p, [projLat, projLon]);
}

export function buildGraph(
  nodes: GraphNode[],
  options: { maxNeighbors?: number; maxDistanceKm?: number } = {},
): Graph {
  const { maxNeighbors = 5, maxDistanceKm = Infinity } = options;
  const nodeMap = new Map<string, GraphNode>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  const adjacency = new Map<string, GraphEdge[]>();
  for (const n of nodes) {
    const ranked = nodes
      .filter((m) => m.id !== n.id)
      .map((m) => ({ id: m.id, d: haversineKm(n.position, m.position) }))
      .filter((e) => e.d <= maxDistanceKm)
      .sort((a, b) => a.d - b.d)
      .slice(0, maxNeighbors);
    adjacency.set(
      n.id,
      ranked.map((r) => ({ from: n.id, to: r.id, distanceKm: r.d })),
    );
  }

  for (const n of nodes) {
    for (const edge of adjacency.get(n.id) ?? []) {
      const reverse = (adjacency.get(edge.to) ?? []).find(
        (e) => e.to === n.id,
      );
      if (!reverse) {
        adjacency.get(edge.to)?.push({
          from: edge.to,
          to: n.id,
          distanceKm: edge.distanceKm,
        });
      }
    }
  }

  return { nodes: nodeMap, adjacency };
}

export function applyIncidents(
  graph: Graph,
  incidents: { position: LatLng; radiusKm: number; severity: number }[],
): Graph {
  const adjacency = new Map<string, GraphEdge[]>();
  for (const [id, edges] of graph.adjacency) {
    adjacency.set(
      id,
      edges.map((e) => {
        const a = graph.nodes.get(e.from)!.position;
        const b = graph.nodes.get(e.to)!.position;
        let blocked = false;
        let penalty = 1;
        for (const inc of incidents) {
          const d = distancePointToSegmentKm(inc.position, a, b);
          if (d <= inc.radiusKm) {
            if (inc.severity >= 4) blocked = true;
            else penalty *= 1 + 0.5 * inc.severity;
          }
        }
        return { ...e, blocked, penalty };
      }),
    );
  }
  return { nodes: graph.nodes, adjacency };
}

interface HeapItem {
  id: string;
  dist: number;
}

class MinHeap {
  private data: HeapItem[] = [];
  push(item: HeapItem) {
    this.data.push(item);
    this.bubbleUp(this.data.length - 1);
  }
  pop(): HeapItem | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const end = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = end;
      this.sinkDown(0);
    }
    return top;
  }
  get size() {
    return this.data.length;
  }
  private bubbleUp(i: number) {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.data[i].dist < this.data[parent].dist) {
        [this.data[i], this.data[parent]] = [this.data[parent], this.data[i]];
        i = parent;
      } else break;
    }
  }
  private sinkDown(i: number) {
    const n = this.data.length;
    while (true) {
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      let smallest = i;
      if (l < n && this.data[l].dist < this.data[smallest].dist) smallest = l;
      if (r < n && this.data[r].dist < this.data[smallest].dist) smallest = r;
      if (smallest === i) break;
      [this.data[i], this.data[smallest]] = [this.data[smallest], this.data[i]];
      i = smallest;
    }
  }
}

export function dijkstra(
  graph: Graph,
  source: string,
  target: string,
  blockedEdges: Set<string> = new Set(),
  blockedNodes: Set<string> = new Set(),
): PathResult | null {
  if (!graph.nodes.has(source) || !graph.nodes.has(target)) return null;
  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const heap = new MinHeap();
  dist.set(source, 0);
  prev.set(source, null);
  heap.push({ id: source, dist: 0 });

  while (heap.size > 0) {
    const cur = heap.pop()!;
    if (cur.id === target) break;
    if (cur.dist > (dist.get(cur.id) ?? Infinity)) continue;
    const neighbors = graph.adjacency.get(cur.id) ?? [];
    for (const e of neighbors) {
      if (e.blocked) continue;
      if (blockedEdges.has(`${e.from}|${e.to}`)) continue;
      if (blockedNodes.has(e.to) && e.to !== target) continue;
      const w = e.distanceKm * (e.penalty ?? 1);
      const nd = cur.dist + w;
      if (nd < (dist.get(e.to) ?? Infinity)) {
        dist.set(e.to, nd);
        prev.set(e.to, cur.id);
        heap.push({ id: e.to, dist: nd });
      }
    }
  }

  if (!dist.has(target)) return null;
  const path: string[] = [];
  let cur: string | null = target;
  while (cur !== null) {
    path.unshift(cur);
    cur = prev.get(cur) ?? null;
  }
  if (path[0] !== source) return null;
  return summarize(graph, path);
}

function summarize(graph: Graph, path: string[]): PathResult {
  let total = 0;
  let blocked = 0;
  let affected = false;
  for (let i = 0; i < path.length - 1; i++) {
    const edge = (graph.adjacency.get(path[i]) ?? []).find(
      (e) => e.to === path[i + 1],
    );
    if (edge) {
      total += edge.distanceKm;
      if (edge.blocked) blocked++;
      if ((edge.penalty ?? 1) > 1.0001 || edge.blocked) affected = true;
    }
  }
  return { nodes: path, totalDistance: total, blockedSegments: blocked, affectedByIncidents: affected };
}

function pathKey(p: string[]) {
  return p.join("→");
}

export function yenKShortestPaths(
  graph: Graph,
  source: string,
  target: string,
  K: number,
): PathResult[] {
  const A: PathResult[] = [];
  const first = dijkstra(graph, source, target);
  if (!first) return A;
  A.push(first);

  const seen = new Set<string>([pathKey(first.nodes)]);
  const candidates: PathResult[] = [];

  for (let k = 1; k < K; k++) {
    const prevPath = A[k - 1].nodes;
    for (let i = 0; i < prevPath.length - 1; i++) {
      const spurNode = prevPath[i];
      const rootPath = prevPath.slice(0, i + 1);
      const blockedEdges = new Set<string>();

      for (const p of A) {
        if (
          p.nodes.length > i &&
          rootPath.every((n, idx) => n === p.nodes[idx])
        ) {
          blockedEdges.add(`${p.nodes[i]}|${p.nodes[i + 1]}`);
        }
      }
      const blockedNodes = new Set<string>(rootPath.slice(0, -1));

      const spur = dijkstra(graph, spurNode, target, blockedEdges, blockedNodes);
      if (!spur) continue;

      const totalNodes = [...rootPath.slice(0, -1), ...spur.nodes];
      const key = pathKey(totalNodes);
      if (seen.has(key)) continue;

      const summarized = summarize(graph, totalNodes);
      candidates.push(summarized);
      seen.add(key);
    }

    if (candidates.length === 0) break;
    candidates.sort((a, b) => a.totalDistance - b.totalDistance);
    A.push(candidates.shift()!);
  }

  return A;
}
