import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import PageLoading from '../components/PageLoading';

const getRoleStyle = (role) => ({
  pending:  { cls: 'bg-gold/15 text-gold', label: 'Pending' },
  read:     { cls: 'bg-brand-500/20 text-brand-200', label: 'Read' },
  write:    { cls: 'bg-blue-500/15 text-blue-400', label: 'Write' },
  admin:    { cls: 'bg-purple-500/15 text-purple-400', label: 'Admin' },
  revoked:  { cls: 'bg-red-500/15 text-red-400', label: 'Revoked' },
}[role] || { cls: 'bg-white/[0.06] text-gray-400', label: role });

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

  const BtnPrimary = ({ children, ...props }) => (
    <button className="text-[11px] font-medium px-2.5 py-1 rounded-md bg-brand-500/80 text-gray-200 hover:bg-brand-500 transition-all" {...props}>{children}</button>
  );
  const BtnGhost = ({ children, ...props }) => (
    <button className="text-[11px] px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.08] text-gray-400 hover:bg-white/[0.08] transition-all" {...props}>{children}</button>
  );
  const BtnDanger = ({ children, ...props }) => (
    <button className="text-[11px] px-2.5 py-1 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all" {...props}>{children}</button>
  );

  const UserRow = ({ u }) => {
    const rs = getRoleStyle(u.role);
    return (
      <div className="grid grid-cols-[1fr_180px_110px_auto] gap-4 px-5 py-3.5 border-b border-white/[0.04] items-center text-[13px]">
        <div>
          <div className="font-medium text-gray-200 text-sm">{u.name}</div>
          <div className="text-xs text-gray-500 mt-0.5">{u.email}</div>
          <div className="text-[11px] text-gray-600 mt-0.5">Joined {fmtDate(u.createdAt)}</div>
        </div>

        {/* Role actions */}
        <div className="flex gap-1 flex-wrap">
          {u.role === 'pending' && (
            <>
              <BtnPrimary onClick={() => roleMutation.mutate({ id: u._id, role: 'read' })}>✓ Read</BtnPrimary>
              <BtnPrimary onClick={() => roleMutation.mutate({ id: u._id, role: 'write' })}>✓ Write</BtnPrimary>
            </>
          )}
          {(u.role === 'read' || u.role === 'write') && (
            <>
              {u.role !== 'read'  && <BtnGhost onClick={() => roleMutation.mutate({ id: u._id, role: 'read' })}>→ Read</BtnGhost>}
              {u.role !== 'write' && <BtnGhost onClick={() => roleMutation.mutate({ id: u._id, role: 'write' })}>→ Write</BtnGhost>}
              <BtnGhost onClick={() => roleMutation.mutate({ id: u._id, role: 'admin' })}>→ Admin</BtnGhost>
              <BtnDanger onClick={() => applyRole(u._id, 'revoked', u.name)}>Revoke</BtnDanger>
            </>
          )}
          {u.role === 'admin' && (
            <>
              <BtnGhost onClick={() => roleMutation.mutate({ id: u._id, role: 'write' })}>→ Write</BtnGhost>
              <BtnDanger onClick={() => applyRole(u._id, 'revoked', u.name)}>Revoke</BtnDanger>
            </>
          )}
          {u.role === 'revoked' && (
            <>
              <BtnPrimary onClick={() => roleMutation.mutate({ id: u._id, role: 'read' })}>Restore Read</BtnPrimary>
              <BtnPrimary onClick={() => roleMutation.mutate({ id: u._id, role: 'write' })}>Restore Write</BtnPrimary>
            </>
          )}
        </div>

        {/* Current role badge */}
        <div>
          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${rs.cls}`}>{rs.label}</span>
        </div>

        {/* Delete */}
        <BtnDanger onClick={() => { if (window.confirm(`Delete ${u.name}'s account permanently?`)) deleteMutation.mutate(u._id); }}>✕</BtnDanger>
      </div>
    );
  };

  const Section = ({ title, items, emptyMsg }) => (
    <div className="glass rounded-xl overflow-hidden mb-5">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.06] bg-white/[0.03]">
        <span className="text-xs font-medium uppercase tracking-wider text-gray-400">{title}</span>
        <span className="ml-auto text-xs text-gray-500">{items.length} user{items.length !== 1 ? 's' : ''}</span>
      </div>
      {items.length === 0
        ? <div className="py-5 text-center text-sm text-gray-500">{emptyMsg}</div>
        : items.map(u => <UserRow key={u._id} u={u} />)
      }
    </div>
  );

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-7 animate-fade-in">
        <div>
          <h1 className="text-2xl font-semibold text-gray-100 tracking-tight">User Management</h1>
          <p className="text-sm text-gray-500 mt-1">{users.length} registered user{users.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          className="px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-gray-400 hover:bg-white/[0.08] hover:text-gray-200 text-sm transition-all"
          onClick={() => qc.invalidateQueries({ queryKey: ['admin-users'] })}
        >↻ Refresh</button>
      </div>

      <div className="animate-fade-in">
        {pending.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 mb-5 rounded-xl bg-gold/10 border border-gold/20 text-sm text-gold">
            <strong>{pending.length} pending request{pending.length !== 1 ? 's' : ''}</strong> waiting for your approval.
          </div>
        )}

        <Section title="Pending Approval" items={pending} emptyMsg="No pending requests" />
        <Section title="Active Users" items={[...active, ...admins]} emptyMsg="No active users" />
        <Section title="Revoked" items={revoked} emptyMsg="No revoked users" />
      </div>

      {/* Confirm dangerous role change */}
      {confirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setConfirm(null)}>
          <div className="glass-strong rounded-2xl p-7 w-[460px] max-w-[95vw] shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-100 mb-4">Confirm Action</h2>
            <p className="text-sm text-gray-400 mb-6">
              {confirm.role === 'revoked'
                ? `This will block ${confirm.name} from accessing the workspace immediately.`
                : `This will change ${confirm.name}'s role to ${confirm.role}.`}
            </p>
            <div className="flex gap-2 justify-end">
              <button className="px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-gray-400 hover:bg-white/[0.08] text-sm transition-all" onClick={() => setConfirm(null)}>Cancel</button>
              <button className="px-4 py-2 rounded-lg bg-red-500/80 hover:bg-red-500 text-gray-100 text-sm font-medium transition-all" onClick={() => roleMutation.mutate({ id: confirm.id, role: confirm.role })} disabled={roleMutation.isPending}>
                {roleMutation.isPending ? 'Applying...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
