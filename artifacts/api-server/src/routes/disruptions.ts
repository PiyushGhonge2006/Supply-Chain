import { Router } from "express";
import { db, disruptionsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import {
  ListDisruptionsQueryParams,
  CreateDisruptionBody,
  UpdateDisruptionBody,
  UpdateDisruptionParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/", async (req, res) => {
  const query = ListDisruptionsQueryParams.parse(req.query);
  const conditions: any[] = [];
  if (query.severity) {
    conditions.push(eq(disruptionsTable.severity, query.severity));
  }
  if (query.resolved !== undefined) {
    conditions.push(eq(disruptionsTable.resolved, query.resolved));
  }
  const disruptions = await db
    .select()
    .from(disruptionsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(disruptionsTable.createdAt));
  res.json(disruptions.map(formatDisruption));
});

router.post("/", async (req, res) => {
  const body = CreateDisruptionBody.parse(req.body);
  const [disruption] = await db
    .insert(disruptionsTable)
    .values({
      type: body.type,
      severity: body.severity,
      title: body.title,
      description: body.description,
      affectedRegion: body.affectedRegion,
      affectedRoutes: body.affectedRoutes ?? [],
      estimatedImpactHours: body.estimatedImpactHours,
      resolved: false,
      latitude: body.latitude ?? null,
      longitude: body.longitude ?? null,
    })
    .returning();
  res.status(201).json(formatDisruption(disruption));
});

router.patch("/:id", async (req, res) => {
  const { id } = UpdateDisruptionParams.parse({ id: Number(req.params.id) });
  const body = UpdateDisruptionBody.parse(req.body);
  const updateData: any = { ...body, updatedAt: new Date() };
  if (body.resolved) {
    updateData.resolvedAt = new Date();
  }
  const [disruption] = await db
    .update(disruptionsTable)
    .set(updateData)
    .where(eq(disruptionsTable.id, id))
    .returning();
  if (!disruption) {
    res.status(404).json({ error: "Disruption not found" });
    return;
  }
  res.json(formatDisruption(disruption));
});

function formatDisruption(d: typeof disruptionsTable.$inferSelect) {
  return {
    id: d.id,
    type: d.type,
    severity: d.severity,
    title: d.title,
    description: d.description,
    affectedRegion: d.affectedRegion,
    affectedRoutes: d.affectedRoutes ?? [],
    estimatedImpactHours: d.estimatedImpactHours,
    resolved: d.resolved,
    resolvedAt: d.resolvedAt?.toISOString() ?? null,
    latitude: d.latitude ?? null,
    longitude: d.longitude ?? null,
    createdAt: d.createdAt?.toISOString(),
    updatedAt: d.updatedAt?.toISOString(),
  };
}

export default router;
