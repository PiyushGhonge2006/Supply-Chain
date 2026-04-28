import {
  db,
  warehousesTable,
  shipmentsTable,
  routesTable,
  disruptionsTable,
} from "@workspace/db";

const warehouses = [
  { name: "Mumbai Port",      type: "port",         city: "Mumbai",    country: "IN", latitude: 19.0760, longitude: 72.8777, congestionLevel: "high",   capacity: 50000, currentOccupancy: 38000, operationalStatus: "operational" },
  { name: "Bangalore Hub",    type: "distribution", city: "Bangalore", country: "IN", latitude: 12.9716, longitude: 77.5946, congestionLevel: "medium", capacity: 30000, currentOccupancy: 18000, operationalStatus: "operational" },
  { name: "Delhi DC",         type: "distribution", city: "Delhi",     country: "IN", latitude: 28.7041, longitude: 77.1025, congestionLevel: "high",   capacity: 45000, currentOccupancy: 39000, operationalStatus: "operational" },
  { name: "Chennai Port",     type: "port",         city: "Chennai",   country: "IN", latitude: 13.0827, longitude: 80.2707, congestionLevel: "medium", capacity: 40000, currentOccupancy: 22000, operationalStatus: "operational" },
  { name: "Kolkata Hub",      type: "warehouse",    city: "Kolkata",   country: "IN", latitude: 22.5726, longitude: 88.3639, congestionLevel: "low",    capacity: 25000, currentOccupancy: 9000,  operationalStatus: "operational" },
  { name: "Hyderabad DC",     type: "distribution", city: "Hyderabad", country: "IN", latitude: 17.3850, longitude: 78.4867, congestionLevel: "medium", capacity: 28000, currentOccupancy: 15000, operationalStatus: "operational" },
  { name: "Ahmedabad Hub",    type: "warehouse",    city: "Ahmedabad", country: "IN", latitude: 23.0225, longitude: 72.5714, congestionLevel: "low",    capacity: 22000, currentOccupancy: 8000,  operationalStatus: "operational" },
  { name: "Pune Hub",         type: "warehouse",    city: "Pune",      country: "IN", latitude: 18.5204, longitude: 73.8567, congestionLevel: "medium", capacity: 18000, currentOccupancy: 11000, operationalStatus: "operational" },
  { name: "Nagpur Junction",  type: "distribution", city: "Nagpur",    country: "IN", latitude: 21.1458, longitude: 79.0882, congestionLevel: "low",    capacity: 15000, currentOccupancy: 5000,  operationalStatus: "maintenance" },
  { name: "Jaipur DC",        type: "distribution", city: "Jaipur",    country: "IN", latitude: 26.9124, longitude: 75.7873, congestionLevel: "low",    capacity: 16000, currentOccupancy: 6000,  operationalStatus: "operational" },
];

