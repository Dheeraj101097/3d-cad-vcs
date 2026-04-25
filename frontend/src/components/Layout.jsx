import { useEffect, Suspense } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useAuth, usePermission } from "../context/AuthContext";
import { RESOURCES } from "../config/resources";

export default function Layout() {
  const { user, logout } = useAuth();
  const { isAdmin } = usePermission();
  const { pathname } = useLocation();

  const visibleResources = user?.role === 'admin'
    ? RESOURCES
    : RESOURCES.filter(r => !!((user?.permissions?.[r.key] ?? 0) & 4));
  const initials =
    user?.name
      ?.split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U";

  // Scroll to top on every route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const handleRefreshPage = () => {
    window.location.reload();
  };

  return (
    <div className="flex min-h-screen">
      {/* ── Sidebar ───────────────────────────────────────────── */}
      <aside className="w-[230px] fixed top-0 left-0 bottom-0 flex flex-col bg-brand-900 backdrop-blur-2xl border-r border-white/[0.06] z-20">
        {/* Logo */}
        <div className="px-5 pt-7 pb-6">
          <span className="text-base font-semibold tracking-wide text-gray-100">
            URBANNOOK VCS
          </span>
        </div>

        {/* Section label */}
        {/* <div className="px-5 pt-3 pb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-gray-500">
          Navigation
        </div> */}

        {/* Nav links */}
        <nav className="flex flex-col gap-0.5 px-3 flex-1">
          {visibleResources.map(r => (
            <NavLink
              key={r.key}
              to={r.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 ${isActive ? "bg-gold/10 text-gold" : "text-gray-500 hover:bg-white/[0.05] hover:text-gray-200"}`
              }
            >
              {r.label}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 ${isActive ? "bg-gold/10 text-gold" : "text-gray-500 hover:bg-white/[0.05] hover:text-gray-200"}`
              }
            >
              Admin
            </NavLink>
          )}
        </nav>

        {/* Footer */}
        <div className="mt-auto border-t border-white/[0.06] px-4 py-4 space-y-3">
          {/* User info */}
          <div className="flex items-center gap-3 px-1">
            <div className="w-8 h-8 rounded-full bg-gold/80 flex items-center justify-center text-xs font-semibold text-white flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium text-gray-200 truncate">
                {user?.name}
              </div>
              <div className="text-[11px] text-gray-500 capitalize">
                {user?.role}
              </div>
            </div>
          </div>
          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleRefreshPage}
              className="flex-1 text-xs px-3 py-1.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-gray-400 hover:bg-white/[0.08] hover:text-gray-200 transition-all"
              title="Refresh page"
            >
              ↻ Refresh
            </button>
            <button
              onClick={logout}
              className="flex-1 text-xs px-3 py-1.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-gray-400 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/20 transition-all"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────── */}
      <main className="ml-[230px] flex-1 min-h-screen p-8 lg:p-10 bg-brand-800 dark:bg-brand-900">
        <Suspense
          fallback={
            <div className="py-12 px-8 text-gray-500 text-sm">Loading...</div>
          }
        >
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
