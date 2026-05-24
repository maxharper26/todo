import { useState } from 'react';
import { useRouter } from 'next/router';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        const from = router.query.from || '/stocks';
        router.push(from);
      } else {
        setError('Incorrect password.');
        setPassword('');
      }
    } catch {
      setError('Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0a0a0f', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <div style={{
        background: '#111118', border: '1px solid #1e1e2e', borderRadius: 10,
        padding: 32, width: 340, maxWidth: '90vw',
        boxShadow: '0 8px 40px rgba(0,0,0,.6)',
      }}>
        <h1 style={{ color: '#e2e8f0', fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Dashboard</h1>
        <p style={{ color: '#64748b', fontSize: '0.82rem', marginBottom: 24 }}>Enter password to continue.</p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoFocus
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 6, fontSize: '0.9rem',
              background: '#16161f', border: '1px solid #2a2a3d', color: '#e2e8f0',
              marginBottom: 12, boxSizing: 'border-box', outline: 'none',
            }}
          />
          {error && <p style={{ color: '#ef4444', fontSize: '0.8rem', marginBottom: 10 }}>{error}</p>}
          <button
            type="submit"
            disabled={loading || !password}
            style={{
              width: '100%', padding: '10px 0', borderRadius: 6, fontSize: '0.88rem',
              fontWeight: 600, cursor: loading || !password ? 'not-allowed' : 'pointer',
              background: '#6366f1', border: 'none', color: '#fff',
              opacity: loading || !password ? 0.6 : 1,
            }}
          >{loading ? 'Checking…' : 'Sign in'}</button>
        </form>
      </div>
    </div>
  );
}
