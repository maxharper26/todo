import { serialize } from 'cookie';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS   = 15 * 60 * 1000; // 15 min

// Module-level — persists across warm invocations, resets on cold start
const attempts = {}; // { [ip]: { count, lockedUntil } }

function getIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
}

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  if (!process.env.AUTH_PASSWORD) {
    return res.status(500).json({ error: 'AUTH_PASSWORD env var not set' });
  }

  const ip = getIp(req);
  const now = Date.now();
  const state = attempts[ip] || { count: 0, lockedUntil: 0 };

  if (state.lockedUntil > now) {
    const mins = Math.ceil((state.lockedUntil - now) / 60000);
    return res.status(429).json({ error: `Too many attempts. Try again in ${mins} min.` });
  }

  const { password } = req.body;

  if (password !== process.env.AUTH_PASSWORD) {
    state.count += 1;
    if (state.count >= MAX_ATTEMPTS) {
      state.lockedUntil = now + LOCKOUT_MS;
      state.count = 0;
      attempts[ip] = state;
      return res.status(429).json({ error: 'Too many attempts. Locked for 15 min.' });
    }
    attempts[ip] = state;
    const remaining = MAX_ATTEMPTS - state.count;
    return res.status(401).json({ error: `Incorrect password. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` });
  }

  // Success — clear attempts
  delete attempts[ip];

  const cookie = serialize('auth', 'ok', {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  res.setHeader('Set-Cookie', cookie);
  return res.status(200).json({ ok: true });
}
