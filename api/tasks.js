import { put, head, del } from '@vercel/blob';

const BLOB_KEY = 'tasks.json';

async function getTasks() {
  try {
    // List blobs to find our tasks.json
    const { blobs } = await (await import('@vercel/blob')).list();
    const blob = blobs.find(b => b.pathname === BLOB_KEY);
    if (!blob) return { tasks: [] };
    const res = await fetch(blob.url);
    return await res.json();
  } catch {
    return { tasks: [] };
  }
}

async function saveTasks(data) {
  await put(BLOB_KEY, JSON.stringify(data, null, 2), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const data = await getTasks();
    return res.status(200).json(data);
  }

  if (req.method === 'PUT') {
    const data = req.body;
    await saveTasks(data);
    return res.status(200).json({ ok: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
