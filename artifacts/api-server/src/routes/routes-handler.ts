import { Router } from "express";
import { db, routesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import {
  CreateRouteBody,
  OptimizeRouteParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/", async (req, res) => {
  const routes = await db
    .select()
    .from(routesTable)
    .orderBy(desc(routesTable.createdAt));
  res.json(routes.map(formatRoute));
});

router.post("/", async (req, res) => {
  const body = CreateRouteBody.parse(req.body);
  const [route] = await db
    .insert(routesTable)
    .values({
      name: body.name,
      origin: body.origin,
      destination: body.destination,
      transportMode: body.transportMode,
      distanceKm: body.distanceKm,
      estimatedHours: body.estimatedHours,
      costPerKg: body.costPerKg,
      carbonFootprint: body.carbonFootprint,
      reliability: body.reliability,
      isOptimal: false,
      waypoints: body.waypoints ?? [],
    })
    .returning();
  res.status(201).json(formatRoute(route));
});

router.post("/:id/optimize", async (req, res) => {
  const { id } = OptimizeRouteParams.parse({ id: Number(req.params.id) });
  const [original] = await db
    .select()
    .from(routesTable)
    .where(eq(routesTable.id, id));
  if (!original) {
    res.status(404).json({ error: "Route not found" });
    return;
  }

  const allRoutes = await db.select().from(routesTable);
  const alternatives = allRoutes
    .filter((r) => r.id !== id && r.origin === original.origin && r.destination === original.destination)
    .slice(0, 3)
    .map((r) => ({
      route: formatRoute(r),
      reason: getOptimizationReason(r, original),
      tradeoffs: getTradeoffs(r, original),
      score: Math.round(r.reliability * 0.4 + (100 - r.costPerKg * 2) * 0.3 + (100 - r.estimatedHours * 0.5) * 0.3),
    }));

  const bestAlt = alternatives[0];
  const costSaving = bestAlt ? (original.costPerKg - bestAlt.route.costPerKg) * 1000 : 0;
  const timeSaving = bestAlt ? original.estimatedHours - bestAlt.route.estimatedHours : 0;

  res.json({
    originalRoute: formatRoute(original),
    alternatives,
    recommendation: alternatives.length > 0
      ? `Consider switching to ${alternatives[0].route.name} for ${timeSaving > 0 ? `${Math.abs(timeSaving).toFixed(0)} hours faster delivery` : `${Math.abs(costSaving).toFixed(0)} cost savings`}.`
      : "Current route is optimal given available alternatives.",
    costSaving: Math.max(0, costSaving),
    timeSaving: Math.max(0, timeSaving),
  });
});

function getOptimizationReason(r: typeof routesTable.$inferSelect, orig: typeof routesTable.$inferSelect) {
  if (r.costPerKg < orig.costPerKg) return "Lower cost per kg";
  if (r.estimatedHours < orig.estimatedHours) return "Faster delivery time";
  if (r.reliability > orig.reliability) return "Higher route reliability";
  return "Alternative routing option";
}

function getTradeoffs(r: typeof routesTable.$inferSelect, orig: typeof routesTable.$inferSelect) {
  const parts: string[] = [];
  if (r.carbonFootprint > orig.carbonFootprint) parts.push("higher carbon footprint");
  if (r.estimatedHours > orig.estimatedHours) parts.push(`${(r.estimatedHours - orig.estimatedHours).toFixed(0)}h longer`);
  if (r.costPerKg > orig.costPerKg) parts.push("higher cost");
  return parts.length > 0 ? parts.join(", ") : "No significant tradeoffs";
}

function formatRoute(r: typeof routesTable.$inferSelect) {
  return {
    id: r.id,
    name: r.name,
    origin: r.origin,
    destination: r.destination,
    transportMode: r.transportMode,
    distanceKm: r.distanceKm,
    estimatedHours: r.estimatedHours,
    costPerKg: r.costPerKg,
    carbonFootprint: r.carbonFootprint,
    reliability: r.reliability,
    isOptimal: r.isOptimal,
    waypoints: r.waypoints ?? [],
    createdAt: r.createdAt?.toISOString(),
  };
}

export default router;
