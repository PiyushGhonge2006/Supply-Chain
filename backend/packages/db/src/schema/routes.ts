import { pgTable, serial, text, real, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const routesTable = pgTable("routes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  origin: text("origin").notNull(),
  destination: text("destination").notNull(),
  transportMode: text("transport_mode").notNull(),
  distanceKm: real("distance_km").notNull(),
  estimatedHours: real("estimated_hours").notNull(),
  costPerKg: real("cost_per_kg").notNull(),
  carbonFootprint: real("carbon_footprint").notNull(),
  reliability: real("reliability").notNull(),
  isOptimal: boolean("is_optimal").notNull().default(false),
  waypoints: text("waypoints").array().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertRouteSchema = createInsertSchema(routesTable).omit({
  id: true,
  createdAt: true,
});

export type InsertRoute = z.infer<typeof insertRouteSchema>;
export type Route = typeof routesTable.$inferSelect;
