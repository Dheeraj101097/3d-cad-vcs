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
    <div className="mt-3.5 px-3.5 py-2.5 bg-white/[0.03] rounded-lg text-sm text-gray-400 border-l-[3px] border-gold/50">
      <span className="text-[10px] font-medium uppercase tracking-wider text-gold block mb-1">Version Notes</span>
      <p>{note}</p>
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
      <div className="grid grid-cols-[300px_1fr] gap-5 items-start">
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
            <div className="glass rounded-xl p-5">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-200">{selectedVersion.originalName}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gold/15 text-gold">
                    {selectedVersion.version}
                  </span>
                </div>
                <button
                  className="text-xs px-3 py-1.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-gray-400 hover:bg-white/[0.08] hover:text-gray-200 transition-all"
                  onClick={() => downloadVersion(selectedVersion, 'stl').catch(() => alert('Download failed'))}
                >
                  ↓ Download
                </button>
              </div>
              <Suspense fallback={<div className="h-[400px] bg-[#111318] rounded-lg" />}>
                <StlViewer versionId={selectedVersion._id} />
              </Suspense>
              {selectedVersion.notes && <NoteBox note={selectedVersion.notes} />}
            </div>
          ) : (
            <div className="glass rounded-xl flex items-center justify-center min-h-[300px]">
              <div className="text-center py-12 text-gray-500">
                <p className="text-sm">Select an STL version to preview</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowUpload(false)}>
          <div className="glass-strong rounded-2xl p-7 w-[460px] max-w-[95vw] shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-100 mb-5">Upload STL Version</h2>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">Part Name</label>
                <input value={stlPartName} onChange={e => setStlPartName(e.target.value)} required placeholder="e.g. Phone Stand Base" />
              </div>
              <div className="bg-white/[0.03] rounded-lg px-3.5 py-2.5 text-xs">
                <div className="text-[10px] font-medium uppercase tracking-wider text-gray-500 mb-1">File will be saved as</div>
                <div className="font-mono text-gold font-medium">
                  {stlPartName.trim().replace(/\s+/g, '_') || 'PartName'}_v{stlVersions.length + 1}.0.stl
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">STL File</label>
                <input
                  type="file"
                  accept=".stl"
                  onChange={e => setStlFile(e.target.files[0])}
                  required
                  className="!bg-transparent !border-none !shadow-none !p-0 !py-2 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-brand-500/50 file:text-gray-200 hover:file:bg-brand-500/70"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">Version Notes</label>
                <textarea rows={2} value={stlNotes} onChange={e => setStlNotes(e.target.value)} placeholder="What changed in this version?" />
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button type="button" className="px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-gray-400 hover:bg-white/[0.08] text-sm transition-all" onClick={() => setShowUpload(false)}>Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 text-gray-100 text-sm font-medium transition-all" disabled={uploadMutation.isPending}>
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
