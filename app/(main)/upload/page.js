'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '../../components/ToastProvider';
import './upload.css';

function previewPolygonsFromKmlText(text) {
  try {
    const doc = new DOMParser().parseFromString(text, 'text/xml');
    const placemarks = Array.from(doc.getElementsByTagName('Placemark'));
    return placemarks.map((pm, idx) => {
      const name =
        pm.getElementsByTagName('name')[0]?.textContent?.trim() || `Polygon ${idx + 1}`;
      const hasPolygon = pm.getElementsByTagName('Polygon').length > 0;
      return { polygon: name, status: hasPolygon ? 'Ready' : 'Skipped', node: '—' };
    });
  } catch {
    return [];
  }
}

export default function UploadPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [files, setFiles] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [nodeId, setNodeId] = useState('');
  const [surveyDate, setSurveyDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState('Routine Survey');
  const [notes, setNotes] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [detectedAreas, setDetectedAreas] = useState([]);

  useEffect(() => {
    fetch('/api/nodes', { credentials: 'same-origin' })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setNodes(data);
          setNodeId(data[0].id);
        } else {
          setNodes([]);
          setNodeId('');
        }
      })
      .catch(() => setNodes([]));
  }, []);

  const addFiles = async (fileList) => {
    const incoming = Array.from(fileList || []).filter((f) =>
      /\.(kml|kmz|xml)$/i.test(f.name)
    );
    if (incoming.length === 0) {
      showToast('Please choose .kml or .kmz files.', 'warning');
      return;
    }

    const next = [...files];
    for (const f of incoming) {
      if (!next.some((x) => x.name === f.name && x.size === f.size)) {
        next.push(f);
      }
    }
    setFiles(next);
    showToast(`Queued ${incoming.length} file(s). Total: ${next.length}`, 'info');

    // Client-side placemark preview for all queued files
    const previews = [];
    for (const f of next) {
      // KMZ is a binary ZIP — it can't be previewed as text; it is unzipped and
      // parsed on the server at upload time.
      if (/\.kmz$/i.test(f.name)) {
        previews.push({ polygon: f.name, status: 'KMZ · parsed on upload', node: nodes.find((n) => n.id === nodeId)?.name || '—' });
        continue;
      }
      try {
        const text = await f.text();
        const polys = previewPolygonsFromKmlText(text);
        if (polys.length === 0) {
          previews.push({ polygon: f.name, status: 'No polygons', node: '—' });
        } else {
          for (const p of polys) {
            previews.push({
              polygon: `${f.name} · ${p.polygon}`,
              status: p.status,
              node: nodes.find((n) => n.id === nodeId)?.name || '—',
            });
          }
        }
      } catch {
        previews.push({ polygon: f.name, status: 'Unreadable', node: '—' });
      }
    }
    setDetectedAreas(previews);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const handleFileChange = (e) => {
    addFiles(e.target.files);
    e.target.value = '';
  };

  const removeFile = (index) => {
    const next = files.filter((_, i) => i !== index);
    setFiles(next);
    if (next.length === 0) setDetectedAreas([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (files.length === 0) {
      showToast('Please select or drop one or more .kml files first.', 'warning');
      return;
    }
    if (!nodeId) {
      showToast('Choose a monitoring area (create one under Monitoring Areas if the list is empty).', 'warning');
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData();
    for (const f of files) formData.append('files', f);
    formData.append('nodeId', nodeId);
    formData.append('surveyDate', surveyDate);
    formData.append('category', category);
    formData.append('notes', notes);

    try {
      const res = await fetch('/api/uploads', {
        method: 'POST',
        body: formData,
        credentials: 'same-origin',
      });
      const data = await res.json().catch(() => ({}));
      setIsSubmitting(false);

      if (res.ok && data.uploaded > 0) {
        showToast(
          `Ingested ${data.uploaded} file(s), ${data.featuresDetected || 0} polygon(s).`,
          'success'
        );
        // Open the map focused on the node we just uploaded to, so the new
        // polygons are shown immediately (the map auto-selects this node).
        setTimeout(() => router.push(`/map?nodeId=${encodeURIComponent(nodeId)}`), 1000);
      } else {
        const firstError = data.results?.find((r) => !r.success)?.error;
        showToast(firstError || data.error || 'Upload failed', 'error');
      }
    } catch {
      setIsSubmitting(false);
      showToast('Unable to reach upload service.', 'error');
    }
  };

  return (
    <div className="upload-container">
      <div className="page-header">
        <div>
          <h1>Upload Boundary File</h1>
          <p className="page-subtitle">
            Add a KML or KMZ boundary file to a monitoring area. Each file is archived as a dated survey and shown on the map.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="card-body">
            <div
              className={`drop-zone${isDragging ? ' drag-over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById('kml-input').click()}
            >
              <input
                id="kml-input"
                type="file"
                accept=".kml,.kmz,.xml"
                multiple
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto' }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <path d="M17 8l-5-5-5 5M12 3v12" />
              </svg>
              <div className="drop-zone-label">
                {files.length > 0
                  ? `${files.length} file(s) ready — click to add more`
                  : 'Drop a KML or KMZ file here, or click to browse'}
              </div>
              <div className="drop-zone-hint">
                Accepts KML or KMZ boundary files · you can add more than one
              </div>
            </div>

            {files.length > 0 && (
              <ul className="upload-file-list">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="upload-file-item">
                    <span>
                      {f.name}{' '}
                      <span style={{ color: 'var(--muted)' }}>({(f.size / 1024).toFixed(1)} KB)</span>
                    </span>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => removeFile(i)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="upload-grid">
              <div className="form-group">
                <label className="required" htmlFor="upload-node">Monitoring area</label>
                <select
                  id="upload-node"
                  value={nodeId}
                  onChange={(e) => setNodeId(e.target.value)}
                  required
                >
                  {nodes.length === 0 ? (
                    <option value="">No assigned monitoring areas</option>
                  ) : (
                    nodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name}
                      </option>
                    ))
                  )}
                </select>
                <p className="help-text">
                  {nodes.length === 0
                    ? 'You can only upload to sites assigned to you. Ask an administrator to assign a monitoring area.'
                    : 'The mining boundary this file belongs to.'}
                </p>
              </div>
              <div className="form-group">
                <label htmlFor="upload-date">Survey date</label>
                <input
                  id="upload-date"
                  type="date"
                  value={surveyDate}
                  onChange={(e) => setSurveyDate(e.target.value)}
                />
                <p className="help-text">The date this survey was captured in the field.</p>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="upload-category">Survey type</label>
              <select
                id="upload-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="Routine Survey">Routine Survey (scheduled monitoring)</option>
                <option value="Encroachment Report">Encroachment Report (boundary breach)</option>
                <option value="Restoration Check">Restoration Check (post-mining audit)</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="upload-notes">Notes</label>
              <textarea
                id="upload-notes"
                rows="3"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any observations about this survey (optional)…"
              />
              <p className="help-text">Optional. Note anything unusual you spotted in this survey.</p>
            </div>
          </div>
        </div>

        <div className="card mt-16">
          <div className="card-header">Detected boundaries</div>
          <div className="card-body">
            {detectedAreas.length === 0 ? (
              <p className="help-text" style={{ marginTop: 0 }}>
                Add a KML or KMZ file above to preview the boundaries it contains.
              </p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Boundary</th>
                    <th>Status</th>
                    <th>Monitoring area</th>
                  </tr>
                </thead>
                <tbody>
                  {detectedAreas.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.polygon}</td>
                      <td style={{ color: item.status === 'Ready' ? 'var(--green)' : 'var(--yellow)' }}>
                        {item.status}
                      </td>
                      <td>{item.node}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="upload-actions">
          <button type="button" className="btn btn-outline" onClick={() => router.push('/map')}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting || !nodeId}>
            {isSubmitting
              ? `Uploading ${files.length} file(s)…`
              : `Upload ${files.length || ''} boundary file${files.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </form>
    </div>
  );
}
