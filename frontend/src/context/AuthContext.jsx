import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('cad_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const u = localStorage.getItem('cad_user');
    return u ? JSON.parse(u) : null;
  });
  const [ready, setReady] = useState(false);

  // On every app load, refresh from server so role + permissions are always current.
  // This also handles users with stale localStorage (e.g. old role='read' before RBAC).
  useEffect(() => {
    const token = localStorage.getItem('cad_token');
    if (!token) { setReady(true); return; }
    axios.get('/api/auth/me')
      .then(({ data }) => {
        const stored = localStorage.getItem('cad_user');
        const updated = { ...(stored ? JSON.parse(stored) : {}), ...data };
        localStorage.setItem('cad_user', JSON.stringify(updated));
        setUser(updated);
      })
      .catch(() => {
        localStorage.removeItem('cad_token');
        localStorage.removeItem('cad_user');
        setUser(null);
      })
      .finally(() => setReady(true));
  }, []);

  if (!ready) return null;

  const _persist = (token, userData) => {
    localStorage.setItem('cad_token', token);
    localStorage.setItem('cad_user', JSON.stringify(userData));
    setUser(userData);
  };

  const login = async (email, password) => {
    const { data } = await axios.post('/api/auth/login', { email, password });
    _persist(data.token, data.user);
  };

  const register = async (name, email, password) => {
    const { data } = await axios.post('/api/auth/register', { name, email, password });
    _persist(data.token, data.user);
  };

  const logout = () => {
    localStorage.removeItem('cad_token');
    localStorage.removeItem('cad_user');
    setUser(null);
  };

  // Call this to re-fetch the user's latest role from the server
  // (e.g. pending user waiting for approval hits "Refresh")
  const refreshUser = async () => {
    try {
      const { data } = await axios.get('/api/auth/me');
      const updated = { ...user, ...data };
      localStorage.setItem('cad_user', JSON.stringify(updated));
      setUser(updated);
      return updated;
    } catch {
      logout();
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

// Convenience hook — import this in any component that needs permission checks
export function usePermission(resource) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  if (!resource) return { canWrite: isAdmin, canDelete: isAdmin, isAdmin };
  if (isAdmin) return { canRead: true, canWrite: true, canDelete: true, isAdmin: true };
  const bits = user?.permissions?.[resource] ?? 0;
  return {
    canRead:   !!(bits & 4),
    canWrite:  !!(bits & 2),
    canDelete: !!(bits & 1),
    isAdmin:   false,
  };
}
