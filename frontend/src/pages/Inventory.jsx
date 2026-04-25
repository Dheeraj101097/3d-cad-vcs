import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageLoading from '../components/PageLoading';
import { usePermission } from '../context/AuthContext';
import { useConfirm } from '../components/ConfirmModal';
import {
  getInventoryGroups, createInventoryGroup, updateInventoryGroup, deleteInventoryGroup,
  getInventoryComponents, createInventoryComponent, updateInventoryComponent, deleteInventoryComponent,
  adjustInventoryStock, acknowledgeAlert,
  getInventoryAlerts, getInventoryTypes, createInventoryType, deleteInventoryType, seedInventoryTypes,
} from '../api';

const EMOJI_OPTIONS = ['📦','🧵','⚡','🔩','🔧','🖨','💡','🧪','🎨','🔋','📱','🖥','⚙','🛠','🧲','💎','🪛','🔌'];

// ── TypeManagerModal ───────────────────────────────────────────────────────────
function TypeManagerModal({ types, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', icon: '📦', color: '#4a3d5a' });
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: createInventoryType,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inv-types'] });
      setForm({ name: '', icon: '📦', color: '#4a3d5a' });
    },
    onError: (e) => setError(e.response?.data?.message || 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteInventoryType,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inv-types'] }),
    onError: (e) => setError(e.response?.data?.message || 'Cannot delete'),
  });

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="modal-surface p-7 w-[480px] max-w-[95vw]" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-gray-800 mb-5">Manage Types</h2>
        <div className="mb-5 flex flex-col gap-2">
          {types.map(t => (
            <div key={t._id} className="flex items-center gap-3 px-3 py-2 bg-white/[0.03] rounded-lg">
              <span className="text-lg">{t.icon}</span>
              <span className="flex-1 font-medium text-sm text-gray-200">{t.name}</span>
              <div className="w-3.5 h-3.5 rounded-full border border-gray-600" style={{ background: t.color }} />
              <button className="text-[11px] px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all" onClick={() => deleteMutation.mutate(t._id)}><svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg></button>
            </div>
          ))}
          {types.length === 0 && <p className="text-sm text-gray-500">No types yet.</p>}
        </div>
        <div className="border-t border-white/[0.06] pt-4">
          <div className="text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-3">Add New Type</div>
          {error && <div className="text-red-400 text-sm mb-2">{error}</div>}
          <form onSubmit={e => { e.preventDefault(); createMutation.mutate(form); }}>
            <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-end">
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">Type Name</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. filament" required />
              </div>
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">Icon</label>
                <select value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} className="!w-[70px]">
                  {/* {EMOJI_OPTIONS.map(e => <option key={e} value={e}>{e}</option>)} */}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">Color</label>
                <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="!w-[50px] !h-[38px] !p-0.5 cursor-pointer" />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-3">
              <button type="button" className="px-4 py-2 rounded-lg bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200 text-sm transition-all" onClick={onClose}>Done</button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 text-gray-100 text-sm font-medium transition-all" disabled={createMutation.isPending}>Add Type</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── AlertBanner ────────────────────────────────────────────────────────────────
