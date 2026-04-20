import { pgTable, serial, text, real, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const shipmentsTable = pgTable("shipments", {
  id: serial("id").primaryKey(),
  trackingId: text("tracking_id").notNull().unique(),
  origin: text("origin").notNull(),
  destination: text("destination").notNull(),
  currentLocation: text("current_location").notNull(),
  status: text("status").notNull().default("pending"),
  transportMode: text("transport_mode").notNull(),
  weight: real("weight").notNull(),
  estimatedDelivery: timestamp("estimated_delivery").notNull(),
  actualDelivery: timestamp("actual_delivery"),
  riskScore: real("risk_score").notNull().default(0),
  delayProbability: real("delay_probability").notNull().default(0),
  estimatedDelayhours: real("estimated_delay_hours").notNull().default(0),
  carrier: text("carrier").notNull(),
  cost: real("cost").notNull(),
  latitude: real("latitude"),
  longitude: real("longitude"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertShipmentSchema = createInsertSchema(shipmentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertShipment = z.infer<typeof insertShipmentSchema>;
export type Shipment = typeof shipmentsTable.$inferSelect;
