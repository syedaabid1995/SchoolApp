'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '../../services/auth.service';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login({ email, password, schoolId: schoolId || undefined });
      router.replace('/dashboard');
    } catch (err) {
      setError('Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen grid place-items-center bg-sand">
      <div className="w-full max-w-md rounded-2xl border border-slate/10 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-ink">Admin Login</h1>
        <p className="mt-2 text-sm text-slate">Sign in to manage your institution.</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink">School ID (optional)</label>
            <input
              type="text"
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate/20 px-3 py-2 text-sm"
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </main>
  );
}
