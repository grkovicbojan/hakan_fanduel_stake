# SportBet Odds Comparator

Monorepo with 3 parts:
- `backend`: Express + TimescaleDB + Worker Threads + WebSocket
- `frontend`: React + Vite dashboard/settings/alert pages
- `extension`: Chrome MV3 extension for periodic HTML scraping

## 1) Global Environment

Create root `.env` from `.env.example`:

```bash
cp .env.example .env
```

All services use this one file.

For frontend, Vite reads root `.env` (`envDir: ".."`).  
For extension, run config sync:

```bash
npm run sync:extension-config
```

## 2) Install

```bash
npm install
```

## 3) Database

TimescaleDB must be installed in PostgreSQL.

```bash
npm --workspace backend run migrate
```

## 4) Run

Backend:

```bash
npm run dev:backend
```

Frontend:

```bash
npm run dev:frontend
```

Extension:
- Open `chrome://extensions`
- Enable Developer mode
- Load unpacked extension from `extension/`

## API Summary

- `POST /api/health`
  - req: `{ data: "<main website url>" }`
  - res: `{ data: "ok" }`

- `POST /api/scrape`
  - req: `{ type: "M"|"S", url, data, timestamp }`
  - res (M): `{ result, intervals: { scrapeInterval, refreshInterval }, urls: [] }`
  - res (S): `{ result }`

- `GET/POST/PUT/DELETE /setting`
- `GET /dashboard`
- `GET /alert`