const shipments = [
  { trackingId: "SC-100021", origin: "Mumbai Port",   destination: "Delhi DC",      currentLocation: "Ahmedabad Hub",   status: "in_transit", transportMode: "road", weight: 2400, estimatedDelivery: new Date(Date.now() + 36*3600e3),  carrier: "BlueDart Express", cost: 84000, latitude: 23.0225, longitude: 72.5714, riskScore: 22, delayProbability: 0.18, estimatedDelayhours: 2,  notes: "Pharma cold-chain" },
  { trackingId: "SC-100022", origin: "Chennai Port",  destination: "Bangalore Hub", currentLocation: "Chennai Port",    status: "pending",    transportMode: "road", weight: 1100, estimatedDelivery: new Date(Date.now() + 18*3600e3),  carrier: "Delhivery",        cost: 21000, latitude: 13.0827, longitude: 80.2707, riskScore: 8,  delayProbability: 0.05, estimatedDelayhours: 0,  notes: "Electronics" },
  { trackingId: "SC-100023", origin: "Kolkata Hub",   destination: "Hyderabad DC",  currentLocation: "Visakhapatnam",   status: "delayed",    transportMode: "rail", weight: 5800, estimatedDelivery: new Date(Date.now() + 24*3600e3),  carrier: "Indian Railways",  cost: 132000, latitude: 17.6868, longitude: 83.2185, riskScore: 64, delayProbability: 0.62, estimatedDelayhours: 14, notes: "Held due to monsoon" },
  { trackingId: "SC-100024", origin: "Mumbai Port",   destination: "Bangalore Hub", currentLocation: "Pune Hub",        status: "in_transit", transportMode: "road", weight: 950,  estimatedDelivery: new Date(Date.now() + 12*3600e3),  carrier: "GATI",             cost: 28500, latitude: 18.5204, longitude: 73.8567, riskScore: 18, delayProbability: 0.10, estimatedDelayhours: 1,  notes: "Apparel order" },
  { trackingId: "SC-100025", origin: "Delhi DC",      destination: "Jaipur DC",     currentLocation: "Delhi DC",        status: "pending",    transportMode: "road", weight: 600,  estimatedDelivery: new Date(Date.now() + 8*3600e3),   carrier: "DTDC",             cost: 9800,  latitude: 28.7041, longitude: 77.1025, riskScore: 5,  delayProbability: 0.03, estimatedDelayhours: 0,  notes: "" },
  { trackingId: "SC-100026", origin: "Mumbai Port",   destination: "Kolkata Hub",   currentLocation: "Nagpur Junction", status: "at_risk",    transportMode: "rail", weight: 9200, estimatedDelivery: new Date(Date.now() + 30*3600e3),  carrier: "Indian Railways",  cost: 215000, latitude: 21.1458, longitude: 79.0882, riskScore: 78, delayProbability: 0.71, estimatedDelayhours: 22, notes: "Strike risk near route" },
  { trackingId: "SC-100027", origin: "Bangalore Hub", destination: "Chennai Port",  currentLocation: "Chennai Port",    status: "delivered",  transportMode: "road", weight: 320,  estimatedDelivery: new Date(Date.now() - 2*3600e3),   actualDelivery: new Date(Date.now() - 1*3600e3), carrier: "Delhivery",        cost: 6400,  latitude: 13.0827, longitude: 80.2707, riskScore: 0,  delayProbability: 0,    estimatedDelayhours: 0,  notes: "Delivered on time" },
  { trackingId: "SC-100028", origin: "Hyderabad DC",  destination: "Mumbai Port",   currentLocation: "Pune Hub",        status: "in_transit", transportMode: "road", weight: 1750, estimatedDelivery: new Date(Date.now() + 14*3600e3),  carrier: "GATI",             cost: 39000, latitude: 18.5204, longitude: 73.8567, riskScore: 12, delayProbability: 0.07, estimatedDelayhours: 0,  notes: "Auto parts" },
];

