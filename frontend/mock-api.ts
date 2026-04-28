import type { Plugin } from "vite";

/* ── Mock data generators ─────────────────────────────────── */

const now = new Date();
const iso = (d: Date) => d.toISOString();

const CITIES = [
  { name: "Shanghai", country: "China", lat: 31.2304, lon: 121.4737 },
  { name: "Los Angeles", country: "USA", lat: 34.0522, lon: -118.2437 },
  { name: "Rotterdam", country: "Netherlands", lat: 51.9244, lon: 4.4777 },
  { name: "Singapore", country: "Singapore", lat: 1.3521, lon: 103.8198 },
  { name: "Dubai", country: "UAE", lat: 25.2048, lon: 55.2708 },
  { name: "Hamburg", country: "Germany", lat: 53.5511, lon: 9.9937 },
  { name: "Mumbai", country: "India", lat: 19.0760, lon: 72.8777 },
  { name: "São Paulo", country: "Brazil", lat: -23.5505, lon: -46.6333 },
  { name: "Sydney", country: "Australia", lat: -33.8688, lon: 151.2093 },
  { name: "Tokyo", country: "Japan", lat: 35.6762, lon: 139.6503 },
  { name: "New York", country: "USA", lat: 40.7128, lon: -74.0060 },
  { name: "Antwerp", country: "Belgium", lat: 51.2194, lon: 4.4025 },
  { name: "Busan", country: "South Korea", lat: 35.1796, lon: 129.0756 },
  { name: "Marseille", country: "France", lat: 43.2965, lon: 5.3698 },
  { name: "Cape Town", country: "South Africa", lat: -33.9249, lon: 18.4241 },
];

const CARRIERS = ["Maersk", "COSCO", "MSC", "DHL", "FedEx", "UPS", "CMA CGM", "Evergreen"];
const MODES = ["sea", "air", "rail", "road", "multimodal"] as const;
const STATUSES = ["pending", "in_transit", "delayed", "delivered", "at_risk"] as const;
const DISRUPTION_TYPES = ["weather", "traffic", "port_congestion", "labor_strike", "mechanical", "geopolitical", "customs", "other"] as const;
const SEVERITIES = ["low", "medium", "high", "critical"] as const;

let nextShipmentId = 100;
let nextDisruptionId = 50;
let nextRouteId = 20;

const shipments = Array.from({ length: 24 }, (_, i) => {
  const origin = CITIES[i % CITIES.length];
  const dest = CITIES[(i + 3) % CITIES.length];
  const status = STATUSES[i % STATUSES.length];
  const mode = MODES[i % MODES.length];
  const est = new Date(now);
  est.setDate(est.getDate() + (i % 14) - 2);
  const risk = [12, 45, 78, 32, 88, 15, 62, 91, 25, 55, 38, 72, 18, 66, 82, 29, 50, 95, 41, 33, 77, 60, 22, 48][i];
  const delayProb = risk / 120;
  const lat = origin.lat + (dest.lat - origin.lat) * ((i % 7) / 10);
  const lon = origin.lon + (dest.lon - origin.lon) * ((i % 7) / 10);
  return {
    id: i + 1,
    trackingId: `TRK-${20240000 + i * 137}`,
    origin: `${origin.name}, ${origin.country}`,
    destination: `${dest.name}, ${dest.country}`,
    currentLocation: i % 3 === 0 ? origin.name : i % 3 === 1 ? "En route" : dest.name,
    status,
    transportMode: mode,
    weight: 1200 + i * 350,
    estimatedDelivery: iso(est),
    actualDelivery: status === "delivered" ? iso(new Date(est.getTime() - 3600000)) : null,
    riskScore: risk,
    delayProbability: delayProb,
    estimatedDelayhours: delayProb > 0.5 ? Math.round(delayProb * 48) : 0,
    carrier: CARRIERS[i % CARRIERS.length],
    cost: 2500 + i * 800,
    latitude: lat,
    longitude: lon,
    notes: i % 4 === 0 ? "Priority cargo. Requires temperature monitoring." : null,
    createdAt: iso(new Date(now.getTime() - 86400000 * (i % 30))),
    updatedAt: iso(now),
  };
});

