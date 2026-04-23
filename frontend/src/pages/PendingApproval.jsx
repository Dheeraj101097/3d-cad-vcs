import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PendingApproval() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);

  const isRevoked = user?.role === 'revoked';

  const handleRefresh = async () => {
    setChecking(true);
    try {
      const updated = await refreshUser();
      if (updated && updated.role !== 'pending' && updated.role !== 'revoked') {
        navigate('/products', { replace: true });
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 16, padding: '48px 40px',
        maxWidth: 460, width: '100%', textAlign: 'center',
        boxShadow: 'var(--shadow-md)', border: '1px solid var(--border)',
      }}>
        <div style={{ fontSize: 48, marginBottom: 20 }}>
          {isRevoked ? '🚫' : '⏳'}
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 12 }}>
          {isRevoked ? 'Access Revoked' : 'Awaiting Approval'}
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.7, marginBottom: 8 }}>
          {isRevoked
            ? 'Your access to this workspace has been revoked by an administrator.'
            : `Your account (${user?.email}) has been registered successfully.`}
        </p>
        {!isRevoked && (
          <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.7, marginBottom: 32 }}>
            An admin needs to approve your request before you can access the workspace.
            Once approved, click <strong>Check Status</strong> below.
          </p>
        )}
        {isRevoked && (
          <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.7, marginBottom: 32 }}>
            Contact an administrator if you believe this is a mistake.
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!isRevoked && (
            <button
              className="btn-primary"
              style={{ width: '100%', padding: '11px 18px', fontSize: 14 }}
              onClick={handleRefresh}
              disabled={checking}
            >
              {checking ? 'Checking...' : '↻ Check Status'}
            </button>
          )}
          <button
            className="btn-ghost"
            style={{ width: '100%', padding: '11px 18px', fontSize: 14 }}
            onClick={logout}
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
