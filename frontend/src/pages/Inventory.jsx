import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageLoading from '../components/PageLoading';
import { usePermission } from '../context/AuthContext';
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 480 }} onClick={e => e.stopPropagation()}>
        <h2>Manage Types</h2>
        <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {types.map(t => (
            <div key={t._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--surface2)', borderRadius: 8 }}>
              <span style={{ fontSize: 18 }}>{t.icon}</span>
              <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{t.name}</span>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: t.color, border: '1px solid #aaa' }} />
              <button className="btn-danger btn-sm" onClick={() => deleteMutation.mutate(t._id)}>✕</button>
            </div>
          ))}
          {types.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No types yet.</p>}
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Add New Type</div>
          {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 10 }}>{error}</div>}
          <form onSubmit={e => { e.preventDefault(); createMutation.mutate(form); }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'end' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Type Name</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. filament" required />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Icon</label>
                <select value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} style={{ width: 70 }}>
                  {/* {EMOJI_OPTIONS.map(e => <option key={e} value={e}>{e}</option>)} */}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Color</label>
                <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} style={{ width: 50, height: 38, padding: 2, cursor: 'pointer' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button type="button" className="btn-ghost" onClick={onClose}>Done</button>
              <button type="submit" className="btn-primary" disabled={createMutation.isPending}>Add Type</button>
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
    <div style={{
      background: '#fdf0ef', border: '1px solid #f5c6c2', borderRadius: 10,
      padding: '14px 18px', marginBottom: 24, display: 'flex', alignItems: 'flex-start', gap: 14
    }}>
      <div style={{ fontSize: 20 }}>⚠️</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, color: '#c0392b', fontSize: 14, marginBottom: 6 }}>
          {alerts.count} component{alerts.count > 1 ? 's' : ''} below minimum threshold
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {alerts.items.map(item => (
            <div key={item._id} style={{
              background: '#fff', border: '1px solid #f5c6c2', borderRadius: 6,
              padding: '4px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8
            }}>
              <span style={{ fontWeight: 700, color: '#c0392b' }}>{item.code}</span>
              <span>{item.name}</span>
              <span style={{ color: '#c0392b' }}>{item.inStock} / {item.minThreshold} {item.unit}</span>
              {onAck && <button
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c0392b', fontSize: 12, padding: 0, fontWeight: 600 }}
                onClick={() => onAck(item._id)}
              >Ack</button>}
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
    <div style={{ position: 'relative', height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'visible', marginTop: 4 }}>
      <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${stockPct}%`, background: isLow ? '#ef4444' : 'var(--accent)', borderRadius: 3, transition: 'width 0.3s' }} />
      <div style={{ position: 'absolute', left: `${stockPct}%`, top: 0, height: '100%', width: `${transitPct}%`, background: 'var(--gold)', opacity: 0.6, borderRadius: 3 }} />
      <div style={{ position: 'absolute', left: `${thresholdPct}%`, top: -3, width: 2, height: 12, background: '#ef4444', borderRadius: 1 }} title={`Min: ${minThreshold}`} />
    </div>
  );
}

// ── ComponentRow ───────────────────────────────────────────────────────────────
function ComponentRow({ comp, onEdit, onAdjust, onDelete, onAck }) {
  const isLow = comp.inStock < comp.minThreshold;
  const isAlert = comp.alertTriggered && !comp.alertAcknowledged;
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '90px 1fr 100px 100px 100px 90px 120px',
      gap: 12, padding: '12px 18px', borderBottom: '1px solid var(--border)',
      alignItems: 'center', fontSize: 13,
      background: isAlert ? '#fff8f8' : 'transparent'
    }}>
      <div>
        <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: 'var(--gold)', background: 'var(--surface2)', padding: '2px 6px', borderRadius: 4 }}>
          {comp.code}
        </span>
      </div>
      <div>
        <div style={{ fontWeight: 600, color: 'var(--text)' }}>{comp.name}</div>
        {comp.supplier && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{comp.supplier}</div>}
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 700, color: isLow ? '#ef4444' : 'var(--text)', fontSize: 15 }}>{comp.inStock}</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{comp.unit}</span>
          {isAlert && <span style={{ fontSize: 10, background: '#fdf0ef', color: '#c0392b', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>LOW</span>}
        </div>
        <StockBar inStock={comp.inStock} inTransit={comp.inTransit} minThreshold={comp.minThreshold} />
      </div>
      <div style={{ color: 'var(--text-muted)' }}>
        {comp.inTransit > 0
          ? <span style={{ color: 'var(--gold)', fontWeight: 600 }}>{comp.inTransit} <span style={{ fontSize: 11 }}>{comp.unit}</span></span>
          : <span style={{ color: 'var(--text-light)' }}>—</span>
        }
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        Min: <span style={{ fontWeight: 600, color: 'var(--text)' }}>{comp.minThreshold}</span> {comp.unit}
      </div>
      <div>
        {isAlert
          ? (onAck
              ? <button className="btn-sm" style={{ background: '#fdf0ef', color: '#c0392b', border: '1px solid #f5c6c2', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700 }} onClick={() => onAck(comp._id)}>Acknowledge</button>
              : <span style={{ fontSize: 11, color: '#c0392b', fontWeight: 700 }}>LOW</span>)
          : <span className="badge badge-green" style={{ fontSize: 10 }}>OK</span>
        }
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {onAdjust && <button className="btn-ghost btn-sm" onClick={() => onAdjust(comp)} title="Adjust stock">±</button>}
        {onEdit && <button className="btn-ghost btn-sm" onClick={() => onEdit(comp)}>Edit</button>}
        {onDelete && <button className="btn-danger btn-sm" onClick={() => onDelete(comp._id)}>✕</button>}
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
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 14px', cursor: 'pointer',
          background: isTypeActive ? 'var(--surface2)' : 'transparent',
          borderBottom: '1px solid var(--border)', userSelect: 'none'
        }}
        onClick={() => { onSelectType(); setOpen(true); }}
      >
        <span
          style={{ fontSize: 11, color: 'var(--text-muted)', transition: 'transform 0.15s', display: 'inline-block', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
          onClick={e => { e.stopPropagation(); setOpen(!open); }}
        >▶</span>
        {/* <span style={{ fontSize: 16 }}>{type.icon}</span> */}
        <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.05em', flex: 1 }}>
          {getLabel(type.name)}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{typeCount}</span>
      </div>
      {open && groups.map(g => {
        const count = components.filter(c => c.group?._id === g._id).length;
        const isActive = activeGroup === g._id;
        return (
          <div
            key={g._id}
            onClick={() => onSelectGroup(g._id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 14px 7px 32px', cursor: 'pointer',
              background: isActive ? '#e8f0eb' : 'transparent',
              borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
              borderBottom: '1px solid var(--border)', transition: 'background 0.1s'
            }}
          >
            <span style={{ flex: 1, fontSize: 13, fontWeight: isActive ? 700 : 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {g.name}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{count}</span>
            <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
              {onEditGroup && <button className="btn-ghost btn-sm" style={{ fontSize: 10, padding: '1px 5px' }}
                onClick={e => { e.stopPropagation(); onEditGroup(g); }}>✎</button>}
              {onDeleteGroup && <button className="btn-danger btn-sm" style={{ fontSize: 10, padding: '1px 5px' }}
                onClick={e => { e.stopPropagation(); onDeleteGroup(g._id); }}>✕</button>}
            </div>
          </div>
        );
      })}
      {open && groups.length === 0 && (
        <div style={{ padding: '6px 14px 6px 32px', fontSize: 11, color: 'var(--text-light)', borderBottom: '1px solid var(--border)' }}>
          No groups
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function Inventory() {
  const qc = useQueryClient();
  const { canWrite, canDelete } = usePermission();

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

  const deleteGroup = (id) => {
    if (!confirm('Delete this group and all its components?')) return;
    deleteGroupMutation.mutate(id);
  };

  const deleteComp = (id) => {
    if (!confirm('Delete this component?')) return;
    deleteCompMutation.mutate(id);
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
    <>
      <div className="page-header page-fade">
        <div>
          <h1>Inventory</h1>
          <p className="page-subtitle">{components.length} components · {groups.length} groups</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {canWrite && <button className="btn-ghost" onClick={() => setShowTypeManager(true)}>⚙ Types</button>}
          {canWrite && <button className="btn-ghost" onClick={openNewGroup}>+ New Group</button>}
          {canWrite && <button className="btn-primary" onClick={openNewComp} disabled={groups.length === 0}>+ Add Component</button>}
        </div>
      </div>

      <AlertBanner alerts={alerts} onAck={canWrite ? (id) => ackMutation.mutate(id) : undefined} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total Components', value: components.length },
          { label: 'Total In Stock',   value: totalStock },
          { label: 'In Transit',       value: totalTransit },
          { label: 'Low Stock Alerts', value: alerts.count, danger: alerts.count > 0 }
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign: 'center', padding: '16px' }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.danger ? '#ef4444' : 'var(--accent)' }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Sidebar */}
        <div className="version-list">
          <div className="version-list-header">Groups</div>
          <div
            className={`version-row${!activeGroup && !activeType ? ' active' : ''}`}
            style={{ cursor: 'pointer' }}
            onClick={clearSelection}
          >
            <span style={{ fontWeight: 600, fontSize: 13 }}>All Components</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{components.length} items</span>
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
            <div style={{ padding: '16px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
              No groups yet. Click "+ New Group".
            </div>
          )}
        </div>

        {/* Component table */}
        <div className="version-list">
          <div className="version-list-header" style={{ display: 'grid', gridTemplateColumns: '90px 1fr 100px 100px 100px 90px 120px', gap: 12 }}>
            <span>Code</span><span>Component</span><span>In Stock</span><span>In Transit</span><span>Min Level</span><span>Status</span><span>Actions</span>
          </div>
          {componentsLoading && (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              <div className="page-loading-spinner" style={{ margin: '0 auto 8px' }} />
              Loading...
            </div>
          )}
          {!componentsLoading && filteredComponents.length === 0 && (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
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
        <div className="modal-overlay" onClick={() => setShowGroupModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editGroup ? 'Edit Group' : 'New Group'}</h2>
            <form onSubmit={e => { e.preventDefault(); saveGroupMutation.mutate(groupForm); }}>
              <div className="form-group">
                <label>Group Name</label>
                <input value={groupForm.name} onChange={e => setGroupForm({ ...groupForm, name: e.target.value })} required placeholder="e.g. PLA Filaments" />
              </div>
              <div className="form-group">
                <label>Type</label>
                <select value={groupForm.type} onChange={e => setGroupForm({ ...groupForm, type: e.target.value })}>
                  {types.map(t => <option key={t._id} value={t.name}>{t.icon} {getLabel(t.name)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea rows={2} value={groupForm.description} onChange={e => setGroupForm({ ...groupForm, description: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowGroupModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saveGroupMutation.isPending}>
                  {editGroup ? 'Save' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Component Modal */}
      {showCompModal && (
        <div className="modal-overlay" onClick={() => setShowCompModal(false)}>
          <div className="modal" style={{ width: 520 }} onClick={e => e.stopPropagation()}>
            <h2>{editComp ? 'Edit Component' : 'Add Component'}</h2>
            <form onSubmit={e => { e.preventDefault(); saveCompMutation.mutate({ ...compForm, group: compForm.group || activeGroup || groups[0]?._id }); }}>
              {!editComp && (
                <div className="form-group">
                  <label>Group</label>
                  <select value={compForm.group} onChange={e => setCompForm({ ...compForm, group: e.target.value })}>
                    {groups.map(g => <option key={g._id} value={g._id}>{getIcon(g.type)} {g.name}</option>)}
                  </select>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Component Name</label>
                  <input value={compForm.name} onChange={e => setCompForm({ ...compForm, name: e.target.value })} required placeholder="e.g. PLA White 1kg" />
                </div>
                <div className="form-group">
                  <label>Unit</label>
                  <select value={compForm.unit} onChange={e => setCompForm({ ...compForm, unit: e.target.value })}>
                    {['pcs', 'kg', 'g', 'm', 'rolls', 'boxes', 'liters', 'sets'].map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>In Stock</label>
                  <input type="number" min="0" value={compForm.inStock} onChange={e => setCompForm({ ...compForm, inStock: Number(e.target.value) })} />
                </div>
                <div className="form-group">
                  <label>In Transit</label>
                  <input type="number" min="0" value={compForm.inTransit} onChange={e => setCompForm({ ...compForm, inTransit: Number(e.target.value) })} />
                </div>
                <div className="form-group">
                  <label>Min Threshold (alert below)</label>
                  <input type="number" min="0" value={compForm.minThreshold} onChange={e => setCompForm({ ...compForm, minThreshold: Number(e.target.value) })} />
                </div>
                <div className="form-group">
                  <label>Supplier</label>
                  <input value={compForm.supplier} onChange={e => setCompForm({ ...compForm, supplier: e.target.value })} placeholder="Optional" />
                </div>
              </div>
              <div className="form-group">
                <label>Description / Notes</label>
                <textarea rows={2} value={compForm.notes} onChange={e => setCompForm({ ...compForm, notes: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowCompModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saveCompMutation.isPending}>
                  {editComp ? 'Save Changes' : 'Add Component'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {showAdjustModal && adjustComp && (
        <div className="modal-overlay" onClick={() => setShowAdjustModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Adjust Stock — {adjustComp.name}</h2>
            <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '12px 14px', marginBottom: 20, fontSize: 13 }}>
              <div style={{ display: 'flex', gap: 24 }}>
                <span>Current stock: <strong>{adjustComp.inStock} {adjustComp.unit}</strong></span>
                <span>In transit: <strong>{adjustComp.inTransit} {adjustComp.unit}</strong></span>
                <span>Min: <strong>{adjustComp.minThreshold} {adjustComp.unit}</strong></span>
              </div>
            </div>
            <form onSubmit={e => {
              e.preventDefault();
              adjustMutation.mutate({ id: adjustComp._id, inStockDelta: Number(adjustDelta.inStock), inTransitDelta: Number(adjustDelta.inTransit) });
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Adjust In Stock (+ add / - remove)</label>
                  <input type="number" value={adjustDelta.inStock} onChange={e => setAdjustDelta({ ...adjustDelta, inStock: e.target.value })} placeholder="e.g. +5 or -2" />
                </div>
                <div className="form-group">
                  <label>Adjust In Transit</label>
                  <input type="number" value={adjustDelta.inTransit} onChange={e => setAdjustDelta({ ...adjustDelta, inTransit: e.target.value })} placeholder="e.g. +10" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowAdjustModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={adjustMutation.isPending}>Apply Adjustment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
