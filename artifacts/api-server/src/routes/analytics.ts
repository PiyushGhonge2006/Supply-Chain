import { Router } from "express";
import { db, shipmentsTable, disruptionsTable, routesTable } from "@workspace/db";
import { eq, and, count, avg, sum, sql } from "drizzle-orm";

const router = Router();

router.get("/dashboard", async (req, res) => {
  const shipments = await db.select().from(shipmentsTable);
  const disruptions = await db.select().from(disruptionsTable);

  const totalShipments = shipments.length;
  const activeShipments = shipments.filter((s) => s.status === "in_transit").length;
  const delayedShipments = shipments.filter((s) => s.status === "delayed").length;
  const atRiskShipments = shipments.filter((s) => s.status === "at_risk").length;
  const deliveredToday = shipments.filter((s) => {
    if (s.status !== "delivered") return false;
    const today = new Date();
    return s.actualDelivery && s.actualDelivery.toDateString() === today.toDateString();
  }).length;
  const activeDisruptions = disruptions.filter((d) => !d.resolved).length;
  const criticalDisruptions = disruptions.filter((d) => !d.resolved && d.severity === "critical").length;
  const avgRiskScore = totalShipments > 0
    ? shipments.reduce((sum, s) => sum + s.riskScore, 0) / totalShipments
    : 0;
  const delivered = shipments.filter((s) => s.status === "delivered");
  const onTimeDeliveries = delivered.filter((s) => {
    if (!s.actualDelivery || !s.estimatedDelivery) return false;
    return s.actualDelivery <= s.estimatedDelivery;
  }).length;
  const onTimeRate = delivered.length > 0 ? (onTimeDeliveries / delivered.length) * 100 : 95;
  const totalCost = shipments.reduce((acc, s) => acc + s.cost, 0);
  const potentialSavings = totalCost * 0.08;

  res.json({
    totalShipments,
    activeShipments,
    delayedShipments,
    atRiskShipments,
    deliveredToday,
    activeDisruptions,
    criticalDisruptions,
    avgRiskScore: Math.round(avgRiskScore * 10) / 10,
    onTimeRate: Math.round(onTimeRate * 10) / 10,
    totalCost: Math.round(totalCost),
    potentialSavings: Math.round(potentialSavings),
  });
});

router.get("/risk-scores", async (req, res) => {
  const shipments = await db
    .select()
    .from(shipmentsTable)
    .where(eq(shipmentsTable.status, "in_transit"));

  const riskScores = shipments.map((s) => {
    const riskFactors: string[] = [];
    if (s.riskScore > 70) riskFactors.push("High inherent risk score");
    if (s.delayProbability > 0.5) riskFactors.push("High delay probability");
    if (s.estimatedDelayhours > 12) riskFactors.push("Extended delay expected");
    if (s.transportMode === "sea") riskFactors.push("Sea transport weather exposure");
    if (s.transportMode === "road") riskFactors.push("Road traffic exposure");

    let riskLevel: string;
    if (s.riskScore >= 75) riskLevel = "critical";
    else if (s.riskScore >= 50) riskLevel = "high";
    else if (s.riskScore >= 25) riskLevel = "medium";
    else riskLevel = "low";

    return {
      shipmentId: s.id,
      trackingId: s.trackingId,
      riskScore: s.riskScore,
      riskLevel,
      riskFactors: riskFactors.length > 0 ? riskFactors : ["Normal operations"],
      delayProbability: s.delayProbability,
      estimatedDelayhours: s.estimatedDelayhours,
    };
  });

  res.json(riskScores.sort((a, b) => b.riskScore - a.riskScore));
});

router.get("/delay-forecast", async (req, res) => {
  const causes = ["Weather events", "Port congestion", "Labor shortage", "Traffic", "Mechanical failure"];
  const forecast = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const baseDelays = Math.floor(Math.random() * 8) + 2;
    return {
      date: date.toISOString().split("T")[0],
      forecastedDelays: baseDelays,
      predictedAvgDelayHours: Math.round((Math.random() * 12 + 2) * 10) / 10,
      confidence: Math.round((Math.random() * 20 + 75) * 10) / 10,
      mainCause: causes[Math.floor(Math.random() * causes.length)],
    };
  });
  res.json(forecast);
});

router.get("/disruption-trends", async (req, res) => {
  const disruptions = await db.select().from(disruptionsTable);
  const last14days = Array.from({ length: 14 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (13 - i));
    const dateStr = date.toISOString().split("T")[0];
    const dayDisruptions = disruptions.filter((d) => {
      const created = d.createdAt?.toISOString().split("T")[0];
      return created === dateStr;
    });
    return {
      date: dateStr,
      weather: dayDisruptions.filter((d) => d.type === "weather").length || Math.floor(Math.random() * 3),
      traffic: dayDisruptions.filter((d) => d.type === "traffic").length || Math.floor(Math.random() * 2),
      port_congestion: dayDisruptions.filter((d) => d.type === "port_congestion").length || Math.floor(Math.random() * 2),
      labor_strike: dayDisruptions.filter((d) => d.type === "labor_strike").length || Math.floor(Math.random() * 1),
      mechanical: dayDisruptions.filter((d) => d.type === "mechanical").length || Math.floor(Math.random() * 2),
      other: dayDisruptions.filter((d) => !["weather","traffic","port_congestion","labor_strike","mechanical"].includes(d.type)).length || Math.floor(Math.random() * 1),
    };
  });
  res.json(last14days);
});

router.get("/cost-breakdown", async (req, res) => {
  const shipments = await db.select().from(shipmentsTable);
  const modes = ["air", "sea", "rail", "road", "multimodal"];
  const breakdown = modes.map((mode) => {
    const modeShipments = shipments.filter((s) => s.transportMode === mode);
    const avgCost = modeShipments.length > 0
      ? modeShipments.reduce((acc, s) => acc + s.cost / s.weight, 0) / modeShipments.length
      : getFallbackCostPerKg(mode);
    return {
      mode,
      avgCostPerKg: Math.round(avgCost * 100) / 100,
      avgTransitHours: getFallbackTransitHours(mode),
      reliability: getFallbackReliability(mode),
      carbonFootprint: getFallbackCarbon(mode),
      shipmentCount: modeShipments.length,
    };
  });
  res.json(breakdown);
});

function getFallbackCostPerKg(mode: string) {
  const costs: Record<string, number> = { air: 8.5, sea: 0.8, rail: 2.1, road: 3.2, multimodal: 2.8 };
  return costs[mode] ?? 3.0;
}
function getFallbackTransitHours(mode: string) {
  const hours: Record<string, number> = { air: 24, sea: 480, rail: 168, road: 72, multimodal: 120 };
  return hours[mode] ?? 96;
}
function getFallbackReliability(mode: string) {
  const rel: Record<string, number> = { air: 92, sea: 78, rail: 85, road: 88, multimodal: 82 };
  return rel[mode] ?? 85;
}
function getFallbackCarbon(mode: string) {
  const carbon: Record<string, number> = { air: 500, sea: 15, rail: 30, road: 120, multimodal: 80 };
  return carbon[mode] ?? 100;
}

export default router;
