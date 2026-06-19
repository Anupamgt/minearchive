'use client';

import { useState, useRef } from 'react';
import './upload.css';

export default function UploadPage() {
  const [kmlFile, setKmlFile] = useState(null);
  const [supportingFiles, setSupportingFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [showDetected, setShowDetected] = useState(false);
  const fileInputRef = useRef(null);
  const supportingInputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      setKmlFile(file);
      setShowDetected(true);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setKmlFile(file);
      setShowDetected(true);
    }
  };

  const handleSupportingFiles = (e) => {
    setSupportingFiles(Array.from(e.target.files));
  };

  return (
    <div className="upload-container">
      <div className="upload-title">Upload KML Data</div>

      {/* KML Drop Zone */}
      <div className="upload-section">
        <div
          className={`drop-zone${dragActive ? ' active' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="drop-zone-label">Drop .kml files here or click to browse</div>
          <div className="drop-zone-hint">Supports .kml and .kmz formats</div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".kml,.kmz"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        {kmlFile && (
          <div className="upload-file-info">
            <span className="tag tag-accent">KML</span>
            <span className="file-name">{kmlFile.name}</span>
            <button className="remove-btn" onClick={() => { setKmlFile(null); setShowDetected(false); }}>
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Metadata Fields */}
      <div className="upload-section upload-row">
        <div className="form-group">
          <label>Survey Date</label>
          <input type="date" />
        </div>
        <div className="form-group">
          <label>Category</label>
          <select>
            <option>Routine Survey</option>
            <option>Encroachment Report</option>
            <option>Restoration Check</option>
          </select>
        </div>
      </div>

      <div className="upload-section">
        <div className="form-group">
          <label>Notes</label>
          <textarea rows={3} placeholder="Add notes about this survey..."></textarea>
        </div>
      </div>

      {/* Supporting Documents */}
      <div className="upload-section">
        <label>Supporting Documents</label>
        <div
          className="drop-zone"
          style={{ padding: 20 }}
          onClick={() => supportingInputRef.current?.click()}
        >
          <div className="drop-zone-hint">Drop PDFs, images</div>
        </div>
        <input
          ref={supportingInputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg"
          onChange={handleSupportingFiles}
          style={{ display: 'none' }}
        />
        {supportingFiles.map((f, i) => (
          <div className="upload-file-info" key={i}>
            <span className="tag">{f.name.split('.').pop().toUpperCase()}</span>
            <span className="file-name">{f.name}</span>
          </div>
        ))}
      </div>

      {/* Detected Areas */}
      {showDetected && (
        <div className="detected-areas">
          <div className="detected-title">Detected Areas (2)</div>
          <table className="table">
            <thead>
              <tr>
                <th>Polygon</th>
                <th>Match to Node</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Ropar North Quarry</td>
                <td><span className="tag tag-green">✓ Matched</span></td>
                <td style={{ color: 'var(--muted)' }}>—</td>
              </tr>
              <tr>
                <td>Sutlej New Pit</td>
                <td><span className="tag tag-yellow">No match</span></td>
                <td>
                  <button className="btn btn-sm btn-outline">+ New</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Actions */}
      <div className="upload-actions">
        <button className="btn btn-outline">Cancel</button>
        <button className="btn btn-primary">Submit</button>
      </div>
    </div>
  );
}
