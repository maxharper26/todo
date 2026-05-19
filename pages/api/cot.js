import { list } from '@vercel/blob';

const BLOB_KEY = 'cot.json';

async function getCot() {
  try {
    const { blobs } = await list();
    const blob = blobs.find(b => b.pathname === BLOB_KEY);
    if (!blob) return { signals: [], last_updated: null };
    const res = await fetch(blob.url);
    return await res.json();
  } catch (e) {
    return { signals: [], last_updated: null };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'GET') return res.status(200).json(await getCot());
  res.status(405).json({ error: 'Method not allowed' });
}
