# Smart Supply Chain Optimization System

## Overview

A full-stack real-time supply chain monitoring and optimization platform. Provides live shipment tracking, disruption prediction, route optimization recommendations, risk scoring, and predictive analytics for global logistics operations.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS (dark command-center theme)
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Charts**: Recharts

## Artifacts

- **supply-chain** (previewPath: `/`) — Main React dashboard web app
- **api-server** (previewPath: `/api`) — Express REST API server

## Pages

- `/` — Global Command Center Dashboard (KPIs, disruptions feed, risk scores)
- `/shipments` — Shipment tracker with filters and risk indicators
- `/shipments/:id` — Shipment detail view
- `/disruptions` — Disruption alerts (weather, port congestion, strikes, etc.)
- `/routes` — Route optimizer with cost/time tradeoffs
- `/analytics` — Charts: delay forecast, disruption trends, cost breakdown
- `/warehouses` — Warehouse and port congestion monitoring

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Database Tables

- `shipments` — Shipment records with tracking, status, risk scores, delay probability
- `disruptions` — Disruption alerts by type/severity, resolved status
- `routes` — Logistics routes with cost/time/reliability metrics
- `warehouses` — Warehouse and port locations, congestion levels, capacity

## API Endpoints

- `GET /api/analytics/dashboard` — KPI summary
- `GET /api/analytics/risk-scores` — Risk scores for active shipments
- `GET /api/analytics/delay-forecast` — 7-day delay forecast
- `GET /api/analytics/disruption-trends` — 14-day disruption trends
- `GET /api/analytics/cost-breakdown` — Cost by transport mode
- `GET/POST /api/shipments` — List/create shipments
- `GET/PATCH/DELETE /api/shipments/:id` — Shipment CRUD
- `GET/POST /api/disruptions` — List/create disruptions
- `PATCH /api/disruptions/:id` — Resolve/update disruption
- `GET/POST /api/routes` — List/create routes
- `POST /api/routes/:id/optimize` — Get route optimization alternatives
- `GET /api/warehouses` — List warehouses and ports

## Important Notes

After codegen, manually fix `lib/api-zod/src/index.ts` to only export from `./generated/api` (not `./generated/types`) to avoid duplicate export errors from TypeScript.