const routes = [
  { name: "MUM-DEL Express",     origin: "Mumbai Port",   destination: "Delhi DC",      transportMode: "road", distanceKm: 1417, estimatedHours: 26, costPerKg: 4.2, carbonFootprint: 18.5, reliability: 88, isOptimal: true,  waypoints: ["Ahmedabad Hub","Jaipur DC"] },
  { name: "MUM-DEL Heavy",       origin: "Mumbai Port",   destination: "Delhi DC",      transportMode: "rail", distanceKm: 1384, estimatedHours: 32, costPerKg: 2.1, carbonFootprint: 6.2,  reliability: 92, isOptimal: false, waypoints: ["Vadodara","Kota"] },
  { name: "MUM-DEL Air",         origin: "Mumbai Port",   destination: "Delhi DC",      transportMode: "air",  distanceKm: 1148, estimatedHours: 3,  costPerKg: 28.0,carbonFootprint: 142.0,reliability: 96, isOptimal: false, waypoints: [] },
  { name: "CHE-BLR Direct",      origin: "Chennai Port",  destination: "Bangalore Hub", transportMode: "road", distanceKm: 346,  estimatedHours: 7,  costPerKg: 1.9, carbonFootprint: 4.5,  reliability: 94, isOptimal: true,  waypoints: ["Krishnagiri"] },
  { name: "CHE-BLR Rail",        origin: "Chennai Port",  destination: "Bangalore Hub", transportMode: "rail", distanceKm: 358,  estimatedHours: 6,  costPerKg: 1.1, carbonFootprint: 1.6,  reliability: 90, isOptimal: false, waypoints: [] },
  { name: "MUM-BLR Express",     origin: "Mumbai Port",   destination: "Bangalore Hub", transportMode: "road", distanceKm: 984,  estimatedHours: 18, costPerKg: 3.4, carbonFootprint: 12.8, reliability: 86, isOptimal: true,  waypoints: ["Pune Hub"] },
  { name: "KOL-HYD Rail",        origin: "Kolkata Hub",   destination: "Hyderabad DC",  transportMode: "rail", distanceKm: 1499, estimatedHours: 28, costPerKg: 2.4, carbonFootprint: 7.8,  reliability: 84, isOptimal: true,  waypoints: ["Visakhapatnam"] },
  { name: "DEL-JAI Express",     origin: "Delhi DC",      destination: "Jaipur DC",     transportMode: "road", distanceKm: 281,  estimatedHours: 5,  costPerKg: 1.5, carbonFootprint: 3.2,  reliability: 96, isOptimal: true,  waypoints: [] },
];

const disruptions = [
  { type: "weather",        severity: "high",     title: "Cyclone warning — east coast",     description: "Tropical cyclone forming in Bay of Bengal expected to make landfall near Visakhapatnam within 24 hours.", affectedRegion: "East India",     affectedRoutes: ["KOL-HYD Rail"],    estimatedImpactHours: 36, latitude: 17.6868, longitude: 83.2185 },
  { type: "labor",          severity: "medium",   title: "Truck drivers' strike in Maharashtra", description: "Limited movement on NH48 and NH3 due to indefinite drivers' strike.",                              affectedRegion: "Maharashtra",   affectedRoutes: ["MUM-BLR Express"], estimatedImpactHours: 48, latitude: 19.0760, longitude: 72.8777 },
  { type: "infrastructure", severity: "critical", title: "Bridge collapse on NH44 (Madhya Pradesh)", description: "Major north-south corridor disrupted; expect lengthy detours.",                                 affectedRegion: "Central India", affectedRoutes: ["MUM-DEL Express"], estimatedImpactHours: 168, latitude: 24.5854, longitude: 78.5755 },
  { type: "accident",       severity: "low",      title: "Multi-vehicle pileup near Pune",   description: "Two-lane closure on Mumbai-Pune expressway, expected clear within 4h.",                                  affectedRegion: "Maharashtra",   affectedRoutes: [],                  estimatedImpactHours: 4,  latitude: 18.5204, longitude: 73.8567 },
  { type: "customs",        severity: "medium",   title: "Customs backlog at Chennai Port",  description: "Inbound clearance delayed by ~36 hours due to staffing shortage.",                                       affectedRegion: "Tamil Nadu",    affectedRoutes: [],                  estimatedImpactHours: 36, latitude: 13.0827, longitude: 80.2707 },
];

async function main() {
  console.log("Clearing existing data…");
  await db.delete(shipmentsTable);
  await db.delete(disruptionsTable);
  await db.delete(routesTable);
  await db.delete(warehousesTable);

  console.log(`Inserting ${warehouses.length} warehouses…`);
  await db.insert(warehousesTable).values(warehouses);

  console.log(`Inserting ${shipments.length} shipments…`);
  await db.insert(shipmentsTable).values(shipments);

  console.log(`Inserting ${routes.length} routes…`);
  await db.insert(routesTable).values(routes);

  console.log(`Inserting ${disruptions.length} disruptions…`);
  await db.insert(disruptionsTable).values(disruptions);

  console.log("Seed complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
