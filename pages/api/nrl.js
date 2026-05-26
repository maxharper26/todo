import { head } from '@vercel/blob';

const BLOB_PATHNAME = 'nrl_rounds.json';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const blob = await head(BLOB_PATHNAME);
    const response = await fetch(blob.url);
    if (!response.ok) throw new Error(`Blob fetch failed: ${response.status}`);
    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    console.error('NRL API error:', err);
    res.status(500).json({ error: err.message });
  }
}
