import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import PageLoading from '../components/PageLoading';

const getRoleStyle = (role) => ({
  pending:  { bg: '#f5e9d8', color: '#8a6535', label: 'Pending' },
  read:     { bg: '#e8f0eb', color: '#2d5040', label: 'Read' },
  write:    { bg: '#dce8f7', color: '#1e4477', label: 'Write' },
  admin:    { bg: '#f0e8f7', color: '#5c1e8a', label: 'Admin' },
  revoked:  { bg: '#fdf0ef', color: '#c0392b', label: 'Revoked' },
}[role] || { bg: '#f0f0f0', color: '#666', label: role });

const fetchUsers = () => axios.get('/api/admin/users').then(r => r.data);

export default function AdminPanel() {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(null); // { userId, role, name }

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: fetchUsers,
    refetchInterval: 30_000,
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }) => axios.patch(`/api/admin/users/${id}/role`, { role }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setConfirm(null);
    },
    onError: (e) => alert(e.response?.data?.message || 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => axios.delete(`/api/admin/users/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
    onError: () => alert('Delete failed'),
  });

  const applyRole = (id, role, name) => {
    if (role === 'revoked' || role === 'pending') {
      setConfirm({ id, role, name });
    } else {
      roleMutation.mutate({ id, role });
    }
  };

  const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  if (isLoading) return <PageLoading />;

  const pending  = users.filter(u => u.role === 'pending');
  const active   = users.filter(u => u.role === 'read' || u.role === 'write');
  const admins   = users.filter(u => u.role === 'admin');
  const revoked  = users.filter(u => u.role === 'revoked');

  const UserRow = ({ u }) => {
    const rs = getRoleStyle(u.role);
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 180px 110px auto',
        gap: 16, padding: '14px 20px',
        borderBottom: '1px solid var(--border)',
        alignItems: 'center', fontSize: 13,
      }}>
        <div>
          <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 14 }}>{u.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{u.email}</div>
          <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 2 }}>Joined {fmtDate(u.createdAt)}</div>
        </div>

        {/* Role actions */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {u.role === 'pending' && (
            <>
              <button className="btn-primary btn-sm" style={{ fontSize: 11 }} onClick={() => roleMutation.mutate({ id: u._id, role: 'read' })}>✓ Read</button>
              <button className="btn-primary btn-sm" style={{ fontSize: 11, background: 'var(--accent-light)' }} onClick={() => roleMutation.mutate({ id: u._id, role: 'write' })}>✓ Write</button>
            </>
          )}
          {(u.role === 'read' || u.role === 'write') && (
            <>
              {u.role !== 'read'  && <button className="btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => roleMutation.mutate({ id: u._id, role: 'read' })}>→ Read</button>}
              {u.role !== 'write' && <button className="btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => roleMutation.mutate({ id: u._id, role: 'write' })}>→ Write</button>}
              <button className="btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => roleMutation.mutate({ id: u._id, role: 'admin' })}>→ Admin</button>
              <button className="btn-danger btn-sm" style={{ fontSize: 11 }} onClick={() => applyRole(u._id, 'revoked', u.name)}>Revoke</button>
            </>
          )}
          {u.role === 'admin' && (
            <>
              <button className="btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => roleMutation.mutate({ id: u._id, role: 'write' })}>→ Write</button>
              <button className="btn-danger btn-sm" style={{ fontSize: 11 }} onClick={() => applyRole(u._id, 'revoked', u.name)}>Revoke</button>
            </>
          )}
          {u.role === 'revoked' && (
            <>
              <button className="btn-primary btn-sm" style={{ fontSize: 11 }} onClick={() => roleMutation.mutate({ id: u._id, role: 'read' })}>Restore Read</button>
              <button className="btn-primary btn-sm" style={{ fontSize: 11, background: 'var(--accent-light)' }} onClick={() => roleMutation.mutate({ id: u._id, role: 'write' })}>Restore Write</button>
            </>
          )}
        </div>

        {/* Current role badge */}
        <div>
          <span style={{
            display: 'inline-block', padding: '3px 10px', borderRadius: 999,
            fontSize: 11, fontWeight: 700, background: rs.bg, color: rs.color,
          }}>{rs.label}</span>
        </div>

        {/* Delete */}
        <button className="btn-danger btn-sm" style={{ fontSize: 11 }}
          onClick={() => { if (window.confirm(`Delete ${u.name}'s account permanently?`)) deleteMutation.mutate(u._id); }}>
          ✕
        </button>
      </div>
    );
  };

  const Section = ({ title, icon, items, emptyMsg }) => (
    <div className="version-list" style={{ marginBottom: 24 }}>
      <div className="version-list-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>{icon}</span>
        <span>{title}</span>
        <span style={{ marginLeft: 'auto', fontWeight: 400, color: 'var(--text-muted)', fontSize: 12 }}>{items.length} user{items.length !== 1 ? 's' : ''}</span>
      </div>
      {items.length === 0
        ? <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>{emptyMsg}</div>
        : items.map(u => <UserRow key={u._id} u={u} />)
      }
    </div>
  );

  return (
    <>
      <div className="page-header page-fade">
        <div>
          <h1>User Management</h1>
          <p className="page-subtitle">{users.length} registered user{users.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn-ghost" onClick={() => qc.invalidateQueries({ queryKey: ['admin-users'] })}>↻ Refresh</button>
      </div>

      <div className="page-fade">
        {pending.length > 0 && (
          <div style={{ background: '#f5e9d8', border: '1px solid #e8c97a', borderRadius: 10, padding: '12px 18px', marginBottom: 24, fontSize: 13, color: '#8a6535', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>⏳</span>
            <strong>{pending.length} pending request{pending.length !== 1 ? 's' : ''}</strong> waiting for your approval.
          </div>
        )}

        <Section title="Pending Approval" icon="⏳" items={pending} emptyMsg="No pending requests" />
        <Section title="Active Users" icon="✓" items={[...active, ...admins]} emptyMsg="No active users" />
        <Section title="Revoked" icon="🚫" items={revoked} emptyMsg="No revoked users" />
      </div>

      {/* Confirm dangerous role change */}
      {confirm && (
        <div className="modal-overlay" onClick={() => setConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Confirm Action</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
              {confirm.role === 'revoked'
                ? `This will block ${confirm.name} from accessing the workspace immediately.`
                : `This will change ${confirm.name}'s role to ${confirm.role}.`}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={() => setConfirm(null)}>Cancel</button>
              <button className="btn-danger" onClick={() => roleMutation.mutate({ id: confirm.id, role: confirm.role })} disabled={roleMutation.isPending}>
                {roleMutation.isPending ? 'Applying...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
