import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (mode === 'login') await login(form.email, form.password);
      else await register(form.name, form.email, form.password);
      navigate('/products');
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-900 p-6 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-[-30%] left-[-10%] w-[600px] h-[600px] rounded-full bg-brand-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-gold/5 blur-[100px] pointer-events-none" />

      {/* Card */}
      <div className="relative w-full max-w-[420px] glass-strong rounded-2xl p-8 sm:p-10 shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-xl font-semibold text-gray-100 tracking-wide mb-1">
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </h1>
          <p className="text-sm text-gray-500">
            {mode === 'login' ? 'Sign in to your workspace' : 'Get started with CAD Portal'}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-5 px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={submit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">Full Name</label>
              <input placeholder="Your full name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            </div>
          )}
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">Email Address</label>
            <input type="email" placeholder="you@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-500 mb-1.5">Password</label>
            <input type="password" placeholder="••••••••" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
          </div>
          <button
            type="submit"
            className="w-full mt-2 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-400 text-gray-100 font-medium text-sm transition-all duration-200 shadow-lg shadow-brand-500/20"
          >
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {/* Toggle */}
        <p className="mt-6 text-center text-sm text-gray-500">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <a
            href="#"
            className="text-gold hover:text-gold-light font-medium"
            onClick={e => { e.preventDefault(); setMode(mode === 'login' ? 'register' : 'login'); }}
          >
            {mode === 'login' ? 'Register' : 'Sign in'}
          </a>
        </p>
      </div>
    </div>
  );
}
