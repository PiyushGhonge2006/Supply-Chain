import { pgTable, serial, text, real, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const disruptionsTable = pgTable("disruptions", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  severity: text("severity").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  affectedRegion: text("affected_region").notNull(),
  affectedRoutes: text("affected_routes").array().notNull().default([]),
  estimatedImpactHours: real("estimated_impact_hours").notNull(),
  resolved: boolean("resolved").notNull().default(false),
  resolvedAt: timestamp("resolved_at"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertDisruptionSchema = createInsertSchema(disruptionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertDisruption = z.infer<typeof insertDisruptionSchema>;
export type Disruption = typeof disruptionsTable.$inferSelect;
