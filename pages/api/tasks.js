import { put, list } from '@vercel/blob';

const BLOB_KEY = 'tasks.json';

async function getTasks() {
  try {
    const { blobs } = await list();
    const blob = blobs.find(b => b.pathname === BLOB_KEY);
    if (!blob) return { tasks: [] };
    const res = await fetch(blob.url);
    return await res.json();
  } catch (e) {
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
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const pruned = data.tasks.filter(t =>
      t.status !== 'closed' || new Date(t.updated_at).getTime() > cutoff
    );
    if (pruned.length !== data.tasks.length) {
      await saveTasks({ tasks: pruned });
    }
    return res.status(200).json({ tasks: pruned });
  }

  if (req.method === 'PUT') {
    const data = req.body;
    await saveTasks(data);
    return res.status(200).json({ ok: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
