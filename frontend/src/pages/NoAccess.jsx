import { useAuth } from '../context/AuthContext';

export default function NoAccess() {
  const { logout } = useAuth();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="text-5xl mb-5 opacity-30">🔒</div>
      <h1 className="text-xl font-semibold text-gray-200 mb-2">No pages assigned</h1>
      <p className="text-sm text-gray-500 mb-6 max-w-sm">
        You don't have access to any pages yet. Contact an admin to request access, or sign out and back in to refresh your permissions.
      </p>
      <button
        onClick={logout}
        className="px-4 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-gray-300 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/20 text-sm transition-all"
      >
        Sign out
      </button>
    </div>
  );
}
