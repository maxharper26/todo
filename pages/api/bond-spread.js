import { list } from '@vercel/blob';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const { blobs } = await list();
    const blob = blobs.find(b => b.pathname === 'bond-spread.json');
    if (!blob) return res.status(404).json({ error: 'bond-spread.json not found' });
    const data = await (await fetch(blob.url)).json();
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
