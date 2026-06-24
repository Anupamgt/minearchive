# MineArchive — Product Requirements Document

**Mining Area Directory & Archive**
Version 1.0 | June 2026

---

## 1. Overview

MineArchive is a web-based directory and archive application for monitoring changes in mining areas. It enables field users to upload KML boundary files for mining enclosures ("nodes"), and provides administrators with a centralized map-based interface to track, compare, and audit boundary changes over time.

> [!IMPORTANT]
> The UI follows a **minimal, flat, IDE-style dark theme** matching the GeoFlow/GeoDB design language — sharp corners, `#1e1e1e` background, `#007acc` accent, no glassmorphism, no gradients, data-dense layouts.

---

## 2. Personas

### 2.1 Central Administrator
- Full access to all features
- Creates and manages user accounts (email/password)
- Manages the master node registry (create, edit, archive nodes)
- Approves new node proposals from user uploads
- Accesses mining area history via **two paths**:
  1. Upload directory — browse all uploads chronologically
  2. Map view — click polygon → open node directory in side panel
- Can soft-delete uploads (logged in audit trail)
- Receives email notifications on new uploads
- Exports PDF reports for external stakeholders

### 2.2 Field User
- Uploads KML files with metadata
- Views upload history for all nodes (flat permissions — no node-level restrictions)
- Cannot delete or modify past uploads (immutable archive)
- Can propose new nodes via KML uploads (pending admin approval)

---

## 3. Wireframes

### 3.1 Login

![MineArchive Login — minimal flat dark login card](/Users/rakeshkumar/.gemini/antigravity/brain/9ee90c35-93f4-450b-8a5a-28a7693ff0a5/minimal_login_1781854380950.png)

- Centered card, flat surface, no decorative elements
- Email + password fields, "Sign In" button
- "Contact administrator for access" — no self-registration

---

### 3.2 Admin Dashboard

![MineArchive Dashboard — stats strip, map overview, recent activity feed](/Users/rakeshkumar/.gemini/antigravity/brain/9ee90c35-93f4-450b-8a5a-28a7693ff0a5/minimal_dashboard_1781854296256.png)

- **Stats strip**: Nodes, Uploads, Pending Approvals, Active Users
- **Left (60%)**: Map overview of all mining nodes (Ropar area) with polygon outlines
- **Right (40%)**: Recent activity feed — compact rows showing date, node, action, user

---

### 3.3 Map View with Side Panel (Core Interaction)

![MineArchive Map View — Ropar area with selected polygon and upload timeline side panel](/Users/rakeshkumar/.gemini/antigravity/brain/9ee90c35-93f4-450b-8a5a-28a7693ff0a5/minimal_map_sidepanel_1781854329918.png)

- **Map (65%)**: Shows mining area polygons around Ropar — Ropar North Quarry, Sutlej River Pit, Nangal Road Site, Kiratpur Quarry
- **Selected polygon** highlighted in blue `#007acc`, others in grey
- **Side panel (35%)**: Slides in on polygon click
  - Node name header with status tag
  - Timeline | Table tab toggle
  - Upload entries with "Show on map" checkboxes — checking two entries overlays both polygons for comparison
  - **Change Metrics** box at bottom: Area change (±hectares, ±%), Perimeter change

---

### 3.4 KML Upload Page

![MineArchive Upload — drop zone, metadata form, detected areas table](/Users/rakeshkumar/.gemini/antigravity/brain/9ee90c35-93f4-450b-8a5a-28a7693ff0a5/minimal_upload_page_1781854357274.png)

- Single-column centered form
- Drag-and-drop KML zone
- Metadata fields: Survey Date, Category dropdown, Notes textarea
- Supporting Documents drop zone (PDFs, images)
- **Detected Areas table**: parsed polygons matched to existing nodes or flagged as new

---

### 3.5 Audit Log

![MineArchive Audit Log — filterable table with export options](/Users/rakeshkumar/.gemini/antigravity/brain/9ee90c35-93f4-450b-8a5a-28a7693ff0a5/minimal_audit_log_1781854411451.png)

- Filter bar: Date range, User, Action type, Node, Search
- Data table: Timestamp, User, Action, Node, Details
- Export buttons: PDF, CSV
- Simple pagination

---

## 4. Information Architecture

