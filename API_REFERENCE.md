# API Reference

## Environment Variables

### Backend

File: `backend/.env`

```env
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/supply_chain
```

### Frontend

File: `frontend/.env`

```env
VITE_API_BASE_URL=http://localhost:3001/api
```

## Backend API Base URL

Local:

```text
http://localhost:3001/api
```

## Available API Routes

- `GET /api/healthz`
- `GET /api/shipments`
- `GET /api/disruptions`
- `GET /api/routes`
- `GET /api/warehouses`
- `GET /api/analytics`

## API Keys

No third-party API keys were found in the current project files.

No `OPENAI_API_KEY`, `GOOGLE_MAPS_API_KEY`, `MAPBOX_TOKEN`, `STRIPE_SECRET_KEY`, or similar secret keys are currently configured in the app.
