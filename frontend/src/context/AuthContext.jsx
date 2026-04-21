import { createContext, useContext, useState } from 'react';
import axios from 'axios';

const AuthContext = createContext();

// Single interceptor — always reads the latest token from storage
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

  const login = async (email, password) => {
    const { data } = await axios.post('/api/auth/login', { email, password });
    localStorage.setItem('cad_token', data.token);
    localStorage.setItem('cad_user', JSON.stringify(data.user));
    setUser(data.user);
  };

  const register = async (name, email, password) => {
    const { data } = await axios.post('/api/auth/register', { name, email, password });
    localStorage.setItem('cad_token', data.token);
    localStorage.setItem('cad_user', JSON.stringify(data.user));
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('cad_token');
    localStorage.removeItem('cad_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
