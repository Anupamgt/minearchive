# MineArchive Backend & Integration Implementation Plan

This plan outlines the architecture and steps to build the backend (Phase 3) and integrate the interactive map (Phase 4), reflecting your decisions to use a local Dockerized PostgreSQL+PostGIS database and Leaflet.js for the map.

## Proposed Architecture

1. **Database:** PostgreSQL with the PostGIS extension, running locally via Docker.
2. **ORM:** Prisma ORM for interacting with the database from the Next.js API routes. Prisma doesn't natively support PostGIS types seamlessly, so we will use raw SQL queries for spatial operations (`ST_Area`, `ST_Intersects`, etc.) alongside Prisma for standard CRUD.
3. **Map Library:** `react-leaflet` to render the interactive map and GeoJSON polygons on the frontend.
4. **KML Parsing:** `@tmcw/togeojson` and `xmldom` to parse uploaded KML files into GeoJSON format on the server before inserting into the database.

## User Review Required

> [!IMPORTANT]
> **Docker Requirement:** You will need to have Docker installed and running on your Mac to host the local PostgreSQL database. Is Docker Desktop currently installed and available on your system?

> [!WARNING]
> **File Storage:** Since we are using a temporary local setup, uploaded KML files and attachments will be saved to the local filesystem (`public/uploads`) instead of a cloud bucket like AWS S3. This means if you delete the project folder, the files will be lost. Let me know if you prefer to set up a cloud bucket now.

## Proposed Changes

### 1. Database Setup (Docker + Prisma)

#### [NEW] [docker-compose.yml](file:///Users/rakeshkumar/.gemini/antigravity/scratch/minearchive/docker-compose.yml)
- Defines a `postgis/postgis:15-3.3` service.
- Maps port 5432 and sets up default credentials (`minearchive_user`, `minearchive_pass`, `minearchive_db`).

#### [NEW] [schema.prisma](file:///Users/rakeshkumar/.gemini/antigravity/scratch/minearchive/prisma/schema.prisma)
- Prisma schema defining the core entities: `User`, `Node`, `Upload`, `UploadGeometry` (as Unsupported spatial types), `AuditLog`.

#### [NEW] [db.js](file:///Users/rakeshkumar/.gemini/antigravity/scratch/minearchive/lib/db.js)
- Prisma client initialization.

### 2. Backend APIs (Next.js App Router)

We will create the following API routes in `app/api/...`:
- `POST /api/nodes` — Create a new mining node.
- `GET /api/nodes` — Fetch all nodes.
- `POST /api/uploads` — Handle multipart/form-data KML uploads, parse to GeoJSON, and perform spatial intersection to match to nodes.
- `GET /api/map/layers` — Fetch the latest GeoJSON geometries for all active nodes to display on the map.

### 3. Frontend Integration

#### [MODIFY] [package.json](file:///Users/rakeshkumar/.gemini/antigravity/scratch/minearchive/package.json)
- Add dependencies: `leaflet`, `react-leaflet`, `prisma`, `@prisma/client`, `@tmcw/togeojson`, `xmldom`.

#### [MODIFY] [app/(main)/map/page.js](file:///Users/rakeshkumar/.gemini/antigravity/scratch/minearchive/app/(main)/map/page.js)
- Replace the `map-placeholder` div with the `<MapContainer>` from `react-leaflet`.
- Fetch data from `/api/map/layers` and render `<GeoJSON>` components.

#### [MODIFY] [app/(main)/upload/page.js](file:///Users/rakeshkumar/.gemini/antigravity/scratch/minearchive/app/(main)/upload/page.js)
- Wire the form submit to the `/api/uploads` endpoint to handle the actual file upload.

## Verification Plan

### Automated Tests
- Run Prisma migrations to verify schema validity.
- Test the database connection.

### Manual Verification
1. Run `docker-compose up -d` to start the database.
2. Upload a sample KML file through the UI.
3. Verify the server successfully parses the KML, saves it to the database, and auto-computes the area.
4. Navigate to the Map View and verify the polygon renders on the Leaflet map over a satellite tile layer.
