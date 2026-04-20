import { Router } from "express";
import { db, warehousesTable } from "@workspace/db";
import { desc } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  const warehouses = await db
    .select()
    .from(warehousesTable)
    .orderBy(desc(warehousesTable.createdAt));
  res.json(warehouses.map(formatWarehouse));
});

function formatWarehouse(w: typeof warehousesTable.$inferSelect) {
  return {
    id: w.id,
    name: w.name,
    type: w.type,
    city: w.city,
    country: w.country,
    latitude: w.latitude,
    longitude: w.longitude,
    congestionLevel: w.congestionLevel,
    capacity: w.capacity,
    currentOccupancy: w.currentOccupancy,
    operationalStatus: w.operationalStatus,
    createdAt: w.createdAt?.toISOString(),
  };
}

export default router;
