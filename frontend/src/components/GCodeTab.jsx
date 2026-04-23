import { useState, useEffect, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getGcodes, getGcodeContent, uploadGcode, deleteGcode, downloadVersion } from '../api';
import VersionList from './VersionList';
import { usePermission } from '../context/AuthContext';

const GCodeRenderer = lazy(() => import('./GCodeRenderer'));
const GCodeInfo = lazy(() => import('./GCodeInfo'));

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

export default function GCodeTab({ partId, partName }) {
  const qc = useQueryClient();
  const { canWrite, canDelete } = usePermission();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlVersionId = searchParams.get('gv');

  const [showUpload, setShowUpload] = useState(false);
  const [file, setFile] = useState(null);
  const [notes, setNotes] = useState('');
  const [gcodePartName, setGcodePartName] = useState('');
  const [gcodeUnits, setGcodeUnits] = useState(1);

  // Sync form name with partName once available
  useEffect(() => {
    if (partName) setGcodePartName(n => n || partName);
  }, [partName]);

  const { data: versions = [], isLoading: versionsLoading } = useQuery({
    queryKey: ['gcodes', partId],
    queryFn: () => getGcodes(partId),
  });

  // Derive selected: URL param → fallback first version → null
  const selectedVersion = versions.find(v => v._id === urlVersionId) ?? versions[0] ?? null;

  const { data: gcodeContent = '', isFetching: loadingContent } = useQuery({
    queryKey: ['gcode-content', selectedVersion?._id],
    queryFn: () => getGcodeContent(selectedVersion._id),
    enabled: !!selectedVersion,
    staleTime: Infinity,  // file content is immutable
    gcTime: 30 * 60_000,
  });

  const selectVersion = (v) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('gv', v._id);
      return next;
    }, { replace: true });
  };

  const openUpload = () => {
    setFile(null);
    setNotes('');
    setGcodeUnits(1);
    setGcodePartName(partName || '');
    setShowUpload(true);
  };

  const uploadMutation = useMutation({
    mutationFn: ({ partId: pid, fd }) => uploadGcode(pid, fd),
    onSuccess: (newVersion) => {
      qc.invalidateQueries({ queryKey: ['gcodes', partId] });
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.set('gv', newVersion._id);
        return next;
      }, { replace: true });
      setShowUpload(false);
    },
    onError: (err) => alert(err.response?.data?.message || 'Upload failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteGcode,
    onSuccess: (_, deletedId) => {
      qc.invalidateQueries({ queryKey: ['gcodes', partId] });
      if (selectedVersion?._id === deletedId) {
        setSearchParams(prev => {
          const next = new URLSearchParams(prev);
          next.delete('gv');
          return next;
        }, { replace: true });
      }
    },
    onError: () => alert('Delete failed'),
  });

  const handleUpload = (e) => {
    e.preventDefault();
    if (!file) return;
    const nextVersion = `v${versions.length + 1}.0`;
    const safeName = gcodePartName.trim().replace(/\s+/g, '_');
    const ext = file.name.match(/\.[^.]+$/)?.[0] || '';
    const formattedName = `${safeName}_${gcodeUnits}units_${nextVersion}${ext}`;
    const renamedFile = new File([file], formattedName, { type: file.type });
    const fd = new FormData();
    fd.append('file', renamedFile);
    fd.append('notes', notes);
    fd.append('displayName', formattedName);
    uploadMutation.mutate({ partId, fd });
  };

  const handleDelete = (id) => {
    if (!confirm('Delete this version?')) return;
    deleteMutation.mutate(id);
  };

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20, alignItems: 'start' }}>
        <VersionList
          title="G-Code Versions"
          versions={versions}
          isLoading={versionsLoading}
          selectedId={selectedVersion?._id}
          onSelect={selectVersion}
          onDelete={canDelete ? handleDelete : undefined}
          onDownload={(v) => downloadVersion(v, 'gcode').catch(() => alert('Download failed'))}
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
                  onClick={() => downloadVersion(selectedVersion, 'gcode').catch(() => alert('Download failed'))}
                >
                  ↓ Download
                </button>
              </div>

              {loadingContent
                ? <div style={{ height: 520, background: '#111318', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Loading preview...</div>
                : <Suspense fallback={<div style={{ height: 520, background: '#111318', borderRadius: 8 }} />}>
                    <GCodeRenderer content={gcodeContent} />
                  </Suspense>
              }
              <Suspense fallback={null}>
                <GCodeInfo content={gcodeContent} />
              </Suspense>
              {selectedVersion.notes && <NoteBox note={selectedVersion.notes} />}
            </div>
          ) : (
            <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
              <div className="empty-state">
                <div className="empty-state-icon">🖥</div>
                <p>Select a version to preview</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div className="modal-overlay" onClick={() => setShowUpload(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Upload G-Code / 3MF Version</h2>
            <form onSubmit={handleUpload}>
              <div className="form-group">
                <label>Part Name</label>
                <input value={gcodePartName} onChange={e => setGcodePartName(e.target.value)} required placeholder="e.g. Phone Stand Base" />
              </div>
              <div className="form-group">
                <label>No. of Units in Sliced File</label>
                <input type="number" min="1" value={gcodeUnits} onChange={e => setGcodeUnits(e.target.value)} required />
              </div>
              <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12 }}>
                <div style={{ color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10, fontWeight: 700 }}>File will be saved as</div>
                <div style={{ fontFamily: 'monospace', color: 'var(--gold)', fontWeight: 600 }}>
                  {gcodePartName.trim().replace(/\s+/g, '_') || 'PartName'}_{gcodeUnits}units_v{versions.length + 1}.0
                  {file ? file.name.match(/\.[^.]+$/)?.[0] : '.3mf'}
                </div>
              </div>
              <div className="form-group">
                <label>File (.gcode, .3mf, .nc, .mf)</label>
                <input
                  type="file"
                  accept=".gcode,.gc,.mf,.3mf,.nc,.tap,.txt"
                  onChange={e => setFile(e.target.files[0])}
                  required
                  style={{ padding: '8px 0', background: 'transparent', border: 'none', boxShadow: 'none' }}
                />
              </div>
              <div className="form-group">
                <label>Version Notes</label>
                <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="What changed in this version?" />
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