const disruptions = Array.from({ length: 12 }, (_, i) => {
  const resolved = i > 8;
  return {
    id: i + 1,
    type: DISRUPTION_TYPES[i % DISRUPTION_TYPES.length],
    severity: SEVERITIES[i % SEVERITIES.length],
    title: [
      "Typhoon Muifa approaching East China Sea",
      "Suez Canal temporary closure",
      "Port workers strike in Hamburg",
      "Severe fog at Mumbai port",
      "Rail derailment on Trans-Siberian route",
      "Customs backlog at Los Angeles port",
      "Mechanical failure on vessel MSC Diana",
      "Flash floods in São Paulo region",
      "Airspace closure over Dubai",
      "Cyber attack on logistics provider",
      "Container shortage at Rotterdam",
      "Fuel price surge affecting road freight",
    ][i],
    description: `Ongoing ${DISRUPTION_TYPES[i % DISRUPTION_TYPES.length].replace("_", " ")} situation impacting regional supply chain operations. Alternative routes being evaluated.`,
    affectedRegion: CITIES[i % CITIES.length].name,
    affectedRoutes: [`Route ${String.fromCharCode(65 + i)}`, `Route ${String.fromCharCode(66 + i)}`],
    estimatedImpactHours: 12 + i * 6,
    resolved,
    resolvedAt: resolved ? iso(new Date(now.getTime() - 3600000 * (i + 1))) : null,
    latitude: CITIES[i % CITIES.length].lat,
    longitude: CITIES[i % CITIES.length].lon,
    createdAt: iso(new Date(now.getTime() - 86400000 * (i % 10))),
    updatedAt: iso(now),
  };
});

const routes = Array.from({ length: 8 }, (_, i) => {
  const origin = CITIES[i % CITIES.length];
  const dest = CITIES[(i + 5) % CITIES.length];
  const mode = MODES[i % MODES.length];
  return {
    id: i + 1,
    name: `${origin.name} → ${dest.name}`,
    origin: `${origin.name}, ${origin.country}`,
    destination: `${dest.name}, ${dest.country}`,
    transportMode: mode,
    distanceKm: Math.round(2000 + i * 1500),
    estimatedHours: Math.round(48 + i * 24),
    costPerKg: 1.5 + i * 0.3,
    carbonFootprint: Math.round(800 + i * 200),
    reliability: [92, 78, 85, 65, 88, 72, 95, 60][i],
    isOptimal: i % 3 === 0,
    waypoints: [origin.name, CITIES[(i + 2) % CITIES.length].name, dest.name],
    createdAt: iso(new Date(now.getTime() - 86400000 * 15)),
  };
});

const warehouses = [
  { id: 1, name: "Rotterdam Distribution Hub", type: "port", city: "Rotterdam", country: "Netherlands", lat: 51.9244, lon: 4.4777, congestion: "medium", capacity: 50000, occupancy: 32000, status: "operational" },
  { id: 2, name: "Shanghai Port Terminal", type: "port", city: "Shanghai", country: "China", lat: 31.2304, lon: 121.4737, congestion: "high", capacity: 120000, occupancy: 108000, status: "operational" },
  { id: 3, name: "LA Intermodal Yard", type: "rail_terminal", city: "Los Angeles", country: "USA", lat: 34.0522, lon: -118.2437, congestion: "critical", capacity: 45000, occupancy: 44100, status: "limited" },
  { id: 4, name: "Dubai Logistics Park", type: "warehouse", city: "Dubai", country: "UAE", lat: 25.2048, lon: 55.2708, congestion: "low", capacity: 35000, occupancy: 14000, status: "operational" },
  { id: 5, name: "Singapore Free Trade Zone", type: "port", city: "Singapore", country: "Singapore", lat: 1.3521, lon: 103.8198, congestion: "medium", capacity: 80000, occupancy: 52000, status: "operational" },
  { id: 6, name: "Hamburg Container Depot", type: "distribution_center", city: "Hamburg", country: "Germany", lat: 53.5511, lon: 9.9937, congestion: "high", capacity: 40000, occupancy: 36000, status: "limited" },
  { id: 7, name: "Sydney Air Cargo Hub", type: "airport", city: "Sydney", country: "Australia", lat: -33.8688, lon: 151.2093, congestion: "low", capacity: 20000, occupancy: 8000, status: "operational" },
  { id: 8, name: "Mumbai ICD", type: "rail_terminal", city: "Mumbai", country: "India", lat: 19.0760, lon: 72.8777, congestion: "medium", capacity: 30000, occupancy: 21000, status: "operational" },
  { id: 9, name: "Tokyo Bay Warehouse", type: "warehouse", city: "Tokyo", country: "Japan", lat: 35.6762, lon: 139.6503, congestion: "low", capacity: 25000, occupancy: 15000, status: "operational" },
  { id: 10, name: "New York Port Authority", type: "port", city: "New York", country: "USA", lat: 40.7128, lon: -74.0060, congestion: "high", capacity: 70000, occupancy: 63000, status: "operational" },
];

