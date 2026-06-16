// GET /api/indices — returns 1d % change for S&P 500 and ASX 200
// Uses Yahoo Finance v8 chart endpoint (same as rest of app — no auth required).

const SYMBOLS = [
  { symbol: '^GSPC', label: 'S&P 500' },
  { symbol: '^AXJO', label: 'ASX 200' },
  { symbol: 'QQQ',   label: 'QQQ' },
  { symbol: '^VIX',  label: 'VIX' },
  { symbol: 'GLD',   label: 'Gold' },
  { symbol: 'DX-Y.NYB', label: 'DXY' },
  { symbol: 'AUDUSD=X', label: 'AUD/USD' },
];

async function fetchChange(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d&includePrePost=false`;
  const r = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; unified-app/1.0)' },
  });
  if (!r.ok) throw new Error(`Yahoo ${r.status} for ${symbol}`);
  const json = await r.json();
  const closes = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
  const valid = closes.filter(c => c != null);
  if (valid.length < 2) return null;
  const prev = valid[valid.length - 2];
  const curr = valid[valid.length - 1];
  return (curr - prev) / prev;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const data = await Promise.all(
      SYMBOLS.map(async ({ symbol, label }) => ({
        label,
        symbol,
        change: await fetchChange(symbol).catch(() => null),
      }))
    );
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
