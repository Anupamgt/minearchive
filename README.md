# MineArchive

**Mining Area Directory & Archive**

A web-based application for monitoring changes in mining areas through KML boundary file uploads, map visualization, and historical tracking.

## Features

- **KML Upload & Parsing** — Upload KML/KMZ files with multi-polygon support, auto-matching to existing mining nodes
- **Interactive Map View** — Click mining area polygons to access upload history via a side panel
- **Change Detection** — Automated boundary diff metrics (area change, perimeter change) + visual polygon overlay comparison
- **Audit Trail** — Immutable compliance logging of all system actions
- **PDF Reports** — Per-node history export for external stakeholders
- **Role-Based Access** — Central Administrator (full access) and Field Users (upload + view)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js (App Router) + Vanilla CSS |
| Map | ArcGIS JavaScript SDK / Leaflet.js |
| Backend | Next.js API Routes |
| Database | PostgreSQL + PostGIS |
| File Storage | Cloud Object Storage (S3/GCS) |
| Auth | JWT + bcrypt |

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
minearchive/
├── app/
│   ├── globals.css          # Design system (GeoFlow-inherited dark theme)
│   ├── layout.js            # Root layout
│   ├── login/               # Login page
│   ├── components/          # Shared components (Header, Sidebar)
│   └── (main)/              # Authenticated route group
│       ├── layout.js        # Header + Sidebar layout
│       ├── dashboard/       # Dashboard with stats + map overview
│       ├── map/             # Interactive map with side panel
│       ├── upload/          # KML upload form
│       ├── nodes/           # Node management (admin)
│       ├── users/           # User management (admin)
│       └── audit/           # Audit log
├── public/                  # Static assets
├── package.json
└── README.md
```

## Design System

Minimal, flat, IDE-style dark theme inherited from GeoFlow/GeoDB:

- Background: `#1e1e1e` | Surfaces: `#252526`, `#2d2d30`
- Accent: `#007acc` | Text: `#e2e8f0` | Muted: `#64748b`
- Border radius: `0px` everywhere (sharp corners)
- No glassmorphism, no gradients — flat and data-dense

## License

Private — All rights reserved.