```
MineArchive
├── Login
├── Dashboard (Admin)
│   ├── Stats Strip
│   ├── Map Overview
│   └── Recent Activity Feed
├── Map View
│   ├── Interactive Map (Leaflet.js)
│   ├── Polygon Click → Side Panel
│   │   ├── Timeline View
│   │   ├── Table View
│   │   └── Change Metrics
│   └── Polygon Overlay Comparison
├── Upload KML
│   ├── File Drop Zone
│   ├── Metadata Form
│   ├── KML Preview Map
│   ├── Detected Areas Matcher
│   └── Supporting Documents
├── Node Management (Admin)
│   ├── Create / Edit / Archive Nodes
│   └── Approve Proposed Nodes
├── User Management (Admin)
│   ├── Create User (email/password)
│   ├── Edit / Disable Users
│   └── Reset Password
├── Audit Log
│   ├── Filterable Table
│   └── PDF / CSV Export
└── Reports
    └── Per-Node PDF Export
```

---

## 5. Data Model

### 5.1 Core Entities

| Entity | Key Fields |
|--------|-----------|
| **User** | id, name, email, password_hash, role (admin/user), status (active/disabled), created_at, last_login |
| **Node** | id, name, description, status (active/proposed/archived), location_label, created_by, approved_by, created_at |
| **Upload** | id, node_id, uploaded_by, upload_date, survey_date, category, notes, kml_file_path, is_deleted (soft), deleted_by, deleted_at |
| **UploadGeometry** | id, upload_id, geometry (PostGIS POLYGON/MULTIPOLYGON), area_hectares, perimeter_meters, centroid |
| **UploadAttachment** | id, upload_id, file_path, file_type, file_size, original_name |
| **AuditLog** | id, user_id, action, target_type, target_id, details, ip_address, timestamp |
| **ChangeMetric** | id, node_id, upload_old_id, upload_new_id, area_change_ha, area_change_pct, perimeter_change_m, centroid_shift_m, computed_at |

### 5.2 Geospatial Considerations

- **PostGIS** extension on PostgreSQL for all spatial operations
- Geometries stored in **EPSG:4326** (WGS 84) for KML compatibility
- Area/perimeter calculations use **ST_Area** and **ST_Perimeter** with geography cast
- Boundary diff uses **ST_Difference** and **ST_Intersection** for overlay computation
- Spatial index (GiST) on `UploadGeometry.geometry` for map queries

---

## 6. Feature Specifications

### 6.1 KML Upload & Parsing

| Aspect | Specification |
|--------|--------------|
| Accepted formats | `.kml`, `.kmz` (auto-extracted) |
| Multi-polygon | Single KML can contain multiple `<Placemark>` elements with polygons |
| Auto-matching | Parsed polygons matched to existing nodes by name and spatial overlap (ST_Intersects) |
| New proposals | Unmatched polygons flagged as "proposed" — pending admin approval |
| Metadata | Upload date (auto), survey date (manual), category (dropdown), notes (free text) |
| Attachments | PDFs, images uploaded alongside KML |
| Immutability | Users cannot delete/modify uploads; admin can soft-delete with audit log entry |

### 6.2 Map View & Polygon Interaction

| Aspect | Specification |
|--------|--------------|
| Map SDK | Leaflet.js (via react-leaflet) |
| Base layer | OpenStreetMap or similar open-source satellite layer |
| Polygon display | Latest upload geometry per node; click to open side panel |
| Overlay comparison | Check two timeline entries → both polygons render on map with distinct colors |
| Change metrics | Auto-computed on upload: area change (ha, %), perimeter change (m), centroid shift |
| Side panel | Slides in from right (35% width), map remains interactive on left (65%) |

### 6.3 Directory Views

| View | Details |
|------|---------|
| **Timeline** (default) | Chronological newest-first, compact rows: upload #, date, category, uploader, "Show on map" toggle |
| **Table** | Sortable columns: date, uploader, area, category, status. Supports search/filter |
| **Switch** | Tab toggle between Timeline and Table within the side panel |

### 6.4 Node Management (Admin)

- Admin maintains master node registry
- Create node: name, description, initial geometry (optional)
- Edit/archive nodes
- Approve proposed nodes from user uploads
- Approval workflow: proposed → approved (becomes active node)

### 6.5 User Management (Admin)

- Admin creates user accounts: name, email, temporary password, role
- Edit user details, disable/re-enable accounts
- Reset password
- No self-registration — "Contact administrator for access"

### 6.6 Audit Log

- Every action logged: uploads, deletions, approvals, logins, node changes
- Filterable by: date range, user, action type, node
- Exportable as PDF and CSV
- Immutable — audit entries cannot be deleted

### 6.7 Notifications

- Email sent to admin on new KML upload
- Email content: uploader name, node, category, timestamp, link to review

### 6.8 PDF Reports

- Per-node history export as PDF
- Includes: node name, all uploads in chronological order, metadata, change metrics
- Map snapshot of latest boundary embedded in PDF

---