const riskScores = shipments
  .filter((s) => s.status !== "delivered")
  .slice(0, 10)
  .map((s) => ({
    shipmentId: s.id,
    trackingId: s.trackingId,
    riskScore: s.riskScore,
    riskLevel: s.riskScore >= 80 ? "critical" : s.riskScore >= 50 ? "high" : s.riskScore >= 25 ? "medium" : "low",
    riskFactors: [
      s.riskScore > 60 ? "port_congestion" : "weather",
      s.delayProbability > 0.5 ? "high_delay_probability" : "route_instability",
      s.riskScore > 75 ? "carrier_reliability" : "seasonal_demand",
    ],
    delayProbability: s.delayProbability,
    estimatedDelayhours: s.estimatedDelayhours,
  }));

const delayForecast = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(now);
  d.setDate(d.getDate() + i + 1);
  return {
    date: iso(d),
    forecastedDelays: 3 + Math.round(Math.sin(i) * 5 + i),
    predictedAvgDelayHours: 4 + Math.round(Math.cos(i) * 6 + i * 0.8),
    confidence: 0.6 + i * 0.05,
    mainCause: ["weather", "port_congestion", "traffic", "labor_strike", "mechanical", "customs", "geopolitical"][i % 7],
  };
});

const disruptionTrends = Array.from({ length: 14 }, (_, i) => {
  const d = new Date(now);
  d.setDate(d.getDate() - 13 + i);
  return {
    date: iso(d),
    weather: Math.round(2 + Math.sin(i) * 3),
    traffic: Math.round(1 + Math.cos(i * 0.7) * 2),
    port_congestion: Math.round(3 + Math.sin(i * 0.5) * 4),
    labor_strike: i % 7 === 0 ? 1 : 0,
    mechanical: Math.round(1 + Math.cos(i * 0.3) * 2),
    other: Math.round(0 + Math.sin(i * 0.9) * 1),
  };
});

const costBreakdown = [
  { mode: "sea", avgCostPerKg: 1.2, avgTransitHours: 288, reliability: 78, carbonFootprint: 45, shipmentCount: 142 },
  { mode: "air", avgCostPerKg: 8.5, avgTransitHours: 18, reliability: 95, carbonFootprint: 520, shipmentCount: 68 },
  { mode: "rail", avgCostPerKg: 2.1, avgTransitHours: 96, reliability: 88, carbonFootprint: 28, shipmentCount: 55 },
  { mode: "road", avgCostPerKg: 3.4, avgTransitHours: 48, reliability: 82, carbonFootprint: 110, shipmentCount: 89 },
  { mode: "multimodal", avgCostPerKg: 2.8, avgTransitHours: 120, reliability: 75, carbonFootprint: 68, shipmentCount: 34 },
];

