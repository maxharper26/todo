import { put, list } from '@vercel/blob';

const BLOB_KEY = 'surf-cache.json';

async function getBlobCache() {
  try {
    const { blobs } = await list({ prefix: BLOB_KEY });
    const blob = blobs.find(b => b.pathname === BLOB_KEY);
    if (!blob) return {};
    return await fetch(blob.url).then(r => r.json());
  } catch { return {}; }
}

async function setBlobCache(cache) {
  await put(BLOB_KEY, JSON.stringify(cache), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
  });
}

const STORMGLASS_PARAMS = [
  'waveHeight', 'wavePeriod', 'waveDirection',
  'swellHeight', 'swellPeriod', 'swellDirection',
  'windSpeed', 'windDirection', 'waterTemperature',
].join(',');

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { beach, lat, lng } = req.query;
  if (!beach || !lat || !lng) return res.status(400).json({ error: 'Missing beach, lat, or lng' });

  // Fetch from Stormglass (weather + tides in parallel)
  const now = new Date();
  const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const weatherUrl = `https://api.stormglass.io/v2/weather/point?lat=${lat}&lng=${lng}&params=${STORMGLASS_PARAMS}&start=${now.toISOString()}&end=${end.toISOString()}`;
  const tideUrl    = `https://api.stormglass.io/v2/tide/extremes/point?lat=${lat}&lng=${lng}&start=${now.toISOString()}&end=${end.toISOString()}`;

  try {
    const [weatherRes, tideRes] = await Promise.all([
      fetch(weatherUrl, { headers: { Authorization: process.env.STORMGLASS_API_KEY } }),
      fetch(tideUrl,    { headers: { Authorization: process.env.STORMGLASS_API_KEY } }),
    ]);

    // Any non-200 from Stormglass (429 rate limit, 402 quota, etc) — serve blob
    if (!weatherRes.ok || !tideRes.ok) {
      const cache = await getBlobCache();
      if (cache[beach]) return res.status(200).json({ ...cache[beach], stale: true });
      const status = weatherRes.ok ? tideRes.status : weatherRes.status;
      return res.status(502).json({ error: `Stormglass error ${status}` });
    }

    const [weatherData, tideData] = await Promise.all([weatherRes.json(), tideRes.json()]);

    const hours = (weatherData.hours || []).map(h => ({
      time:             h.time,
      waveHeight:       pick(h.waveHeight),
      wavePeriod:       pick(h.wavePeriod),
      waveDirection:    pick(h.waveDirection),
      swellHeight:      pick(h.swellHeight),
      swellPeriod:      pick(h.swellPeriod),
      swellDirection:   pick(h.swellDirection),
      windSpeed:        pick(h.windSpeed),
      windDirection:    pick(h.windDirection),
      waterTemperature: pick(h.waterTemperature),
    }));

    // Tide extremes: [{ time, height, type }] where type is 'high' or 'low'
    const tides = (tideData.data || []).map(t => ({
      time:   t.time,
      height: t.height,
      type:   t.type,
    }));

    const payload = { beach, hours, tides, fetchedAt: Date.now() };

    // Update blob cache (fire and forget)
    getBlobCache()
      .then(cache => setBlobCache({ ...cache, [beach]: payload }))
      .catch(() => {});

    return res.status(200).json(payload);
  } catch (err) {
    console.error('Surf API error:', err);
    return res.status(500).json({ error: err.message });
  }
}

function pick(obj) {
  if (!obj) return null;
  if (obj.sg != null) return obj.sg;
  const vals = Object.values(obj).filter(v => v != null);
  return vals.length ? vals[0] : null;
}
