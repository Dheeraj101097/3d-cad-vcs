import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import PageLoading from '../components/PageLoading';
import { usePermission } from '../context/AuthContext';
import {
  getPrinters, createPrinter, updatePrinter, deletePrinter,
  getPrinterStatus, getPrinterSdCard, deleteSdFile,
  getPrintOptions, uploadToPrinter, startPrint,
} from '../api';

const STATE_COLOR = {
  RUNNING: '#22c55e', PAUSE: '#f59e0b', FINISH: '#6366f1',
  FAILED: '#ef4444', IDLE: '#94a3b8', unknown: '#94a3b8',
};

function StatusDot({ state }) {
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
      background: STATE_COLOR[state] || STATE_COLOR.unknown, marginRight: 6,
    }} />
  );
}

function StepDot({ active, done, label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700,
        background: done ? 'var(--accent)' : active ? 'var(--gold)' : 'var(--surface2)',
        color: (done || active) ? '#fff' : 'var(--text-muted)',
        border: `2px solid ${done ? 'var(--accent)' : active ? 'var(--gold)' : 'var(--border)'}`,
      }}>
        {done ? '✓' : active ? '●' : '○'}
      </div>
      <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  );
}

function PrinterCard({ printer, onDelete, onPrint, onEdit }) {
  const [showSd, setShowSd] = useState(false);

  // Status fetched per-card (kept as local query with manual refetch)
  const { data: status, isFetching: loadingStatus, error: statusErr, refetch: refetchStatus } = useQuery({
    queryKey: ['printer-status', printer._id],
    queryFn: () => getPrinterStatus(printer._id),
    retry: false,
    staleTime: 30_000,
    gcTime: 60_000,
  });

  const { data: sdFiles = [], isFetching: sdLoading, error: sdErr, refetch: refetchSd } = useQuery({
    queryKey: ['printer-sd', printer._id],
    queryFn: () => getPrinterSdCard(printer._id).then(files =>
      files.filter(f => !f.isDirectory && /\.(3mf|gcode|gc)$/i.test(f.name))
    ),
    enabled: showSd,
    staleTime: 0,
    retry: false,
  });

  const deleteSdMutation = useMutation({
    mutationFn: deleteSdFile,
    onError: (err) => alert(err.response?.data?.message || 'Delete failed'),
  });

  const toggleSd = () => setShowSd(s => !s);

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>{printer.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{printer.model} · {printer.ip}</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {onEdit && <button className="btn-ghost btn-sm" onClick={() => onEdit(printer)}>✎ Edit IP</button>}
          {onDelete && <button className="btn-danger btn-sm" onClick={() => onDelete(printer._id)}>Delete</button>}
        </div>
      </div>

      {/* Status panel */}
      <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '12px 14px' }}>
        {loadingStatus && !status && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Connecting...</span>}
        {statusErr && !status && <span style={{ fontSize: 13, color: 'var(--danger)' }}>⚠ {statusErr.response?.data?.message || 'Unreachable'}</span>}
        {status && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                <StatusDot state={status.state} />{status.state}
              </span>
              <button className="btn-ghost btn-sm" onClick={() => refetchStatus()} disabled={loadingStatus}>
                {loadingStatus ? '⟳' : '↻ Refresh'}
              </button>
            </div>
            {status.state === 'RUNNING' && (
              <>
                <div style={{ background: 'var(--border)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${status.progress}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.3s' }} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 16 }}>
                  <span>{status.progress}% complete</span>
                  <span>~{status.remainingTime} min left</span>
                </div>
              </>
            )}
            <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <span>🌡 Nozzle: {status.nozzleTemp}°C</span>
              <span>🛏 Bed: {status.bedTemp}°C</span>
              {status.currentFile && <span>📄 {status.currentFile}</span>}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {onPrint && <button className="btn-primary btn-sm" onClick={() => onPrint(printer)}>🖨 Send File to Print</button>}
        <button className="btn-ghost btn-sm" onClick={toggleSd}>💾 {showSd ? 'Hide' : 'SD Card'}</button>
      </div>

      {/* SD Card browser */}
      {showSd && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>SD Card Files</span>
            <button className="btn-ghost btn-sm" onClick={() => refetchSd()} style={{ fontSize: 11 }}>↻ Refresh</button>
          </div>
          {sdLoading && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Reading SD card...</p>}
          {sdErr && <p style={{ fontSize: 13, color: 'var(--danger)' }}>⚠ {sdErr.response?.data?.message || 'Could not read SD card'}</p>}
          {!sdLoading && sdFiles.length === 0 && !sdErr && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No .3mf or .gcode files found</p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
            {sdFiles.map(f => (
              <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--surface2)', borderRadius: 6, fontSize: 12 }}>
                <span style={{ flex: 1, fontFamily: 'monospace', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{f.size ? `${(f.size / 1024 / 1024).toFixed(1)} MB` : ''}</span>
                <button
                  className="btn-danger btn-sm"
                  style={{ fontSize: 10, padding: '2px 7px', flexShrink: 0 }}
                  disabled={deleteSdMutation.isPending}
                  onClick={() => {
                    if (!confirm(`Delete "${f.name}" from printer SD card?`)) return;
                    deleteSdMutation.mutate({ printerId: printer._id, filename: f.name });
                  }}
                >✕</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Printers() {
  const qc = useQueryClient();
  const { canWrite, canDelete } = usePermission();
  const [showAdd, setShowAdd] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [editPrinter, setEditPrinter] = useState(null);
  const [selectedPrinter, setSelectedPrinter] = useState(null);
  const [form, setForm] = useState({ name: '', ip: '', serial: '', accessCode: '', model: 'X1C', agentToken: '' });
  const [printForm, setPrintForm] = useState({ versionId: '', useAms: false, bedLeveling: true, timelapse: false });
  const [printStep, setPrintStep] = useState('idle');
  const [printResult, setPrintResult] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');

  const { data: printers = [], isLoading: printersLoading } = useQuery({
    queryKey: ['printers'],
    queryFn: getPrinters,
  });

  // Single endpoint — replaces N+1 waterfall (was: 1 + N products + N×M parts calls)
  const { data: printOptions = [], isFetching: loadingOptions } = useQuery({
    queryKey: ['print-options'],
    queryFn: getPrintOptions,
    enabled: showPrint,
    staleTime: 30_000,
  });

  const addMutation = useMutation({
    mutationFn: createPrinter,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['printers'] });
      setForm({ name: '', ip: '', serial: '', accessCode: '', model: 'X1C', agentToken: '' });
      setShowAdd(false);
    },
    onError: (err) => alert(err.response?.data?.message || 'Failed to add printer'),
  });

  const deleteMutation = useMutation({
    mutationFn: deletePrinter,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['printers'] }),
    onError: () => alert('Delete failed'),
  });

  const editMutation = useMutation({
    mutationFn: updatePrinter,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['printers'] });
      setEditPrinter(null);
    },
    onError: (err) => alert(err.response?.data?.message || 'Save failed'),
  });

  const uploadMutation = useMutation({
    mutationFn: uploadToPrinter,
    onSuccess: (data) => {
      setUploadedFileName(data.remoteFileName);
      setPrintStep('uploaded');
      setPrintResult('✓ File sent to printer SD card');
    },
    onError: (err) => {
      setPrintStep('error');
      setPrintResult(`✗ ${err.response?.data?.message || 'Upload failed'}`);
    },
  });

  const startPrintMutation = useMutation({
    mutationFn: startPrint,
    onSuccess: () => {
      setPrintStep('done');
      setPrintResult('✓ Print started successfully');
    },
    onError: (err) => {
      setPrintStep('error');
      setPrintResult(`✗ ${err.response?.data?.message || 'Failed to start print'}`);
    },
  });

  const openPrint = (printer) => {
    setSelectedPrinter(printer);
    setPrintResult('');
    setPrintStep('idle');
    setUploadedFileName('');
    setPrintForm({ versionId: '', useAms: false, bedLeveling: true, timelapse: false });
    setShowPrint(true);
  };

  const sendFile = (e) => {
    e.preventDefault();
    if (!printForm.versionId) return;
    setPrintStep('uploading');
    setPrintResult('');
    uploadMutation.mutate({ printerId: selectedPrinter._id, versionId: printForm.versionId });
  };

  const handleStartPrint = () => {
    setPrintStep('starting');
    startPrintMutation.mutate({
      printerId: selectedPrinter._id,
      remoteFileName: uploadedFileName,
      versionId: printForm.versionId,
      useAms: printForm.useAms,
      bedLeveling: printForm.bedLeveling,
      timelapse: printForm.timelapse,
    });
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Printers</h1>
          <p className="page-subtitle">{printers.length} printer{printers.length !== 1 ? 's' : ''} configured</p>
        </div>
        {canWrite && <button className="btn-primary" onClick={() => setShowAdd(true)}>+ Add Printer</button>}
      </div>

      {printersLoading ? <PageLoading /> : (
        <div className="grid page-fade">
          {printers.length === 0 ? (
            <div className="empty-state" style={{ gridColumn: '1/-1' }}>
              <div className="empty-state-icon">🖨</div>
              <p>No printers added yet. Add your Bambu Lab printer to get started.</p>
            </div>
          ) : printers.map(p => (
            <PrinterCard
              key={p._id}
              printer={p}
              onDelete={canDelete ? (id) => { if (!confirm('Remove this printer?')) return; deleteMutation.mutate(id); } : undefined}
              onPrint={canWrite ? openPrint : undefined}
              onEdit={canWrite ? (printer) => setEditPrinter({ ...printer }) : undefined}
            />
          ))}
        </div>
      )}

      {/* Add Printer Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Add Bambu Lab Printer</h2>
            <form onSubmit={(e) => { e.preventDefault(); addMutation.mutate(form); }}>
              <div className="form-group">
                <label>Printer Name</label>
                <input placeholder="e.g. Workshop X1C" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Model</label>
                <select value={form.model} onChange={e => setForm({ ...form, model: e.target.value })}>
                  {['X1C', 'X1E', 'P1P', 'P1S', 'A1', 'A1 Mini'].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Printer IP Address</label>
                <input placeholder="192.168.1.x" value={form.ip} onChange={e => setForm({ ...form, ip: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Serial Number</label>
                <input placeholder="Found in Settings on printer screen" value={form.serial} onChange={e => setForm({ ...form, serial: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Access Code</label>
                <input placeholder="Found in Settings → LAN mode" value={form.accessCode} onChange={e => setForm({ ...form, accessCode: e.target.value })} required />
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                Find Serial & Access Code on the printer: Settings → Network → LAN Mode Liveview
              </p>
              <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Remote Access (optional)</div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Agent Token</label>
                  <input placeholder="Leave empty if portal is on same network" value={form.agentToken} onChange={e => setForm({ ...form, agentToken: e.target.value })} />
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                  Run the local agent on your workshop PC and paste the same token here to enable remote printing from anywhere.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={addMutation.isPending}>
                  {addMutation.isPending ? 'Adding...' : 'Add Printer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print Modal */}
      {showPrint && selectedPrinter && (
        <div className="modal-overlay" onClick={() => setShowPrint(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Send to {selectedPrinter.name}</h2>
            <form onSubmit={sendFile}>
              <div className="form-group">
                <label>Select File (3MF only)</label>
                <select
                  value={printForm.versionId}
                  onChange={e => { setPrintForm({ ...printForm, versionId: e.target.value }); setPrintStep('idle'); setUploadedFileName(''); setPrintResult(''); }}
                  required
                  disabled={['uploading', 'starting', 'done'].includes(printStep)}
                >
                  <option value="">— choose a version —</option>
                  {loadingOptions && <option disabled>Loading files...</option>}
                  {printOptions.map(v => <option key={v._id} value={v._id}>{v.label}</option>)}
                </select>
                {!loadingOptions && printOptions.length === 0 && (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>No .3mf versions found.</p>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                {[
                  { key: 'bedLeveling', label: 'Bed Leveling' },
                  { key: 'useAms',      label: 'Use AMS (multi-color)' },
                  { key: 'timelapse',   label: 'Record Timelapse' },
                ].map(opt => (
                  <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
                    <input
                      type="checkbox"
                      checked={printForm[opt.key]}
                      onChange={e => setPrintForm({ ...printForm, [opt.key]: e.target.checked })}
                      style={{ width: 16, height: 16 }}
                      disabled={['uploading', 'starting', 'done'].includes(printStep)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>

              {printResult && (
                <div style={{
                  padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13,
                  background: printResult.startsWith('✓') ? '#d4ede3' : '#fdf0ef',
                  color: printResult.startsWith('✓') ? 'var(--success)' : 'var(--danger)',
                  border: `1px solid ${printResult.startsWith('✓') ? '#a8d5bc' : '#f5c6c2'}`,
                }}>
                  {printResult}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <StepDot active={['uploading', 'uploaded', 'starting', 'done'].includes(printStep)} done={['uploaded', 'starting', 'done'].includes(printStep)} label="1. Send File" />
                <div style={{ flex: 1, height: 1, background: ['uploaded', 'starting', 'done'].includes(printStep) ? 'var(--accent)' : 'var(--border)' }} />
                <StepDot active={['starting', 'done'].includes(printStep)} done={printStep === 'done'} label="2. Start Print" />
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowPrint(false)}>Close</button>

                {(printStep === 'idle' || printStep === 'error') && (
                  <button type="submit" className="btn-primary" disabled={!printForm.versionId || uploadMutation.isPending}>
                    {uploadMutation.isPending ? '⟳ Uploading...' : '📤 Send File to Printer'}
                  </button>
                )}
                {printStep === 'uploading' && <button className="btn-primary" disabled>⟳ Uploading...</button>}
                {printStep === 'uploaded' && (
                  <button type="button" className="btn-primary" onClick={handleStartPrint}>🖨 Start Print</button>
                )}
                {printStep === 'starting' && <button className="btn-primary" disabled>⟳ Starting...</button>}
                {printStep === 'done' && (
                  <button type="button" className="btn-ghost" onClick={() => { setPrintStep('idle'); setUploadedFileName(''); setPrintResult(''); }}>
                    Send Another
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Printer Modal */}
      {editPrinter && (
        <div className="modal-overlay" onClick={() => setEditPrinter(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Edit Printer</h2>
            <form onSubmit={(e) => { e.preventDefault(); editMutation.mutate({ id: editPrinter._id, data: { name: editPrinter.name, ip: editPrinter.ip, serial: editPrinter.serial, accessCode: editPrinter.accessCode, model: editPrinter.model, agentToken: editPrinter.agentToken } }); }}>
              <div className="form-group"><label>Printer Name</label><input value={editPrinter.name} onChange={e => setEditPrinter({ ...editPrinter, name: e.target.value })} required /></div>
              <div className="form-group"><label>Model</label>
                <select value={editPrinter.model} onChange={e => setEditPrinter({ ...editPrinter, model: e.target.value })}>
                  {['X1C', 'X1E', 'P1P', 'P1S', 'A1', 'A1 Mini'].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="form-group"><label>IP Address</label><input value={editPrinter.ip} onChange={e => setEditPrinter({ ...editPrinter, ip: e.target.value })} required /></div>
              <div className="form-group"><label>Serial Number</label><input value={editPrinter.serial} onChange={e => setEditPrinter({ ...editPrinter, serial: e.target.value })} required /></div>
              <div className="form-group"><label>Access Code</label><input value={editPrinter.accessCode} onChange={e => setEditPrinter({ ...editPrinter, accessCode: e.target.value })} required /></div>
              <div className="form-group"><label>Agent Token (optional)</label><input value={editPrinter.agentToken || ''} onChange={e => setEditPrinter({ ...editPrinter, agentToken: e.target.value })} /></div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn-ghost" onClick={() => setEditPrinter(null)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={editMutation.isPending}>
                  {editMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