/* ── Plugin ───────────────────────────────────────────────── */
export default function mockApiPlugin(): Plugin {
  return {
    name: "mock-api",
    configureServer(server) {
      server.middlewares.use("/api", (req, res, next) => {
        const url = req.url || "";
        const method = req.method || "GET";

        const sendJson = (data: unknown, status = 200) => {
          res.statusCode = status;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(data));
        };

        // Health
        if (url === "/healthz" && method === "GET") {
          return sendJson({ status: "ok" });
        }

        // Shipments list
        if (url.startsWith("/shipments") && method === "GET") {
          const query = new URLSearchParams(url.split("?")[1] || "");
          let result = [...shipments];
          if (query.get("status")) {
            result = result.filter((s) => s.status === query.get("status"));
          }
          return sendJson(result);
        }

        // Create shipment
        if (url === "/shipments" && method === "POST") {
          let body = "";
          req.on("data", (c) => (body += c));
          req.on("end", () => {
            const data = JSON.parse(body);
            const newShipment = {
              id: nextShipmentId++,
              ...data,
              riskScore: 30,
              delayProbability: 0.2,
              estimatedDelayhours: 0,
              createdAt: iso(now),
              updatedAt: iso(now),
            };
            shipments.push(newShipment);
            sendJson(newShipment, 201);
          });
          return;
        }

        // Get shipment
        const shipmentMatch = url.match(/^\/shipments\/(\d+)$/);
        if (shipmentMatch && method === "GET") {
          const id = parseInt(shipmentMatch[1]);
          const s = shipments.find((x) => x.id === id);
          return s ? sendJson(s) : sendJson({ error: "Not found" }, 404);
        }

        // Update shipment
        if (shipmentMatch && method === "PATCH") {
          let body = "";
          req.on("data", (c) => (body += c));
          req.on("end", () => {
            const id = parseInt(shipmentMatch[1]);
            const idx = shipments.findIndex((x) => x.id === id);
            if (idx === -1) return sendJson({ error: "Not found" }, 404);
            shipments[idx] = { ...shipments[idx], ...JSON.parse(body), updatedAt: iso(now) };
            sendJson(shipments[idx]);
          });
          return;
        }

        // Delete shipment
        if (shipmentMatch && method === "DELETE") {
          const id = parseInt(shipmentMatch[1]);
          const idx = shipments.findIndex((x) => x.id === id);
          if (idx !== -1) shipments.splice(idx, 1);
          return sendJson(undefined, 204);
        }

        // Disruptions list
        if (url === "/disruptions" && method === "GET") {
          const query = new URLSearchParams(url.split("?")[1] || "");
          let result = [...disruptions];
          if (query.get("severity")) {
            result = result.filter((d) => d.severity === query.get("severity"));
          }
          if (query.has("resolved")) {
            const resolved = query.get("resolved") === "true";
            result = result.filter((d) => d.resolved === resolved);
          }
          return sendJson(result);
        }

        // Create disruption
        if (url === "/disruptions" && method === "POST") {
          let body = "";
          req.on("data", (c) => (body += c));
          req.on("end", () => {
            const data = JSON.parse(body);
            const newDisruption = {
              id: nextDisruptionId++,
              ...data,
              resolved: false,
              resolvedAt: null,
              createdAt: iso(now),
              updatedAt: iso(now),
            };
            disruptions.push(newDisruption);
            sendJson(newDisruption, 201);
          });
          return;
        }

        // Update disruption
        const disruptionMatch = url.match(/^\/disruptions\/(\d+)$/);
        if (disruptionMatch && method === "PATCH") {
          let body = "";
          req.on("data", (c) => (body += c));
          req.on("end", () => {
            const id = parseInt(disruptionMatch[1]);
            const idx = disruptions.findIndex((x) => x.id === id);
            if (idx === -1) return sendJson({ error: "Not found" }, 404);
            const data = JSON.parse(body);
            disruptions[idx] = {
              ...disruptions[idx],
              ...data,
              resolvedAt: data.resolved ? iso(now) : disruptions[idx].resolvedAt,
              updatedAt: iso(now),
            };
            sendJson(disruptions[idx]);
          });
          return;
        }

        // Routes
        if (url === "/routes" && method === "GET") {
          return sendJson(routes);
        }

        // Create route
        if (url === "/routes" && method === "POST") {
          let body = "";
          req.on("data", (c) => (body += c));
          req.on("end", () => {
            const data = JSON.parse(body);
            const newRoute = {
              id: nextRouteId++,
              ...data,
              isOptimal: false,
              createdAt: iso(now),
            };
            routes.push(newRoute);
            sendJson(newRoute, 201);
          });
          return;
        }

        // Optimize route
        const optimizeMatch = url.match(/^\/routes\/(\d+)\/optimize$/);
        if (optimizeMatch && method === "POST") {
          const id = parseInt(optimizeMatch[1]);
          const route = routes.find((r) => r.id === id);
          if (!route) return sendJson({ error: "Not found" }, 404);
          return sendJson({
            originalRoute: route,
            alternatives: [
              {
                route: { ...route, id: nextRouteId++, name: `${route.name} (Alt A)`, costPerKg: route.costPerKg * 0.92, distanceKm: route.distanceKm * 1.08, estimatedHours: route.estimatedHours * 1.12 },
                reason: "Avoids high-congestion corridor",
                tradeoffs: "Slightly longer distance, lower cost",
                score: 87,
              },
              {
                route: { ...route, id: nextRouteId++, name: `${route.name} (Alt B)`, costPerKg: route.costPerKg * 1.05, distanceKm: route.distanceKm * 0.95, estimatedHours: route.estimatedHours * 0.88 },
                reason: "Faster transit via alternative port",
                tradeoffs: "Higher cost, shorter time",
                score: 82,
              },
            ],
            recommendation: "Alternative A offers the best balance of cost and reliability for current conditions.",
            costSaving: route.costPerKg * route.distanceKm * 0.08,
            timeSaving: route.estimatedHours * 0.12,
          });
        }

        // Warehouses
        if (url === "/warehouses" && method === "GET") {
          return sendJson(warehouses.map((w) => ({
            id: w.id,
            name: w.name,
            type: w.type,
            city: w.city,
            country: w.country,
            latitude: w.lat,
            longitude: w.lon,
            congestionLevel: w.congestion,
            capacity: w.capacity,
            currentOccupancy: w.occupancy,
            operationalStatus: w.status,
            createdAt: iso(new Date(now.getTime() - 86400000 * 30)),
          })));
        }

        // Dashboard summary
        if (url === "/analytics/dashboard" && method === "GET") {
          return sendJson({
            totalShipments: shipments.length,
            activeShipments: shipments.filter((s) => s.status === "in_transit").length,
            delayedShipments: shipments.filter((s) => s.status === "delayed").length,
            atRiskShipments: shipments.filter((s) => s.status === "at_risk").length,
            deliveredToday: shipments.filter((s) => s.status === "delivered" && s.actualDelivery && new Date(s.actualDelivery).toDateString() === now.toDateString()).length,
            activeDisruptions: disruptions.filter((d) => !d.resolved).length,
            criticalDisruptions: disruptions.filter((d) => d.severity === "critical" && !d.resolved).length,
            avgRiskScore: Math.round(shipments.reduce((a, s) => a + s.riskScore, 0) / shipments.length),
            onTimeRate: 78.5,
            totalCost: shipments.reduce((a, s) => a + s.cost, 0),
            potentialSavings: 124500,
          });
        }

        // Risk scores
        if (url === "/analytics/risk-scores" && method === "GET") {
          return sendJson(riskScores);
        }

        // Delay forecast
        if (url === "/analytics/delay-forecast" && method === "GET") {
          return sendJson(delayForecast);
        }

        // Disruption trends
        if (url === "/analytics/disruption-trends" && method === "GET") {
          return sendJson(disruptionTrends);
        }

        // Cost breakdown
        if (url === "/analytics/cost-breakdown" && method === "GET") {
          return sendJson(costBreakdown);
        }

        // Pass through if no mock matched
        next();
      });
    },
  };
}

