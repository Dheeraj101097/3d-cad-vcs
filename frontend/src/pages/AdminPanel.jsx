import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import PageLoading from '../components/PageLoading';
import { RESOURCES, bitsToString, bitsBadgeClass } from '../config/resources';

const fetchUsers = () => axios.get('/api/admin/users').then(r => r.data);

const ROLE_BADGE = {
  pending:  'bg-gold/15 text-gold',
  active:   'bg-blue-500/15 text-blue-400',
  admin:    'bg-purple-500/15 text-purple-400',
  revoked:  'bg-red-500/15 text-red-400',
};

export default function AdminPanel() {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(null); // { id, role, name, action }

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: fetchUsers,
    refetchInterval: 30_000,
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }) => axios.patch(`/api/admin/users/${id}/role`, { role }).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); setConfirm(null); },
    onError: (e) => alert(e.response?.data?.message || 'Failed'),
  });

  const permMutation = useMutation({
    mutationFn: ({ id, resource, bits }) =>
      axios.patch(`/api/admin/users/${id}/permissions`, { resource, bits }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
    onError: (e) => alert(e.response?.data?.message || 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => axios.delete(`/api/admin/users/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
    onError: () => alert('Delete failed'),
  });

  const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const BtnPrimary = ({ children, ...props }) => (
    <button className="text-[11px] font-medium px-2.5 py-1 rounded-md bg-brand-500/80 text-gray-200 hover:bg-brand-500 transition-all disabled:opacity-50" {...props}>{children}</button>
  );
  const BtnGhost = ({ children, ...props }) => (
    <button className="text-[11px] px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.08] text-gray-400 hover:bg-white/[0.08] transition-all disabled:opacity-50" {...props}>{children}</button>
  );
  const BtnDanger = ({ children, ...props }) => (
    <button className="text-[11px] px-2.5 py-1 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50" {...props}>{children}</button>
  );

  if (isLoading) return <PageLoading />;

  const pending = users.filter(u => u.role === 'pending');
  const active  = users.filter(u => u.role === 'active');
  const admins  = users.filter(u => u.role === 'admin');
  const revoked = users.filter(u => u.role === 'revoked');

  const UserInfo = ({ u }) => (
    <div>
      <div className="font-medium text-gray-200 text-sm">{u.name}</div>
      <div className="text-xs text-gray-500 mt-0.5">{u.email}</div>
      <div className="text-[11px] text-gray-600 mt-0.5">Joined {fmtDate(u.createdAt)}</div>
    </div>
  );

  const PermMatrix = ({ u }) => (
    <div className="mt-3 pt-3 border-t border-white/[0.04]">
      <div className="text-[10px] uppercase tracking-wider text-gray-600 mb-2 font-medium">Page Permissions</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {RESOURCES.map(r => {
          const bits = u.permissions?.[r.key] ?? 0;
          return (
            <div key={r.key} className="flex flex-col items-start gap-1 p-2 rounded-lg border border-white/[0.05] bg-white/[0.02]">
              <span className="text-[10px] text-gray-500 font-medium">{r.label}</span>
              <span className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded ${bitsBadgeClass(bits)}`}>
                {bitsToString(bits)}
              </span>
              <select
                value={bits}
                onChange={e => permMutation.mutate({ id: u._id, resource: r.key, bits: Number(e.target.value) })}
                disabled={permMutation.isPending}
                className="text-[10px] mt-0.5 w-full rounded px-1.5 py-0.5 bg-white/[0.05] border border-white/[0.08] text-gray-300 focus:outline-none appearance-none cursor-pointer disabled:opacity-50"
              >
                <option value={0}>0 — none</option>
                <option value={4}>4 — read</option>
                <option value={6}>6 — read+write</option>
                <option value={7}>7 — read+write+del</option>
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );

  const Section = ({ title, badge, items, emptyMsg, renderItem }) => (
    <div className="glass rounded-xl overflow-hidden mb-5">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.06] bg-white/[0.03]">
        <span className="text-xs font-medium uppercase tracking-wider text-gray-400">{title}</span>
        {badge && <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${badge}`}>{items.length}</span>}
        <span className="ml-auto text-xs text-gray-600">{items.length} user{items.length !== 1 ? 's' : ''}</span>
      </div>
      {items.length === 0
        ? <div className="py-5 text-center text-sm text-gray-600">{emptyMsg}</div>
        : items.map(u => <div key={u._id} className="px-5 py-4 border-b border-white/[0.04] last:border-0">{renderItem(u)}</div>)
      }
    </div>
  );

  return (
    <>
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

        <Section
          title="Pending Approval"
          badge="bg-gold/15 text-gold"
          items={pending}
          emptyMsg="No pending requests"
          renderItem={(u) => (
            <div className="flex items-start justify-between gap-4">
              <UserInfo u={u} />
              <div className="flex gap-1.5 shrink-0">
                <BtnPrimary onClick={() => roleMutation.mutate({ id: u._id, role: 'active' })} disabled={roleMutation.isPending}>✓ Approve</BtnPrimary>
                <BtnDanger onClick={() => setConfirm({ id: u._id, role: 'revoked', name: u.name })}>Reject</BtnDanger>
                <BtnDanger onClick={() => { if (window.confirm(`Delete ${u.name}'s account permanently?`)) deleteMutation.mutate(u._id); }}>✕</BtnDanger>
              </div>
            </div>
          )}
        />

        <Section
          title="Active Users"
          badge="bg-blue-500/15 text-blue-400"
          items={active}
          emptyMsg="No active users yet"
          renderItem={(u) => (
            <div>
              <div className="flex items-start justify-between gap-4">
                <UserInfo u={u} />
                <div className="flex gap-1.5 shrink-0">
                  <BtnDanger onClick={() => setConfirm({ id: u._id, role: 'revoked', name: u.name })}>Revoke</BtnDanger>
                  <BtnDanger onClick={() => { if (window.confirm(`Delete ${u.name}'s account permanently?`)) deleteMutation.mutate(u._id); }}>✕</BtnDanger>
                </div>
              </div>
              <PermMatrix u={u} />
            </div>
          )}
        />

        <Section
          title="Admins"
          badge="bg-purple-500/15 text-purple-400"
          items={admins}
          emptyMsg="No other admins"
          renderItem={(u) => (
            <div className="flex items-start justify-between gap-4">
              <UserInfo u={u} />
              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${ROLE_BADGE.admin}`}>Admin</span>
            </div>
          )}
        />

        <Section
          title="Revoked"
          badge="bg-red-500/15 text-red-400"
          items={revoked}
          emptyMsg="No revoked users"
          renderItem={(u) => (
            <div className="flex items-start justify-between gap-4">
              <UserInfo u={u} />
              <div className="flex gap-1.5 shrink-0">
                <BtnGhost onClick={() => roleMutation.mutate({ id: u._id, role: 'active' })}>Restore</BtnGhost>
                <BtnDanger onClick={() => { if (window.confirm(`Delete ${u.name}'s account permanently?`)) deleteMutation.mutate(u._id); }}>✕</BtnDanger>
              </div>
            </div>
          )}
        />
      </div>

      {confirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setConfirm(null)}>
          <div className="glass-strong rounded-2xl p-7 w-[460px] max-w-[95vw] shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-100 mb-4">Confirm Action</h2>
            <p className="text-sm text-gray-400 mb-6">
              {confirm.role === 'revoked'
                ? `This will block ${confirm.name} from accessing the workspace immediately.`
                : `Restore ${confirm.name}'s access?`}
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