## 7. Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js (React) — SSR for dashboard, CSR for map interactions |
| **Styling** | Vanilla CSS — matching GeoFlow design system (dark theme, sharp corners, `#007acc` accent) |
| **Map** | Leaflet.js (react-leaflet) |
| **Backend** | Next.js API Routes + Node.js |
| **Database** | PostgreSQL with PostGIS extension (running locally via Docker) |
| **File Storage** | Local filesystem (temporary) / Cloud object storage (future) |
| **Auth** | JWT-based, email/password, bcrypt password hashing |
| **Email** | Transactional email service (SendGrid/SES) for upload notifications |
| **PDF Generation** | Puppeteer or jsPDF for report export |
| **Deployment** | Local Docker environment (temporary) / Cloud-hosted (future) |
| **CI/CD** | GitHub Actions → container registry → cloud deploy |

---

## 8. Design System (GeoFlow-Inherited)

```css
:root {
  --bg: #1e1e1e;
  --surface: #252526;
  --surface2: #2d2d30;
  --border: #3e3e42;
  --accent: #007acc;
  --accent2: #4fc1ff;
  --green: #22c55e;
  --red: #ef4444;
  --yellow: #f59e0b;
  --text: #e2e8f0;
  --muted: #64748b;
  --radius: 0px;           /* Sharp corners everywhere */
  --font: 'Segoe UI', system-ui, sans-serif;
}
```

> [!TIP]
> **Design principles**: No rounded corners. No gradients. No glassmorphism. Flat surfaces. Thin borders. Data-dense layouts. Monospace feel for data fields. Blue accent for interactive elements only.

---

## 9. API Architecture (REST)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | Email/password login → JWT |
| `/api/auth/logout` | POST | Invalidate session |
| `/api/users` | GET/POST | List/create users (admin) |
| `/api/users/:id` | PATCH/DELETE | Edit/disable user (admin) |
| `/api/nodes` | GET/POST | List/create nodes |
| `/api/nodes/:id` | GET/PATCH | Get/edit node details |
| `/api/nodes/:id/approve` | POST | Approve proposed node (admin) |
| `/api/nodes/:id/uploads` | GET | List uploads for a node |
| `/api/uploads` | POST | Upload KML + metadata |
| `/api/uploads/:id` | GET/DELETE | Get upload / soft-delete (admin) |
| `/api/uploads/:id/geometry` | GET | Get parsed geometry (GeoJSON) |
| `/api/uploads/compare` | POST | Compare two uploads → change metrics |
| `/api/map/layers` | GET | All latest node geometries for map rendering |
| `/api/audit` | GET | Audit log with filters |
| `/api/reports/node/:id` | GET | Generate PDF report for node |

---

## 10. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| **Response time** | < 500ms for API calls, < 2s for map initial load |
| **Upload size** | Up to 50MB per KML file, 10MB per attachment |
| **Concurrent users** | Support 50+ concurrent users |
| **Data retention** | All uploads retained indefinitely (soft-delete only) |
| **Browser support** | Chrome 90+, Firefox 90+, Edge 90+, Safari 15+ |
| **Mobile responsive** | Functional on tablet (1024px+), limited on phone (future mobile app) |
| **Security** | HTTPS, JWT auth, bcrypt passwords, RBAC, SQL injection prevention via ORM |
| **Backup** | Daily automated PostgreSQL backups, point-in-time recovery |

---

## 11. Ropar Example Data

The wireframes use the **Ropar (Rupnagar), Punjab** mining district as the example location, with these sample nodes:

| Node Name | Type | Status |
|-----------|------|--------|
| Ropar North Quarry | Stone/aggregate quarry | Active |
| Sutlej River Pit | Riverbed mining | Active |
| Nangal Road Site | Road construction aggregate | Active |
| Kiratpur Quarry | Stone quarry | Active |

---

## 12. Phased Delivery

### Phase 1 — Core MVP (8-10 weeks)
- [x] Auth (login, admin user management)
- [x] Node management (CRUD, master registry)
- [x] KML upload with metadata
- [x] KML parsing (multi-polygon extraction, node matching)
- [x] Map view with polygon display (Leaflet.js)
- [x] Side panel directory (timeline + table)
- [x] Audit log

### Phase 2 — Intelligence (4-6 weeks)
- [ ] Automated change metrics (area diff, perimeter diff)
- [ ] Visual polygon overlay comparison
- [ ] Email notifications on upload

### Phase 3 — Reporting & Scale (4 weeks)
- [ ] PDF report generation per node
- [ ] Node approval workflow (proposed → approved)
- [ ] Dashboard stats and activity feed
- [ ] Performance optimization for 100+ nodes

### Phase 4 — Future (planned)
- [ ] Mobile companion app
- [ ] Satellite imagery change detection
- [ ] Role-based node permissions
- [ ] API for third-party integrations
