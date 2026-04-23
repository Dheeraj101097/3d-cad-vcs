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
    <div className="mt-3.5 px-3.5 py-2.5 bg-white/[0.03] rounded-lg text-sm text-gray-400 border-l-[3px] border-gold/50">
      <span className="text-[10px] font-medium uppercase tracking-wider text-gold block mb-1">Version Notes</span>
      <p>{note}</p>
    </div>
  );
}

export default function GCodeTab({ partId, partName }) {
  const qc = useQueryClient();
  const { canWrite, canDelete } = usePermission('products');
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
      <div className="grid grid-cols-[300px_1fr] gap-5 items-start">
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
                  onClick={() => downloadVersion(selectedVersion, 'gcode').catch(() => alert('Download failed'))}
                >
                  ↓ Download
                </button>
              </div>

              {loadingContent
                ? <div className="h-[520px] bg-[#111318] rounded-lg flex items-center justify-center text-gray-500 text-sm">Loading preview...</div>
                : <Suspense fallback={<div className="h-[520px] bg-[#111318] rounded-lg" />}>
                    <GCodeRenderer content={gcodeContent} />
                  </Suspense>
              }
              <Suspense fallback={null}>
                <GCodeInfo content={gcodeContent} />
              </Suspense>
              {selectedVersion.notes && <NoteBox note={selectedVersion.notes} />}
            </div>
          ) : (
            <div className="glass rounded-xl flex items-center justify-center min-h-[300px]">
              <div className="text-center py-12 text-gray-500">
                <p className="text-sm">Select a version to preview</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowUpload(false)}>
          <div className="glass-strong rounded-2xl p-7 w-[460px] max-w-[95vw] shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-100 mb-5">Upload G-Code / 3MF Version</h2>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">Part Name</label>
                <input value={gcodePartName} onChange={e => setGcodePartName(e.target.value)} required placeholder="e.g. Phone Stand Base" />
              </div>
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">No. of Units in Sliced File</label>
                <input type="number" min="1" value={gcodeUnits} onChange={e => setGcodeUnits(e.target.value)} required />
              </div>
              <div className="bg-white/[0.03] rounded-lg px-3.5 py-2.5 text-xs">
                <div className="text-[10px] font-medium uppercase tracking-wider text-gray-500 mb-1">File will be saved as</div>
                <div className="font-mono text-gold font-medium">
                  {gcodePartName.trim().replace(/\s+/g, '_') || 'PartName'}_{gcodeUnits}units_v{versions.length + 1}.0
                  {file ? file.name.match(/\.[^.]+$/)?.[0] : '.3mf'}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">File (.gcode, .3mf, .nc, .mf)</label>
                <input
                  type="file"
                  accept=".gcode,.gc,.mf,.3mf,.nc,.tap,.txt"
                  onChange={e => setFile(e.target.files[0])}
                  required
                  className="!bg-transparent !border-none !shadow-none !p-0 !py-2 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-brand-500/50 file:text-gray-200 hover:file:bg-brand-500/70"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">Version Notes</label>
                <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="What changed in this version?" />
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
