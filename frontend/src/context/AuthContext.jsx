import { createContext, useContext, useState } from 'react';
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
export function usePermission() {
  const { user } = useAuth();
  const role = user?.role;
  return {
    canWrite:  role === 'write'  || role === 'admin',
    canDelete: role === 'admin',
    isAdmin:   role === 'admin',
  };
}
