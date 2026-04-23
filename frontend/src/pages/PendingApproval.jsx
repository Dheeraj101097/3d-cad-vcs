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
    <div className="min-h-screen flex items-center justify-center bg-brand-900 p-6 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-[-30%] left-[-10%] w-[600px] h-[600px] rounded-full bg-brand-500/10 blur-[120px] pointer-events-none" />

      <div className="relative w-full max-w-[440px] glass-strong rounded-2xl p-10 shadow-2xl text-center animate-fade-in">
        <div className="text-5xl mb-5">
          {isRevoked ? '🚫' : '⏳'}
        </div>
        <h1 className="text-xl font-semibold text-gray-100 mb-3">
          {isRevoked ? 'Access Revoked' : 'Awaiting Approval'}
        </h1>
        <p className="text-sm text-gray-400 leading-relaxed mb-2">
          {isRevoked
            ? 'Your access to this workspace has been revoked by an administrator.'
            : `Your account (${user?.email}) has been registered successfully.`}
        </p>
        {!isRevoked && (
          <p className="text-sm text-gray-400 leading-relaxed mb-8">
            An admin needs to approve your request before you can access the workspace.
            Once approved, click <strong className="text-gray-200">Check Status</strong> below.
          </p>
        )}
        {isRevoked && (
          <p className="text-sm text-gray-400 leading-relaxed mb-8">
            Contact an administrator if you believe this is a mistake.
          </p>
        )}

        <div className="flex flex-col gap-3">
          {!isRevoked && (
            <button
              className="w-full py-2.5 rounded-lg bg-brand-500 hover:bg-brand-400 text-gray-100 font-medium text-sm transition-all shadow-lg shadow-brand-500/20"
              onClick={handleRefresh}
              disabled={checking}
            >
              {checking ? 'Checking...' : '↻ Check Status'}
            </button>
          )}
          <button
            className="w-full py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-gray-400 hover:bg-white/[0.08] hover:text-gray-200 font-medium text-sm transition-all"
            onClick={logout}
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
