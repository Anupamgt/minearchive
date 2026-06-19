'use client';

import './dashboard.css';

const NODES = [
  { name: 'Ropar North Quarry', status: 'Active', uploads: 5 },
  { name: 'Sutlej River Pit', status: 'Active', uploads: 3 },
  { name: 'Nangal Road Site', status: 'Active', uploads: 4 },
  { name: 'Kiratpur Quarry', status: 'Active', uploads: 2 },
];

const ACTIVITY = [
  { date: 'Jun 15', node: 'Ropar North Quarry', action: 'KML uploaded', user: 'Harpreet Singh' },
  { date: 'Jun 14', node: 'Sutlej River Pit', action: 'Encroachment report', user: 'Amit Sharma' },
  { date: 'Jun 13', node: 'Nangal Road Site', action: 'Routine survey', user: 'Harpreet Singh' },
  { date: 'Jun 12', node: 'Kiratpur Quarry', action: 'Restoration check', user: 'Priya Kaur' },
  { date: 'Jun 10', node: 'Ropar North Quarry', action: 'Boundary update', user: 'Amit Sharma' },
  { date: 'Jun 09', node: 'Sutlej River Pit', action: 'KML uploaded', user: 'Harpreet Singh' },
  { date: 'Jun 08', node: 'Nangal Road Site', action: 'Area change detected', user: 'System' },
  { date: 'Jun 07', node: 'Ropar North Quarry', action: 'Routine survey', user: 'Priya Kaur' },
];

export default function DashboardPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Stats Strip */}
      <div className="dashboard-stats">
        <div className="stat-item">
          <div className="stat-value">12</div>
          <div className="stat-label">Nodes</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">47</div>
          <div className="stat-label">Uploads</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">3</div>
          <div className="stat-label">Pending</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">5</div>
          <div className="stat-label">Users</div>
        </div>
      </div>

      {/* Body: Map + Activity */}
      <div className="dashboard-body">
        {/* Map Placeholder */}
        <div className="dashboard-map">
          <div className="dashboard-map-header">Map Overview — Ropar District</div>
          <div className="dashboard-map-body">
            <div style={{ color: 'var(--muted)', marginBottom: 8 }}>
              Interactive map will render here
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              ArcGIS / Leaflet integration pending
            </div>

            <div className="node-list">
              {NODES.map((node) => (
                <div className="node-item" key={node.name}>
                  <span className="node-name">{node.name}</span>
                  <span className="node-status">
                    <span className="tag tag-green">{node.status}</span>
                    <span style={{ marginLeft: 8, color: 'var(--muted)', fontSize: 11 }}>
                      {node.uploads} uploads
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="dashboard-activity">
          <div className="activity-header">Recent Activity</div>
          <div className="activity-list">
            {ACTIVITY.map((item, i) => (
              <div className="activity-item" key={i}>
                <span className="activity-date">{item.date}</span>
                <span className="activity-node">{item.node}</span>
                {' — '}
                <span className="activity-action">{item.action}</span>
                {' by '}
                <span className="activity-user">{item.user}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
