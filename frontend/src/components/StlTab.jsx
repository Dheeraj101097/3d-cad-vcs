import { useState, useEffect, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getStlVersions, uploadStl, deleteStl, downloadVersion } from '../api';
import VersionList from './VersionList';
import { usePermission } from '../context/AuthContext';

const StlViewer = lazy(() => import('./StlViewer'));

const fmt = (b) => !b ? '—' : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;
const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

function NoteBox({ note }) {
  return (
    <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--surface2)', borderRadius: 8, fontSize: 13, color: 'var(--text-muted)', borderLeft: '3px solid var(--gold)' }}>
      <span style={{ fontWeight: 600, color: 'var(--gold)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Version Notes</span>
      <p style={{ marginTop: 4 }}>{note}</p>
    </div>
  );
}

export default function StlTab({ partId, partName }) {
  const qc = useQueryClient();
  const { canWrite, canDelete } = usePermission();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlVersionId = searchParams.get('sv');

  const [showUpload, setShowUpload] = useState(false);
  const [stlFile, setStlFile] = useState(null);
  const [stlNotes, setStlNotes] = useState('');
  const [stlPartName, setStlPartName] = useState('');

  useEffect(() => {
    if (partName) setStlPartName(n => n || partName);
  }, [partName]);

  const { data: stlVersions = [], isLoading: versionsLoading } = useQuery({
    queryKey: ['stl', partId],
    queryFn: () => getStlVersions(partId),
  });

  // Derive selected: URL param → fallback first version → null
  const selectedVersion = stlVersions.find(v => v._id === urlVersionId) ?? stlVersions[0] ?? null;

  const selectVersion = (v) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('sv', v._id);
      return next;
    }, { replace: true });
  };

  const openUpload = () => {
    setStlFile(null);
    setStlNotes('');
    setStlPartName(partName || '');
    setShowUpload(true);
  };

  const uploadMutation = useMutation({
    mutationFn: ({ partId: pid, fd }) => uploadStl(pid, fd),
    onSuccess: (newVersion) => {
      qc.invalidateQueries({ queryKey: ['stl', partId] });
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.set('sv', newVersion._id);
        return next;
      }, { replace: true });
      setShowUpload(false);
    },
    onError: (err) => alert(err.response?.data?.message || 'Upload failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteStl,
    onSuccess: (_, deletedId) => {
      qc.invalidateQueries({ queryKey: ['stl', partId] });
      if (selectedVersion?._id === deletedId) {
        setSearchParams(prev => {
          const next = new URLSearchParams(prev);
          next.delete('sv');
          return next;
        }, { replace: true });
      }
    },
    onError: () => alert('Delete failed'),
  });

  const handleUpload = (e) => {
    e.preventDefault();
    if (!stlFile) return;
    const nextVersion = `v${stlVersions.length + 1}.0`;
    const safeName = stlPartName.trim().replace(/\s+/g, '_');
    const formattedName = `${safeName}_${nextVersion}.stl`;
    const renamedFile = new File([stlFile], formattedName, { type: stlFile.type });
    const fd = new FormData();
    fd.append('file', renamedFile);
    fd.append('notes', stlNotes);
    uploadMutation.mutate({ partId, fd });
  };

  const handleDelete = (id) => {
    if (!confirm('Delete this STL version?')) return;
    deleteMutation.mutate(id);
  };

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20, alignItems: 'start' }}>
        <VersionList
          title="STL Versions"
          versions={stlVersions}
          isLoading={versionsLoading}
          selectedId={selectedVersion?._id}
          onSelect={selectVersion}
          onDelete={canDelete ? handleDelete : undefined}
          onDownload={(v) => downloadVersion(v, 'stl').catch(() => alert('Download failed'))}
          onUpload={canWrite ? openUpload : undefined}
          fmt={fmt}
          fmtDate={fmtDate}
        />

        <div>
          {selectedVersion ? (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: 15 }}>{selectedVersion.originalName}</span>
                  <span className="badge badge-gold">{selectedVersion.version}</span>
                </div>
                <button
                  className="btn-ghost btn-sm"
                  onClick={() => downloadVersion(selectedVersion, 'stl').catch(() => alert('Download failed'))}
                >
                  ↓ Download
                </button>
              </div>
              <Suspense fallback={<div style={{ height: 400, background: '#111318', borderRadius: 8 }} />}>
                <StlViewer versionId={selectedVersion._id} />
              </Suspense>
              {selectedVersion.notes && <NoteBox note={selectedVersion.notes} />}
            </div>
          ) : (
            <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
              <div className="empty-state">
                <div className="empty-state-icon">🖥</div>
                <p>Select an STL version to preview</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div className="modal-overlay" onClick={() => setShowUpload(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Upload STL Version</h2>
            <form onSubmit={handleUpload}>
              <div className="form-group">
                <label>Part Name</label>
                <input value={stlPartName} onChange={e => setStlPartName(e.target.value)} required placeholder="e.g. Phone Stand Base" />
              </div>
              <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12 }}>
                <div style={{ color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10, fontWeight: 700 }}>File will be saved as</div>
                <div style={{ fontFamily: 'monospace', color: 'var(--gold)', fontWeight: 600 }}>
                  {stlPartName.trim().replace(/\s+/g, '_') || 'PartName'}_v{stlVersions.length + 1}.0.stl
                </div>
              </div>
              <div className="form-group">
                <label>STL File</label>
                <input
                  type="file"
                  accept=".stl"
                  onChange={e => setStlFile(e.target.files[0])}
                  required
                  style={{ padding: '8px 0', background: 'transparent', border: 'none', boxShadow: 'none' }}
                />
              </div>
              <div className="form-group">
                <label>Version Notes</label>
                <textarea rows={2} value={stlNotes} onChange={e => setStlNotes(e.target.value)} placeholder="What changed in this version?" />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowUpload(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={uploadMutation.isPending}>
                  {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
