import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import PageLoading from '../components/PageLoading';
import { usePermission } from '../context/AuthContext';
import { useConfirm } from '../components/ConfirmModal';
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
    <span
      className="inline-block w-2 h-2 rounded-full mr-1.5"
      style={{ background: STATE_COLOR[state] || STATE_COLOR.unknown }}
    />
  );
}

function StepDot({ active, done, label }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-semibold border-2 transition-all
          ${done ? 'bg-brand-500 border-brand-500 text-white' :
            active ? 'bg-gold border-gold text-white' :
            'bg-white/[0.04] border-white/[0.08] text-gray-500'}`}
      >
        {done ? '✓' : active ? '●' : '○'}
      </div>
      <span className="text-[10px] text-gray-500 whitespace-nowrap">{label}</span>
    </div>
  );
}

function PrinterCard({ printer, onDelete, onPrint, onEdit }) {
  const [showSd, setShowSd] = useState(false);
  const { confirmModal: sdConfirmModal, ask: askSd } = useConfirm();

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
    <div className="glass rounded-xl p-5 flex flex-col gap-3.5">{sdConfirmModal}
      <div className="flex justify-between items-start">
        <div>
          <div className="font-semibold text-base text-gray-200">{printer.name}</div>
          <div className="text-xs text-gray-500 mt-0.5">{printer.model} · {printer.ip}</div>
        </div>
        <div className="flex gap-1.5">
          {onEdit && <button className="text-[11px] px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.08] text-gray-400 hover:bg-white/[0.08] transition-all" onClick={() => onEdit(printer)}>Edit IP</button>}
          {onDelete && <button className="text-[11px] px-2.5 py-1 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all" onClick={() => onDelete(printer._id)}>Delete</button>}
        </div>
      </div>

      {/* Status panel */}
      <div className="bg-white/[0.03] rounded-lg px-3.5 py-3">
        {loadingStatus && !status && <span className="text-sm text-gray-500">Connecting...</span>}
        {statusErr && !status && <span className="text-sm text-red-400">⚠ {statusErr.response?.data?.message || 'Unreachable'}</span>}
        {status && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-gray-200">
                <StatusDot state={status.state} />{status.state}
              </span>
              <button className="text-[11px] px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-gray-400 hover:bg-white/[0.08] transition-all" onClick={() => refetchStatus()} disabled={loadingStatus}>
                {loadingStatus ? '⟳' : '↻ Refresh'}
              </button>
            </div>
            {status.state === 'RUNNING' && (
              <>
                <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className="h-full bg-brand-400 transition-all duration-300 rounded-full" style={{ width: `${status.progress}%` }} />
                </div>
                <div className="text-xs text-gray-500 flex gap-4">
                  <span>{status.progress}% complete</span>
                  <span>~{status.remainingTime} min left</span>
                </div>
              </>
            )}
            <div className="text-xs text-gray-500 flex gap-4 flex-wrap">
              <span>Nozzle: {status.nozzleTemp}°C</span>
              <span>Bed: {status.bedTemp}°C</span>
              {status.currentFile && <span>{status.currentFile}</span>}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {onPrint && <button className="text-xs font-medium px-3 py-1.5 rounded-md bg-brand-500/80 text-gray-200 hover:bg-brand-500 transition-all" onClick={() => onPrint(printer)}>Send File to Print</button>}
        <button className="text-xs px-3 py-1.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-gray-400 hover:bg-white/[0.08] transition-all" onClick={toggleSd}>{showSd ? 'Hide' : 'SD Card'}</button>
      </div>

      {/* SD Card browser */}
      {showSd && (
        <div className="border-t border-white/[0.06] pt-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-gray-500">SD Card Files</span>
            <button className="text-[11px] px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-gray-400 hover:bg-white/[0.08] transition-all" onClick={() => refetchSd()}>↻ Refresh</button>
          </div>
          {sdLoading && <p className="text-sm text-gray-500">Reading SD card...</p>}
          {sdErr && <p className="text-sm text-red-400">⚠ {sdErr.response?.data?.message || 'Could not read SD card'}</p>}
          {!sdLoading && sdFiles.length === 0 && !sdErr && (
            <p className="text-sm text-gray-500">No .3mf or .gcode files found</p>
          )}
          <div className="flex flex-col gap-1 max-h-[220px] overflow-y-auto">
            {sdFiles.map(f => (
              <div key={f.name} className="flex items-center gap-2 px-2.5 py-1.5 bg-white/[0.03] rounded-md text-xs">
                <span className="flex-1 font-mono text-gray-300 overflow-hidden text-ellipsis whitespace-nowrap">{f.name}</span>
                <span className="text-gray-500 flex-shrink-0">{f.size ? `${(f.size / 1024 / 1024).toFixed(1)} MB` : ''}</span>
                <button
                  className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all flex-shrink-0"
                  disabled={deleteSdMutation.isPending}
                  onClick={() => askSd({ title: 'Delete from SD card?', message: `"${f.name}" will be removed from the printer's SD card.` }).then(ok => { if (ok) deleteSdMutation.mutate({ printerId: printer._id, filename: f.name }); })}
                ><svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg></button>
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
  const { canWrite, canDelete } = usePermission('printers');
  const { confirmModal, ask } = useConfirm();
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
    <>{confirmModal}
      {/* Header */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-semibold text-gray-100 tracking-tight">Printers</h1>
          <p className="text-sm text-gray-500 mt-1">{printers.length} printer{printers.length !== 1 ? 's' : ''} configured</p>
        </div>
        {canWrite && (
          <button className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 text-gray-100 text-sm font-medium transition-all shadow-lg shadow-brand-500/20" onClick={() => setShowAdd(true)}>
            + Add Printer
          </button>
        )}
      </div>

      {printersLoading ? <PageLoading /> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-in">
          {printers.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-500">
              <p className="text-sm">No printers added yet. Add your Bambu Lab printer to get started.</p>
            </div>
          ) : printers.map(p => (
            <PrinterCard
              key={p._id}
              printer={p}
              onDelete={canDelete ? (id) => ask({ title: 'Remove printer?', message: 'This will remove the printer from your workspace.' }).then(ok => { if (ok) deleteMutation.mutate(id); }) : undefined}
              onPrint={canWrite ? openPrint : undefined}
              onEdit={canWrite ? (printer) => setEditPrinter({ ...printer }) : undefined}
            />
          ))}
        </div>
      )}

      {/* Add Printer Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowAdd(false)}>
          <div className="modal-surface p-7 w-[460px] max-w-[95vw]" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-800 mb-5">Add Bambu Lab Printer</h2>
            <form onSubmit={(e) => { e.preventDefault(); addMutation.mutate(form); }} className="space-y-4">
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">Printer Name</label>
                <input placeholder="e.g. Workshop X1C" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">Model</label>
                <select value={form.model} onChange={e => setForm({ ...form, model: e.target.value })}>
                  {['X1C', 'X1E', 'P1P', 'P1S', 'A1', 'A1 Mini'].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">Printer IP Address</label>
                <input placeholder="192.168.1.x" value={form.ip} onChange={e => setForm({ ...form, ip: e.target.value })} required />
              </div>
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">Serial Number</label>
                <input placeholder="Found in Settings on printer screen" value={form.serial} onChange={e => setForm({ ...form, serial: e.target.value })} required />
              </div>
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">Access Code</label>
                <input placeholder="Found in Settings → LAN mode" value={form.accessCode} onChange={e => setForm({ ...form, accessCode: e.target.value })} required />
              </div>
              <p className="text-xs text-gray-500">
                Find Serial & Access Code on the printer: Settings → Network → LAN Mode Liveview
              </p>
              <div className="bg-white/[0.03] rounded-lg px-3.5 py-3">
                <div className="text-[11px] font-medium uppercase tracking-wider text-gold mb-2">Remote Access (optional)</div>
                <div>
                  <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">Agent Token</label>
                  <input placeholder="Leave empty if portal is on same network" value={form.agentToken} onChange={e => setForm({ ...form, agentToken: e.target.value })} />
                </div>
                <p className="text-[11px] text-gray-500 mt-1.5">
                  Run the local agent on your workshop PC and paste the same token here to enable remote printing from anywhere.
                </p>
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button type="button" className="px-4 py-2 rounded-lg bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200 text-sm transition-all" onClick={() => setShowAdd(false)}>Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 text-gray-100 text-sm font-medium transition-all" disabled={addMutation.isPending}>
                  {addMutation.isPending ? 'Adding...' : 'Add Printer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print Modal */}
      {showPrint && selectedPrinter && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowPrint(false)}>
          <div className="modal-surface p-7 w-[460px] max-w-[95vw]" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-800 mb-5">Send to {selectedPrinter.name}</h2>
            <form onSubmit={sendFile} className="space-y-4">
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">Select File (3MF only)</label>
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
                  <p className="text-xs text-gray-500 mt-1">No .3mf versions found.</p>
                )}
              </div>

              <div className="flex flex-col gap-2.5">
                {[
                  { key: 'bedLeveling', label: 'Bed Leveling' },
                  { key: 'useAms',      label: 'Use AMS (multi-color)' },
                  { key: 'timelapse',   label: 'Record Timelapse' },
                ].map(opt => (
                  <label key={opt.key} className="flex items-center gap-2.5 cursor-pointer text-sm text-gray-300">
                    <input
                      type="checkbox"
                      checked={printForm[opt.key]}
                      onChange={e => setPrintForm({ ...printForm, [opt.key]: e.target.checked })}
                      className="!w-4 !h-4 rounded accent-brand-500"
                      disabled={['uploading', 'starting', 'done'].includes(printStep)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>

              {printResult && (
                <div className={`px-3.5 py-2.5 rounded-lg text-sm ${
                  printResult.startsWith('✓')
                    ? 'bg-brand-500/15 text-brand-200 border border-brand-500/20'
                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}>
                  {printResult}
                </div>
              )}

              <div className="flex items-center gap-2">
                <StepDot active={['uploading', 'uploaded', 'starting', 'done'].includes(printStep)} done={['uploaded', 'starting', 'done'].includes(printStep)} label="1. Send File" />
                <div className={`flex-1 h-px transition-colors ${['uploaded', 'starting', 'done'].includes(printStep) ? 'bg-brand-400' : 'bg-white/[0.08]'}`} />
                <StepDot active={['starting', 'done'].includes(printStep)} done={printStep === 'done'} label="2. Start Print" />
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <button type="button" className="px-4 py-2 rounded-lg bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200 text-sm transition-all" onClick={() => setShowPrint(false)}>Close</button>

                {(printStep === 'idle' || printStep === 'error') && (
                  <button type="submit" className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 text-gray-100 text-sm font-medium transition-all" disabled={!printForm.versionId || uploadMutation.isPending}>
                    {uploadMutation.isPending ? '⟳ Uploading...' : 'Send File to Printer'}
                  </button>
                )}
                {printStep === 'uploading' && <button className="px-4 py-2 rounded-lg bg-brand-500 text-gray-100 text-sm" disabled>⟳ Uploading...</button>}
                {printStep === 'uploaded' && (
                  <button type="button" className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 text-gray-100 text-sm font-medium transition-all" onClick={handleStartPrint}>Start Print</button>
                )}
                {printStep === 'starting' && <button className="px-4 py-2 rounded-lg bg-brand-500 text-gray-100 text-sm" disabled>⟳ Starting...</button>}
                {printStep === 'done' && (
                  <button type="button" className="px-4 py-2 rounded-lg bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200 text-sm transition-all" onClick={() => { setPrintStep('idle'); setUploadedFileName(''); setPrintResult(''); }}>
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setEditPrinter(null)}>
          <div className="modal-surface p-7 w-[460px] max-w-[95vw]" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-800 mb-5">Edit Printer</h2>
            <form onSubmit={(e) => { e.preventDefault(); editMutation.mutate({ id: editPrinter._id, data: { name: editPrinter.name, ip: editPrinter.ip, serial: editPrinter.serial, accessCode: editPrinter.accessCode, model: editPrinter.model, agentToken: editPrinter.agentToken } }); }} className="space-y-4">
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">Printer Name</label>
                <input value={editPrinter.name} onChange={e => setEditPrinter({ ...editPrinter, name: e.target.value })} required />
              </div>
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">Model</label>
                <select value={editPrinter.model} onChange={e => setEditPrinter({ ...editPrinter, model: e.target.value })}>
                  {['X1C', 'X1E', 'P1P', 'P1S', 'A1', 'A1 Mini'].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">IP Address</label>
                <input value={editPrinter.ip} onChange={e => setEditPrinter({ ...editPrinter, ip: e.target.value })} required />
              </div>
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">Serial Number</label>
                <input value={editPrinter.serial} onChange={e => setEditPrinter({ ...editPrinter, serial: e.target.value })} required />
              </div>
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">Access Code</label>
                <input value={editPrinter.accessCode} onChange={e => setEditPrinter({ ...editPrinter, accessCode: e.target.value })} required />
              </div>
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">Agent Token (optional)</label>
                <input value={editPrinter.agentToken || ''} onChange={e => setEditPrinter({ ...editPrinter, agentToken: e.target.value })} />
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button type="button" className="px-4 py-2 rounded-lg bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200 text-sm transition-all" onClick={() => setEditPrinter(null)}>Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 text-gray-100 text-sm font-medium transition-all" disabled={editMutation.isPending}>
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
