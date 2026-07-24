import { put, head } from '@vercel/blob';

const BLOB_KEY = 'portfolio.json';

async function getTrades() {
  try {
    const blob = await head(BLOB_KEY);
    const res = await fetch(blob.url, { cache: 'no-store' });
    return await res.json();
  } catch (e) {
    return [];
  }
}

async function saveTrades(trades) {
  await put(BLOB_KEY, JSON.stringify(trades, null, 2), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const trades = await getTrades();
    return res.status(200).json(trades);
  }

  if (req.method === 'POST') {
    const { ticker, date, price, units, action, sector } = req.body;
    if (!ticker || !date || price == null || units == null || !action) {
      return res.status(400).json({ error: 'Missing required fields: ticker, date, price, units, action' });
    }
    const trades = await getTrades();
    const newTrade = {
      id: crypto.randomUUID(),
      ticker: ticker.trim().toUpperCase(),
      date,
      price: Number(price),
      units: Number(units),
      action,
      sector: sector || null,
    };
    trades.push(newTrade);
    await saveTrades(trades);
    return res.status(201).json(newTrade);
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const trades = await getTrades();
    const updated = trades.filter(t => t.id !== id);
    if (updated.length === trades.length) return res.status(404).json({ error: 'Trade not found' });
    await saveTrades(updated);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
