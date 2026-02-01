'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ParentLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'otp' | 'password'>('otp');
  const [form, setForm] = useState({ phone: '', email: '', password: '', otp: '' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    setError('');
    setMessage('');
    if (!form.phone.trim()) {
      setError('Mobile number is required.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/parent-otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: form.phone.trim() }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to send OTP');
      }
      setMessage('OTP sent. Please check your phone.');
    } catch (err: any) {
      setError(err?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    
    try {
      if (mode === 'otp') {
        if (!form.phone.trim() || !form.otp.trim()) {
          throw new Error('Mobile number and OTP are required.');
        }
        const res = await fetch('/api/auth/parent-otp/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: form.phone.trim(), code: form.otp.trim() }),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || 'OTP verification failed');
        }
      } else {
        if (!form.email.trim() || !form.password.trim()) {
          throw new Error('Email and password are required.');
        }
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: form.email.trim(), password: form.password }),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || 'Login failed');
        }
      }
      router.replace('/parent/dashboard');
    } catch (err) {
      setError((err as Error).message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen grid place-items-center bg-sand px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate/10 bg-white p-6 shadow-sm sm:p-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-ink">Parent Login</h1>
          <p className="mt-2 text-sm text-slate">Access your child's academic information</p>
        </div>

        <div className="mt-6 flex gap-2">
          <button
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              mode === 'otp' ? 'bg-ink text-white' : 'border border-slate/20 text-slate hover:bg-slate/5'
            }`}
            onClick={() => setMode('otp')}
            type="button"
          >
            Mobile + OTP
          </button>
          <button
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              mode === 'password' ? 'bg-ink text-white' : 'border border-slate/20 text-slate hover:bg-slate/5'
            }`}
            onClick={() => setMode('password')}
            type="button"
          >
            Email + Password
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {mode === 'otp' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-ink">Mobile Number</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="10-digit mobile number"
                  className="mt-1 w-full rounded-lg border border-slate/20 px-3 py-2.5 text-sm transition-colors focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink">OTP</label>
                <input
                  type="text"
                  value={form.otp}
                  onChange={(e) => setForm({ ...form, otp: e.target.value })}
                  placeholder="Enter 6-digit OTP"
                  className="mt-1 w-full rounded-lg border border-slate/20 px-3 py-2.5 text-sm transition-colors focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-ink">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="Enter your email"
                  className="mt-1 w-full rounded-lg border border-slate/20 px-3 py-2.5 text-sm transition-colors focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink">Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Enter your password"
                  className="mt-1 w-full rounded-lg border border-slate/20 px-3 py-2.5 text-sm transition-colors focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink"
                />
              </div>
            </>
          )}
          
          {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
          
          {mode === 'otp' && (
            <button
              type="button"
              className="w-full rounded-lg border border-slate/20 px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-slate/5"
              onClick={handleSendOtp}
              disabled={loading}
            >
              Send OTP
            </button>
          )}
        </form>
      </div>
    </main>
  );
}
