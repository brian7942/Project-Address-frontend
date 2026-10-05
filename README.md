# Project:Address — frontend

**Digital addresses for places without a reliable address system.** This is the web map for [Project:Address](https://projectaddress.dev), starting with **Laos**.

🌐 **Live:** [projectaddress.dev](https://projectaddress.dev)

## Why

The project started from parcel deliveries failing in Laos, where many buildings have no usable address. Project:Address generates consistent, human-readable addresses from open map data, so a building can be found without local knowledge.

## What this repo contains

The Next.js frontend:

- **Administrative drill-down:** pick a province, then a district. The map zooms and highlights each level, with Laos boundaries loaded as GeoJSON.
- **Building layer:** building footprints with their generated address attributes (street, house number, admin units). The MVP renders a sample dataset.
- **Address formatting:** builds a display address from the admin hierarchy plus building attributes, with defensive parsing of external GeoJSON, which can be missing fields or mix types.
- **Boundary fetch scripts:** `scripts/fetch-adm*.mjs` pull ADM0/ADM1 boundaries from [geoBoundaries](https://www.geoboundaries.org/) (pinned release, proxy-aware).

The numbering engine (block generation and building numbering on PostGIS) lives in a separate private backend.

## How addresses are generated

1. Load the scope by administrative unit: country → province → district → village.
2. Generate blocks from the road network and building density.
3. Number buildings: grid-first, with road-aware adjustments.
4. Assemble a deterministic, conflict-free address string.

An early fixed-rule numbering scheme couldn't handle dense urban grids, dispersed rural settlements and different local conventions, so the approach is moving to a data-driven one.

## Stack

Next.js 15 · React 19 · TypeScript · Tailwind CSS · shadcn/ui (Radix) · Leaflet / react-leaflet · Vercel

## Run locally

```bash
cd frontend
pnpm install
pnpm dev
```

Open http://localhost:3000.

## Data & attribution

Boundaries: [geoBoundaries](https://www.geoboundaries.org/) (gbOpen, CC BY 4.0) and Natural Earth · Basemap and buildings © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.

---

Built by [Heesu Kim](https://github.com/brian7942). Presented at SF Tech Week 2025.
