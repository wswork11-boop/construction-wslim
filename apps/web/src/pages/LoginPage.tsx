import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { authStore } from '../lib/auth';

const REMEMBERED_EMAIL_KEY = 'construction_remembered_email';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const savedEmail =
    typeof window !== 'undefined' ? localStorage.getItem(REMEMBERED_EMAIL_KEY) || '' : '';

  const [email, setEmail] = useState(savedEmail);
  const [password, setPassword] = useState('');
  const [rememberEmail, setRememberEmail] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const cleanEmail = email.trim();
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: cleanEmail, password, deviceName: 'Office Web' }),
      });
      if (typeof window !== 'undefined') {
        if (rememberEmail) {
          localStorage.setItem(REMEMBERED_EMAIL_KEY, cleanEmail);
        } else {
          localStorage.removeItem(REMEMBERED_EMAIL_KEY);
        }
      }
      authStore.setSession({
        user: res.user,
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
      });
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div className="card" style={{ width: '100%', maxWidth: 380, padding: 24 }}>
        <h1 style={{ marginBottom: 4 }}>Construction System</h1>
        <p className="muted small" style={{ marginTop: 0, marginBottom: 18 }}>
          Sign in to the office portal
        </p>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              name="email"
              autoComplete="username"
              placeholder="you@company.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 4,
              marginBottom: 8,
            }}
          >
            <input
              id="remember-email"
              type="checkbox"
              checked={rememberEmail}
              onChange={(e) => setRememberEmail(e.target.checked)}
              style={{ width: 'auto', margin: 0 }}
            />
            <label
              htmlFor="remember-email"
              style={{ margin: 0, fontWeight: 400, cursor: 'pointer' }}
            >
              Remember my email
            </label>
          </div>
          <button
            type="submit"
            className="btn pri"
            disabled={loading}
            style={{ width: '100%', marginTop: 8 }}
          >
            {loading ? 'Signing in...' : 'Log in'}
          </button>
        </form>
      </div>
    </div>
  );
};
