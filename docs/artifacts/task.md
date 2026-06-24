# MineArchive — Build Tasks

## Phase 1: Project Scaffolding
- [x] Create GitHub repo (Anupamgt/minearchive)
- [x] Install Node.js (v26.3.0)
- [x] Initialize Next.js project (v16.2.9, Turbopack)
- [x] Set up project structure (pages, components, styles, lib)
- [x] Create design system CSS (GeoFlow-inherited variables)
- [x] Create README.md
- [x] Initial commit and push to GitHub

## Phase 2: Core Pages (Frontend — Static/Mock Data)
- [x] Login page
- [x] Dashboard layout (header, stats strip, map placeholder, activity feed)
- [x] Map View page with side panel interaction (timeline/table toggle, change metrics)
- [x] Upload KML page with form (drag-drop, metadata, detected areas)
- [x] Audit Log page with filterable table
- [x] User Management page (admin) with create user modal
- [x] Node Management page (admin) with create node modal + approve/reject

## Phase 3: Backend API
- [ ] Database schema (PostgreSQL + PostGIS)
- [ ] Auth API (login, JWT)
- [ ] Users CRUD API
- [ ] Nodes CRUD API
- [ ] Uploads API (KML upload + parsing)
- [ ] Audit Log API
- [ ] Map layers API (GeoJSON endpoints)

## Phase 4: Integration
- [ ] Connect frontend to backend APIs
- [ ] ArcGIS/Leaflet map integration
- [ ] KML parsing and polygon extraction
- [ ] Change metrics computation
- [ ] Email notifications
- [ ] PDF report generation

## Phase 5: Polish & Deploy
- [x] Initial commit and push to GitHub
- [ ] Docker setup
- [ ] CI/CD pipeline
- [ ] Documentation