function AlertBanner({ alerts, onAck }) {
  if (!alerts?.count) return null;
  return (
    <div className="flex items-start gap-3 px-4 py-3 mb-5 rounded-xl bg-red-500/10 border border-red-500/20">
      <div className="flex-1">
        <div className="font-semibold text-red-400 text-sm mb-1.5">
          {alerts.count} component{alerts.count > 1 ? 's' : ''} below minimum threshold
        </div>
        <div className="flex flex-wrap gap-2">
          {alerts.items.map(item => (
            <div key={item._id} className="flex items-center gap-2 bg-white/[0.03] border border-red-500/15 rounded-md px-2.5 py-1 text-xs">
              <span className="font-semibold text-red-400">{item.code}</span>
              <span className="text-gray-300">{item.name}</span>
              <span className="text-red-400">{item.inStock} / {item.minThreshold} {item.unit}</span>
              {onAck && <button className="text-red-400 font-semibold hover:text-red-300 transition-colors" onClick={() => onAck(item._id)}>Ack</button>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── StockBar ───────────────────────────────────────────────────────────────────
function StockBar({ inStock, inTransit, minThreshold }) {
  const total = Math.max(inStock + inTransit, minThreshold * 2, 1);
  const stockPct = Math.min((inStock / total) * 100, 100);
  const transitPct = Math.min((inTransit / total) * 100, 100 - stockPct);
  const thresholdPct = Math.min((minThreshold / total) * 100, 100);
  const isLow = inStock < minThreshold;
  return (
    <div className="relative h-1.5 bg-white/[0.06] rounded-full overflow-visible mt-1">
      <div className="absolute left-0 top-0 h-full rounded-full transition-all duration-300" style={{ width: `${stockPct}%`, background: isLow ? '#ef4444' : '#3d6b55' }} />
      <div className="absolute top-0 h-full rounded-full opacity-60" style={{ left: `${stockPct}%`, width: `${transitPct}%`, background: '#b8935a' }} />
      <div className="absolute rounded-sm" style={{ left: `${thresholdPct}%`, top: -3, width: 2, height: 12, background: '#ef4444' }} title={`Min: ${minThreshold}`} />
    </div>
  );
}

// ── ComponentRow ───────────────────────────────────────────────────────────────
function ComponentRow({ comp, onEdit, onAdjust, onDelete, onAck }) {
  const isLow = comp.inStock < comp.minThreshold;
  const isAlert = comp.alertTriggered && !comp.alertAcknowledged;
  return (
    <div className={`grid grid-cols-[90px_1fr_100px_100px_100px_90px_120px] gap-3 px-4 py-3 border-b border-white/[0.04] items-center text-[13px] ${isAlert ? 'bg-red-500/[0.03]' : ''}`}>
      <div>
        <span className="font-mono text-[11px] font-semibold text-gold bg-white/[0.04] px-1.5 py-0.5 rounded">
          {comp.code}
        </span>
      </div>
      <div>
        <div className="font-medium text-gray-200">{comp.name}</div>
        {comp.supplier && <div className="text-[11px] text-gray-500">{comp.supplier}</div>}
      </div>
      <div>
        <div className="flex items-center gap-1.5">
          <span className={`font-semibold text-[15px] ${isLow ? 'text-red-400' : 'text-gray-200'}`}>{comp.inStock}</span>
          <span className="text-[11px] text-gray-500">{comp.unit}</span>
          {isAlert && <span className="text-[10px] bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded font-semibold">LOW</span>}
        </div>
        <StockBar inStock={comp.inStock} inTransit={comp.inTransit} minThreshold={comp.minThreshold} />
      </div>
      <div className="text-gray-500">
        {comp.inTransit > 0
          ? <span className="text-gold font-medium">{comp.inTransit} <span className="text-[11px]">{comp.unit}</span></span>
          : <span className="text-gray-600">—</span>
        }
      </div>
      <div className="text-xs text-gray-500">
        Min: <span className="font-medium text-gray-300">{comp.minThreshold}</span> {comp.unit}
      </div>
      <div>
        {isAlert
          ? (onAck
              ? <button className="text-[11px] font-semibold px-2 py-1 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all" onClick={() => onAck(comp._id)}>Acknowledge</button>
              : <span className="text-[11px] text-red-400 font-semibold">LOW</span>)
          : <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-200">OK</span>
        }
      </div>
      <div className="flex gap-1">
        {onAdjust && <button className="text-[11px] px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-gray-400 hover:bg-white/[0.08] transition-all" onClick={() => onAdjust(comp)} title="Adjust stock">±</button>}
        {onEdit && <button className="text-[11px] px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-gray-400 hover:bg-white/[0.08] transition-all" onClick={() => onEdit(comp)}>Edit</button>}
        {onDelete && <button className="text-[11px] px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all" onClick={() => onDelete(comp._id)}><svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg></button>}
      </div>
    </div>
  );
}

// ── TypeSection sidebar ────────────────────────────────────────────────────────
function TypeSection({ type, groups, components, activeGroup, isTypeActive, typeCount, getLabel, onSelectType, onSelectGroup, onEditGroup, onDeleteGroup }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <div
        className={`flex items-center gap-2 px-3.5 py-2 cursor-pointer select-none border-b border-white/[0.04] transition-colors ${isTypeActive ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]'}`}
        onClick={() => { onSelectType(); setOpen(true); }}
      >
        <span
          className={`text-[11px] text-gray-500 transition-transform inline-block ${open ? 'rotate-90' : 'rotate-0'}`}
          onClick={e => { e.stopPropagation(); setOpen(!open); }}
        >▶</span>
        <span className="font-semibold text-xs text-gray-300 uppercase tracking-wider flex-1">
          {getLabel(type.name)}
        </span>
        <span className="text-[11px] text-gray-500">{typeCount}</span>
      </div>
      {open && groups.map(g => {
        const count = components.filter(c => c.group?._id === g._id).length;
        const isActive = activeGroup === g._id;
        return (
          <div
            key={g._id}
            onClick={() => onSelectGroup(g._id)}
            className={`flex items-center gap-2 px-3.5 py-1.5 pl-8 cursor-pointer border-b border-white/[0.04] transition-all
              ${isActive ? 'bg-brand-500/10 border-l-[3px] border-l-brand-400' : 'border-l-[3px] border-l-transparent hover:bg-white/[0.02]'}`}
          >
            <span className={`flex-1 text-[13px] truncate ${isActive ? 'font-semibold text-gray-200' : 'font-normal text-gray-400'}`}>
              {g.name}
            </span>
            <span className="text-[11px] text-gray-500 flex-shrink-0">{count}</span>
            <div className="flex gap-0.5 flex-shrink-0">
              {onEditGroup && <button className="text-[10px] px-1 py-0.5 rounded bg-white/[0.04] text-gray-500 hover:bg-white/[0.08] transition-all"
                onClick={e => { e.stopPropagation(); onEditGroup(g); }}>✎</button>}
              {onDeleteGroup && <button className="text-[10px] px-1 py-0.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                onClick={e => { e.stopPropagation(); onDeleteGroup(g._id); }}><svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg></button>}
            </div>
          </div>
        );
      })}
      {open && groups.length === 0 && (
        <div className="px-3.5 py-1.5 pl-8 text-[11px] text-gray-600 border-b border-white/[0.04]">
          No groups
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function Inventory() {
  const qc = useQueryClient();
  const { canWrite, canDelete } = usePermission('inventory');
  const { confirmModal, ask } = useConfirm();

  // URL-based navigation state — survives page refresh and browser back/forward
  const [searchParams, setSearchParams] = useSearchParams();
  const activeGroup = searchParams.get('group') || null;
  const activeType  = searchParams.get('type')  || null;

  const setActiveGroup = (id) => setSearchParams(id ? { group: id } : {}, { replace: true });
  const setActiveType  = (name) => setSearchParams(name ? { type: name } : {}, { replace: true });
  const clearSelection = () => setSearchParams({}, { replace: true });

  // Modal/form state — local only
  const [showGroupModal,  setShowGroupModal]  = useState(false);
  const [showCompModal,   setShowCompModal]   = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showTypeManager, setShowTypeManager] = useState(false);
  const [editGroup,   setEditGroup]   = useState(null);
  const [editComp,    setEditComp]    = useState(null);
  const [adjustComp,  setAdjustComp]  = useState(null);
  const [adjustDelta, setAdjustDelta] = useState({ inStock: 0, inTransit: 0 });
  const [groupForm,   setGroupForm]   = useState({ name: '', type: '', description: '' });
  const [compForm,    setCompForm]    = useState({ name: '', description: '', unit: 'pcs', inStock: 0, inTransit: 0, minThreshold: 10, supplier: '', notes: '', group: '' });

  // ── Queries ──
  const { data: types = [], isLoading: typesLoading } = useQuery({
    queryKey: ['inv-types'],
    queryFn: async () => {
      const t = await getInventoryTypes();
      if (t.length === 0) { await seedInventoryTypes(); return getInventoryTypes(); }
      return t;
    },
  });

  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ['inv-groups'],
    queryFn: getInventoryGroups,
  });

  const { data: components = [], isLoading: componentsLoading } = useQuery({
    queryKey: ['inv-components', activeGroup],
    queryFn: () => getInventoryComponents(activeGroup ? { group: activeGroup } : {}),
  });

  const { data: alerts = { count: 0, items: [] } } = useQuery({
    queryKey: ['inv-alerts'],
    queryFn: getInventoryAlerts,
    refetchInterval: 60_000,
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['inv-groups'] });
    qc.invalidateQueries({ queryKey: ['inv-components'] });
    qc.invalidateQueries({ queryKey: ['inv-alerts'] });
  };

  // ── Group mutations ──
  const saveGroupMutation = useMutation({
    mutationFn: (data) => editGroup
      ? updateInventoryGroup({ id: editGroup._id, data })
      : createInventoryGroup(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inv-groups'] });
      setShowGroupModal(false);
      setEditGroup(null);
      setGroupForm({ name: '', type: types[0]?.name || '', description: '' });
    },
    onError: (e) => alert(e.response?.data?.message || 'Save failed'),
  });

  const deleteGroupMutation = useMutation({
    mutationFn: deleteInventoryGroup,
    onSuccess: (_, deletedId) => {
      if (activeGroup === deletedId) clearSelection();
      invalidateAll();
    },
    onError: () => alert('Delete failed'),
  });

  // ── Component mutations ──
  const saveCompMutation = useMutation({
    mutationFn: (data) => editComp
      ? updateInventoryComponent({ id: editComp._id, data })
      : createInventoryComponent(data),
    onSuccess: () => {
      invalidateAll();
      setShowCompModal(false);
      setEditComp(null);
      setCompForm({ name: '', description: '', unit: 'pcs', inStock: 0, inTransit: 0, minThreshold: 10, supplier: '', notes: '', group: '' });
    },
    onError: (e) => alert(e.response?.data?.message || 'Save failed'),
  });

  const deleteCompMutation = useMutation({
    mutationFn: deleteInventoryComponent,
    onSuccess: invalidateAll,
    onError: () => alert('Delete failed'),
  });

  const adjustMutation = useMutation({
    mutationFn: async ({ id, inStockDelta, inTransitDelta }) => {
      const calls = [];
      if (inStockDelta !== 0) calls.push(adjustInventoryStock({ id, field: 'inStock', delta: inStockDelta }));
      if (inTransitDelta !== 0) calls.push(adjustInventoryStock({ id, field: 'inTransit', delta: inTransitDelta }));
      return Promise.all(calls);
    },
    onSuccess: () => {
      invalidateAll();
      setShowAdjustModal(false);
      setAdjustComp(null);
      setAdjustDelta({ inStock: 0, inTransit: 0 });
    },
    onError: () => alert('Adjust failed'),
  });

  const ackMutation = useMutation({
    mutationFn: acknowledgeAlert,
    onSuccess: invalidateAll,
  });

  // ── Helpers ──
  const typeMap  = Object.fromEntries(types.map(t => [t.name, t]));
  const getIcon  = (name) => typeMap[name]?.icon || '📦';
  const getLabel = (name) => name ? name.charAt(0).toUpperCase() + name.slice(1) : '';

  const openEditGroup = (g) => {
    setEditGroup(g);
    setGroupForm({ name: g.name, type: g.type, description: g.description || '' });
    setShowGroupModal(true);
  };

  const openEditComp = (comp) => {
    setEditComp(comp);
    setCompForm({ name: comp.name, description: comp.description || '', unit: comp.unit, inStock: comp.inStock, inTransit: comp.inTransit, minThreshold: comp.minThreshold, supplier: comp.supplier || '', notes: comp.notes || '' });
    setShowCompModal(true);
  };

  const openNewGroup = () => {
    setEditGroup(null);
    setGroupForm({ name: '', type: types[0]?.name || '', description: '' });
    setShowGroupModal(true);
  };

  const openNewComp = () => {
    setEditComp(null);
    setCompForm({ name: '', description: '', unit: 'pcs', inStock: 0, inTransit: 0, minThreshold: 10, supplier: '', notes: '', group: activeGroup || groups[0]?._id || '' });
    setShowCompModal(true);
  };

  const deleteGroup = async (id) => {
    const ok = await ask({ title: 'Delete group?', message: 'This will permanently delete the group and all its components.' });
    if (ok) deleteGroupMutation.mutate(id);
  };

  const deleteComp = async (id) => {
    const ok = await ask({ title: 'Delete component?', message: 'This will permanently delete this inventory component.' });
    if (ok) deleteCompMutation.mutate(id);
  };

  // ── Filtered display ──
  const filteredGroups = activeType ? groups.filter(g => g.type === activeType) : groups;
  const filteredComponents = activeGroup
    ? components
    : activeType
      ? components.filter(c => filteredGroups.some(g => g._id === c.group?._id))
      : components;

  const totalStock   = components.reduce((s, c) => s + c.inStock, 0);
  const totalTransit = components.reduce((s, c) => s + c.inTransit, 0);

  if (typesLoading || groupsLoading) return <PageLoading />;

  return (
    <>{confirmModal}
      {/* Header */}
      <div className="flex items-center justify-between mb-7 animate-fade-in">
        <div>
          <h1 className="text-2xl font-semibold text-gray-100 tracking-tight">Inventory</h1>
          <p className="text-sm text-gray-500 mt-1">{components.length} components · {groups.length} groups</p>
        </div>
        <div className="flex gap-2">
          {canWrite && <button className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-gray-400 hover:bg-white/[0.08] text-xs transition-all" onClick={() => setShowTypeManager(true)}>Types</button>}
          {canWrite && <button className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-gray-400 hover:bg-white/[0.08] text-xs transition-all" onClick={openNewGroup}>+ New Group</button>}
          {canWrite && <button className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 text-gray-100 text-sm font-medium transition-all shadow-lg shadow-brand-500/20" onClick={openNewComp} disabled={groups.length === 0}>+ Add Component</button>}
        </div>
      </div>

      <AlertBanner alerts={alerts} onAck={canWrite ? (id) => ackMutation.mutate(id) : undefined} />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Components', value: components.length },
          { label: 'Total In Stock',   value: totalStock },
          { label: 'In Transit',       value: totalTransit },
          { label: 'Low Stock Alerts', value: alerts.count, danger: alerts.count > 0 }
        ].map(s => (
          <div key={s.label} className="glass rounded-xl text-center py-4 px-3">
            <div className={`text-2xl font-bold leading-none ${s.danger ? 'text-red-400' : 'text-brand-300'}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[220px_1fr] gap-5 items-start">
        {/* Sidebar */}
        <div className="glass rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06] bg-white/[0.03] text-xs font-medium uppercase tracking-wider text-gray-400">Groups</div>
          <div
            className={`flex flex-col gap-0.5 px-3.5 py-2 cursor-pointer border-b border-white/[0.04] transition-colors ${!activeGroup && !activeType ? 'bg-brand-500/10 border-l-[3px] border-l-brand-400' : 'border-l-[3px] border-l-transparent hover:bg-white/[0.02]'}`}
            onClick={clearSelection}
          >
            <span className="font-medium text-[13px] text-gray-200">All Components</span>
            <span className="text-[11px] text-gray-500">{components.length} items</span>
          </div>
          {types.map(t => {
            const typeGroups = groups.filter(g => g.type === t.name);
            const isTypeActive = activeType === t.name && !activeGroup;
            const typeCount = components.filter(c => typeGroups.some(g => g._id === c.group?._id)).length;
            return (
              <TypeSection
                key={t._id}
                type={t}
                groups={typeGroups}
                components={components}
                activeGroup={activeGroup}
                activeType={activeType}
                isTypeActive={isTypeActive}
                typeCount={typeCount}
                getLabel={getLabel}
                onSelectType={() => setActiveType(t.name)}
                onSelectGroup={(id) => setActiveGroup(id)}
                onEditGroup={canWrite ? openEditGroup : undefined}
                onDeleteGroup={canDelete ? deleteGroup : undefined}
              />
            );
          })}
          {groups.length === 0 && types.length > 0 && (
            <div className="px-4 py-4 text-xs text-gray-500 text-center">
              No groups yet. Click "+ New Group".
            </div>
          )}
        </div>

        {/* Component table */}
        <div className="glass rounded-xl overflow-hidden">
          <div className="grid grid-cols-[90px_1fr_100px_100px_100px_90px_120px] gap-3 px-4 py-3 border-b border-white/[0.06] bg-white/[0.03]">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Code</span>
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Component</span>
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">In Stock</span>
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">In Transit</span>
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Min Level</span>
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Status</span>
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Actions</span>
          </div>
          {componentsLoading && (
            <div className="py-8 text-center">
              <div className="spinner mx-auto mb-2" />
              <span className="text-sm text-gray-500">Loading...</span>
            </div>
          )}
          {!componentsLoading && filteredComponents.length === 0 && (
            <div className="py-8 text-center text-sm text-gray-500">
              {groups.length === 0 ? 'Create a group first, then add components.' : 'No components in this group.'}
            </div>
          )}
          {!componentsLoading && filteredComponents.map(comp => (
            <ComponentRow
              key={comp._id} comp={comp}
              onEdit={canWrite ? openEditComp : undefined}
              onAdjust={canWrite ? (c) => { setAdjustComp(c); setAdjustDelta({ inStock: 0, inTransit: 0 }); setShowAdjustModal(true); } : undefined}
              onDelete={canDelete ? deleteComp : undefined}
              onAck={canWrite ? (id) => ackMutation.mutate(id) : undefined}
            />
          ))}
        </div>
      </div>

      {/* Type Manager Modal */}
      {showTypeManager && (
        <TypeManagerModal types={types} onClose={() => setShowTypeManager(false)} />
      )}

      {/* Group Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowGroupModal(false)}>
          <div className="modal-surface p-7 w-[460px] max-w-[95vw]" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-800 mb-5">{editGroup ? 'Edit Group' : 'New Group'}</h2>
            <form onSubmit={e => { e.preventDefault(); saveGroupMutation.mutate(groupForm); }} className="space-y-4">
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">Group Name</label>
                <input value={groupForm.name} onChange={e => setGroupForm({ ...groupForm, name: e.target.value })} required placeholder="e.g. PLA Filaments" />
              </div>
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">Type</label>
                <select value={groupForm.type} onChange={e => setGroupForm({ ...groupForm, type: e.target.value })}>
                  {types.map(t => <option key={t._id} value={t.name}>{t.icon} {getLabel(t.name)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">Description</label>
                <textarea rows={2} value={groupForm.description} onChange={e => setGroupForm({ ...groupForm, description: e.target.value })} />
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button type="button" className="px-4 py-2 rounded-lg bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200 text-sm transition-all" onClick={() => setShowGroupModal(false)}>Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 text-gray-100 text-sm font-medium transition-all" disabled={saveGroupMutation.isPending}>
                  {editGroup ? 'Save' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Component Modal */}
      {showCompModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowCompModal(false)}>
          <div className="modal-surface p-7 w-[520px] max-w-[95vw]" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-800 mb-5">{editComp ? 'Edit Component' : 'Add Component'}</h2>
            <form onSubmit={e => { e.preventDefault(); saveCompMutation.mutate({ ...compForm, group: compForm.group || activeGroup || groups[0]?._id }); }} className="space-y-4">
              {!editComp && (
                <div>
                  <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">Group</label>
                  <select value={compForm.group} onChange={e => setCompForm({ ...compForm, group: e.target.value })}>
                    {groups.map(g => <option key={g._id} value={g._id}>{getIcon(g.type)} {g.name}</option>)}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">Component Name</label>
                  <input value={compForm.name} onChange={e => setCompForm({ ...compForm, name: e.target.value })} required placeholder="e.g. PLA White 1kg" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">Unit</label>
                  <select value={compForm.unit} onChange={e => setCompForm({ ...compForm, unit: e.target.value })}>
                    {['pcs', 'kg', 'g', 'm', 'rolls', 'boxes', 'liters', 'sets'].map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">In Stock</label>
                  <input type="number" min="0" value={compForm.inStock} onChange={e => setCompForm({ ...compForm, inStock: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">In Transit</label>
                  <input type="number" min="0" value={compForm.inTransit} onChange={e => setCompForm({ ...compForm, inTransit: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">Min Threshold (alert below)</label>
                  <input type="number" min="0" value={compForm.minThreshold} onChange={e => setCompForm({ ...compForm, minThreshold: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">Supplier</label>
                  <input value={compForm.supplier} onChange={e => setCompForm({ ...compForm, supplier: e.target.value })} placeholder="Optional" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">Description / Notes</label>
                <textarea rows={2} value={compForm.notes} onChange={e => setCompForm({ ...compForm, notes: e.target.value })} />
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button type="button" className="px-4 py-2 rounded-lg bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200 text-sm transition-all" onClick={() => setShowCompModal(false)}>Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 text-gray-100 text-sm font-medium transition-all" disabled={saveCompMutation.isPending}>
                  {editComp ? 'Save Changes' : 'Add Component'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {showAdjustModal && adjustComp && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowAdjustModal(false)}>
          <div className="modal-surface p-7 w-[460px] max-w-[95vw]" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Adjust Stock — {adjustComp.name}</h2>
            <div className="bg-white/[0.03] rounded-lg px-3.5 py-3 mb-5 text-sm">
              <div className="flex gap-6 text-gray-400">
                <span>Current stock: <strong className="text-gray-200">{adjustComp.inStock} {adjustComp.unit}</strong></span>
                <span>In transit: <strong className="text-gray-200">{adjustComp.inTransit} {adjustComp.unit}</strong></span>
                <span>Min: <strong className="text-gray-200">{adjustComp.minThreshold} {adjustComp.unit}</strong></span>
              </div>
            </div>
            <form onSubmit={e => {
              e.preventDefault();
              adjustMutation.mutate({ id: adjustComp._id, inStockDelta: Number(adjustDelta.inStock), inTransitDelta: Number(adjustDelta.inTransit) });
            }} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">Adjust In Stock (+ add / - remove)</label>
                  <input type="number" value={adjustDelta.inStock} onChange={e => setAdjustDelta({ ...adjustDelta, inStock: e.target.value })} placeholder="e.g. +5 or -2" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">Adjust In Transit</label>
                  <input type="number" value={adjustDelta.inTransit} onChange={e => setAdjustDelta({ ...adjustDelta, inTransit: e.target.value })} placeholder="e.g. +10" />
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button type="button" className="px-4 py-2 rounded-lg bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200 text-sm transition-all" onClick={() => setShowAdjustModal(false)}>Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 text-gray-100 text-sm font-medium transition-all" disabled={adjustMutation.isPending}>Apply Adjustment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
