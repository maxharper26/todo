import { serialize } from 'cookie';

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { password } = req.body;

  if (!process.env.AUTH_PASSWORD) {
    return res.status(500).json({ error: 'AUTH_PASSWORD env var not set' });
  }

  console.log('[auth] password match:', password === process.env.AUTH_PASSWORD, '| AUTH_PASSWORD set:', !!process.env.AUTH_PASSWORD);

  if (password !== process.env.AUTH_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  const cookie = serialize('auth', 'ok', {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  res.setHeader('Set-Cookie', cookie);
  return res.status(200).json({ ok: true });
}
