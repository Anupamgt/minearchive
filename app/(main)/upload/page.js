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
      showToast('Select a target mining node (create one under Nodes if the list is empty).', 'warning');
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
      <div className="upload-title">UPLOAD KML DATA & SPATIAL BOUNDARIES</div>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: -8, marginBottom: 20, maxWidth: 640 }}>
        Select multiple KML files to attach to one mining node. Each file becomes its own archive entry and can be toggled on the map.
      </p>

      <form onSubmit={handleSubmit} style={{ maxWidth: 640 }}>
        <div
          className={`drop-zone${isDragging ? ' drag-over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById('kml-input').click()}
          style={{
            cursor: 'pointer',
            textAlign: 'center',
            padding: 32,
            background: 'var(--surface)',
            border: `2px dashed ${isDragging ? 'var(--accent)' : 'var(--border)'}`,
            marginBottom: 12,
          }}
        >
          <input
            id="kml-input"
            type="file"
            accept=".kml,.kmz,.xml"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
            {files.length > 0
              ? `${files.length} file(s) queued — click to add more`
              : 'Drop .kml or .kmz files here or click to browse'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            Multi-select supported · Google Earth KML / KMZ polygons / MultiPolygons
          </div>
        </div>

        {files.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px', fontSize: 12 }}>
            {files.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '6px 0',
                  borderBottom: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
              >
                <span>
                  {f.name}{' '}
                  <span style={{ color: 'var(--muted)' }}>({(f.size / 1024).toFixed(1)} KB)</span>
                </span>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ padding: '2px 8px', fontSize: 10 }}
                  onClick={() => removeFile(i)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>
              Target Mining Enclosure (Node)
            </label>
            <select
              className="input"
              style={{
                width: '100%',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: '#fff',
                padding: 8,
              }}
              value={nodeId}
              onChange={(e) => setNodeId(e.target.value)}
              required
            >
              {nodes.length === 0 ? (
                <option value="">No nodes — create one first</option>
              ) : (
                nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))
              )}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>
              Survey Date
            </label>
            <input
              type="date"
              className="input"
              style={{
                width: '100%',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: '#fff',
                padding: 8,
              }}
              value={surveyDate}
              onChange={(e) => setSurveyDate(e.target.value)}
            />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>
            Upload Category
          </label>
          <select
            className="input"
            style={{
              width: '100%',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: '#fff',
              padding: 8,
            }}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="Routine Survey">Routine Survey (Scheduled Monitoring)</option>
            <option value="Encroachment Report">Encroachment Report (Boundary Breach)</option>
            <option value="Restoration Check">Restoration Check (Post-Mining Audit)</option>
          </select>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>
            Notes / Findings
          </label>
          <textarea
            className="input"
            rows="3"
            style={{
              width: '100%',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: '#fff',
              padding: 8,
              fontFamily: 'inherit',
            }}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Document any spatial deviations or contractor activity..."
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>
            DETECTED KML POLYGON BOUNDARIES
          </div>
          {detectedAreas.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Add KML files to preview placemarks.</div>
          ) : (
            <table className="table" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th>Polygon Feature</th>
                  <th>Status</th>
                  <th>Target Node</th>
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

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button type="button" className="btn btn-outline" onClick={() => router.push('/map')}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting || !nodeId}>
            {isSubmitting
              ? `Ingesting ${files.length} KML...`
              : `Submit ${files.length || ''} Upload${files.length === 1 ? '' : 's'} & Parse`}
          </button>
        </div>
      </form>
    </div>
  );
}
