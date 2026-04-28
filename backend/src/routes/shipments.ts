import { Router } from "express";
import { db, shipmentsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import {
  ListShipmentsQueryParams,
  CreateShipmentBody,
  UpdateShipmentBody,
  GetShipmentParams,
  UpdateShipmentParams,
  DeleteShipmentParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/", async (req, res) => {
  const query = ListShipmentsQueryParams.parse(req.query);
  const conditions = [];
  if (query.status) {
    conditions.push(eq(shipmentsTable.status, query.status));
  }
  const shipments = await db
    .select()
    .from(shipmentsTable)
    .where(conditions.length > 0 ? conditions[0] : undefined)
    .orderBy(desc(shipmentsTable.createdAt))
    .limit(query.limit ?? 50)
    .offset(query.offset ?? 0);
  res.json(shipments.map(formatShipment));
});

router.post("/", async (req, res) => {
  const body = CreateShipmentBody.parse(req.body);
  const [shipment] = await db
    .insert(shipmentsTable)
    .values({
      trackingId: body.trackingId,
      origin: body.origin,
      destination: body.destination,
      currentLocation: body.currentLocation,
      status: body.status ?? "pending",
      transportMode: body.transportMode,
      weight: body.weight,
      estimatedDelivery: body.estimatedDelivery ? new Date(body.estimatedDelivery) : new Date(),
      carrier: body.carrier,
      cost: body.cost,
      latitude: body.latitude ?? null,
      longitude: body.longitude ?? null,
      notes: body.notes ?? null,
      riskScore: Math.random() * 60 + 10,
      delayProbability: Math.random() * 0.5,
      estimatedDelayhours: Math.random() * 24,
    })
    .returning();
  res.status(201).json(formatShipment(shipment));
});

router.get("/:id", async (req, res) => {
  const { id } = GetShipmentParams.parse({ id: Number(req.params.id) });
  const [shipment] = await db
    .select()
    .from(shipmentsTable)
    .where(eq(shipmentsTable.id, id));
  if (!shipment) {
    res.status(404).json({ error: "Shipment not found" });
    return;
  }
  res.json(formatShipment(shipment));
});

router.patch("/:id", async (req, res) => {
  const { id } = UpdateShipmentParams.parse({ id: Number(req.params.id) });
  const body = UpdateShipmentBody.parse(req.body);
  const [shipment] = await db
    .update(shipmentsTable)
    .set({
      ...body,
      updatedAt: new Date(),
    })
    .where(eq(shipmentsTable.id, id))
    .returning();
  if (!shipment) {
    res.status(404).json({ error: "Shipment not found" });
    return;
  }
  res.json(formatShipment(shipment));
});

router.delete("/:id", async (req, res) => {
  const { id } = DeleteShipmentParams.parse({ id: Number(req.params.id) });
  await db.delete(shipmentsTable).where(eq(shipmentsTable.id, id));
  res.status(204).send();
});

function formatShipment(s: typeof shipmentsTable.$inferSelect) {
  return {
    id: s.id,
    trackingId: s.trackingId,
    origin: s.origin,
    destination: s.destination,
    currentLocation: s.currentLocation,
    status: s.status,
    transportMode: s.transportMode,
    weight: s.weight,
    estimatedDelivery: s.estimatedDelivery?.toISOString(),
    actualDelivery: s.actualDelivery?.toISOString() ?? null,
    riskScore: s.riskScore,
    delayProbability: s.delayProbability,
    estimatedDelayhours: s.estimatedDelayhours,
    carrier: s.carrier,
    cost: s.cost,
    latitude: s.latitude ?? null,
    longitude: s.longitude ?? null,
    notes: s.notes ?? null,
    createdAt: s.createdAt?.toISOString(),
    updatedAt: s.updatedAt?.toISOString(),
  };
}

export default router;
