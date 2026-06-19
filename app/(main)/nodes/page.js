'use client';

import { useState } from 'react';
import './nodes.css';

const NODES_DATA = [
  { name: 'Ropar North Quarry', status: 'Active', uploads: 5, lastUpdated: 'Jun 15, 2026' },
  { name: 'Sutlej River Pit', status: 'Active', uploads: 3, lastUpdated: 'Jun 14, 2026' },
  { name: 'Nangal Road Site', status: 'Active', uploads: 4, lastUpdated: 'Jun 13, 2026' },
  { name: 'Kiratpur Quarry', status: 'Active', uploads: 2, lastUpdated: 'Jun 12, 2026' },
  { name: 'Sutlej New Pit', status: 'Proposed', uploads: 0, lastUpdated: 'Jun 11, 2026' },
];

export default function NodesPage() {
  const [showModal, setShowModal] = useState(false);

  return (
    <div>
      <div className="page-header">
        <div className="nodes-title">Node Management</div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
          + Create Node
        </button>
      </div>

      <div className="nodes-table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Uploads</th>
              <th>Last Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {NODES_DATA.map((node, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 500 }}>{node.name}</td>
                <td>
                  <span className={`tag ${
                    node.status === 'Active' ? 'tag-green' :
                    node.status === 'Proposed' ? 'tag-yellow' :
                    ''
                  }`}>
                    {node.status}
                  </span>
                </td>
                <td>{node.uploads}</td>
                <td style={{ color: 'var(--muted)', fontSize: 12 }}>{node.lastUpdated}</td>
                <td>
                  {node.status === 'Proposed' ? (
                    <>
                      <button className="approve-btn">Approve</button>
                      <button className="reject-btn">Reject</button>
                    </>
                  ) : (
                    <>
                      <button className="action-link">Edit</button>
                      <button className="action-link" style={{ color: 'var(--yellow)' }}>Archive</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Node Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Node</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Node Name</label>
                <input type="text" placeholder="e.g. Ropar East Quarry" />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea rows={3} placeholder="Description of the mining area..."></textarea>
              </div>
              <div className="form-group">
                <label>Location Label</label>
                <input type="text" placeholder="e.g. Ropar, Punjab" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => setShowModal(false)}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
