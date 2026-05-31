import { useState, useEffect, useCallback } from 'react';
import { TideChart, SwellTable } from '../components/charts';
import { aussieFt, compassDir, fmtWind, fmtPeriod, waveColour, windColour, periodColour } from '../lib/surfHelpers';

const BEACHES = [
  { id: 'queenscliff', label: 'Queenscliff', lat: -33.7875, lng: 151.2888 },
  { id: 'bondi',       label: 'Bondi',       lat: -33.8930, lng: 151.2756 },
];

const DEFAULT = 'queenscliff';
const CACHE_TTL = 24 * 60 * 60 * 1000;

function localCacheKey(id) { return `surf_${id}`; }
function getLocalCache(id) {
  try {
    const raw = localStorage.getItem(localCacheKey(id));
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (Date.now() - c.fetchedAt < CACHE_TTL) return c;
  } catch {}
  return null;
}
function setLocalCache(id, data) {
  try { localStorage.setItem(localCacheKey(id), JSON.stringify(data)); } catch {}
}

function groupByDay(hours) {
  const days = {};
  for (const h of hours) {
    const d = h.time.slice(0, 10);
    if (!days[d]) days[d] = [];
    days[d].push(h);
  }
  return Object.entries(days).map(([date, hrs]) => {
    const daytime = hrs.filter(h => { const hr = new Date(h.time).getUTCHours(); return hr >= 20 && hr <= 8; });
    const sample = daytime.length ? daytime : hrs;
    const avg = key => { const v = sample.map(h => h[key]).filter(v => v != null); return v.length ? v.reduce((a,b) => a+b,0)/v.length : null; };
    const max = key => { const v = sample.map(h => h[key]).filter(v => v != null); return v.length ? Math.max(...v) : null; };
    return {
      date,
      swellHeight:         avg('swellHeight'),
      swellPeriod:         avg('swellPeriod'),
      swellDirection:      avg('swellDirection'),
      windSpeed:           avg('windSpeed'),
      windSpeedMax:        max('windSpeed'),
      windDirection:       avg('windDirection'),
      windDirectionAtMax:  (() => {
        let maxSpd = -Infinity, dir = null;
        for (const h of sample) { if (h.windSpeed != null && h.windSpeed > maxSpd) { maxSpd = h.windSpeed; dir = h.windDirection; } }
        return dir;
      })(),
    };
  });
}

function fmtTideHeight(v) { return v != null ? `${v.toFixed(1)}m` : '—'; }

function currentTideState(tides) {
  if (!tides?.length) return null;
  const now = Date.now();
  const sorted = [...tides].sort((a, b) => new Date(a.time) - new Date(b.time));
  let prev = null, next = null;
  for (const t of sorted) {
    if (new Date(t.time) <= now) prev = t;
    else if (!next) next = t;
  }
  if (!prev && !next) return null;
  if (!prev) return { height: next.height, type: next.type, arrow: next.type === 'high' ? '↑' : '↓' };
  if (!next) return { height: prev.height, type: prev.type, arrow: prev.type === 'high' ? '↓' : '↑' };
  const frac = (now - new Date(prev.time)) / (new Date(next.time) - new Date(prev.time));
  return {
    height: prev.height + (next.height - prev.height) * frac,
    type:   next.type === 'high' ? 'rising' : 'falling',
    arrow:  next.type === 'high' ? '↑' : '↓',
  };
}

function Headlines({ days, tides }) {
  const today = days?.[0];
  const tide  = currentTideState(tides);
  if (!today && !tide) return null;

  const pills = [
    today && { label: 'Swell',    value: aussieFt(today.swellHeight),  sub: compassDir(today.swellDirection), colour: waveColour(today.swellHeight) },
    today && { label: 'Avg wind', value: fmtWind(today.windSpeed),     sub: compassDir(today.windDirection),  colour: windColour(today.windSpeed, today.windDirection) },
    today && { label: 'Period',   value: fmtPeriod(today.swellPeriod),                                        colour: periodColour(today.swellPeriod) },
    tide  && { label: 'Tide',     value: `${fmtTideHeight(tide.height)} ${tide.arrow}`, sub: tide.type,       colour: 'var(--text)' },
  ].filter(Boolean);

  return (
    <div className="surf-headlines">
      {pills.map((p, i) => (
        <div key={i} className="surf-headline-pill">
          <span className="surf-headline-label">{p.label}</span>
          <span className="surf-headline-value" style={{ color: p.colour }}>{p.value}</span>
          {p.sub && <span className="surf-headline-sub">{p.sub}</span>}
        </div>
      ))}
    </div>
  );
}

export default function SurfPage() {
  const [selected, setSelected] = useState(DEFAULT);
  const [data, setData]         = useState({});
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  const fetchBeach = useCallback(async (id, force = false) => {
    if (!force) {
      const local = getLocalCache(id);
      if (local) { setData(d => ({ ...d, [id]: local })); return; }
      if (data[id]) return;
    }
    const beach = BEACHES.find(b => b.id === id);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/surf?beach=${id}&lat=${beach.lat}&lng=${beach.lng}`);
      if (res.status === 429) { setError('rate_limited'); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setLocalCache(id, json);
      setData(d => ({ ...d, [id]: json }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [data]);

  useEffect(() => { fetchBeach(DEFAULT); }, []);

  function handleSelect(id) { setSelected(id); setError(null); fetchBeach(id); }

  const beachData = data[selected];
  const days  = beachData ? groupByDay(beachData.hours) : [];
  const tides = beachData?.tides || [];
  const cacheAge = beachData?.fetchedAt ? Math.round((Date.now() - beachData.fetchedAt) / 3600000) : null;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Surf</h1>
        {beachData && <button className="btn btn-ghost" onClick={() => fetchBeach(selected, true)}>↻ Refresh</button>}
      </div>

      <div className="surf-selector">
        {BEACHES.map(b => (
          <button key={b.id} className={`surf-beach-btn${selected === b.id ? ' active' : ''}`} onClick={() => handleSelect(b.id)}>
            {b.label}
          </button>
        ))}
      </div>

      {loading && <p className="surf-muted">Loading {BEACHES.find(b => b.id === selected)?.label}…</p>}

      {!loading && error === 'rate_limited' && (
        <div className="surf-ratelimit">
          <p>🌊 Rate limit hit — check <a href="https://www.surfline.com/surf-report/queenscliff/5842041f4e65fad6a77088a0" target="_blank" rel="noopener noreferrer">Surfline</a> instead.</p>
        </div>
      )}
      {!loading && error && error !== 'rate_limited' && <p className="surf-error">Error: {error}</p>}

      {!loading && !error && beachData && days.length > 0 && (
        <>
          <div className="surf-cache-note">
            {beachData.stale
              ? <span style={{ color: '#f59e0b' }}>⚠ Stale cache ({cacheAge}h old) — rate limit hit</span>
              : <span>Cached {cacheAge === 0 ? 'just now' : `${cacheAge}h ago`}</span>
            }
          </div>
          <Headlines days={days} tides={tides} />
          <SwellTable days={days} />
          <TideChart tides={tides} />
        </>
      )}

      {!loading && !error && !beachData && <p className="surf-muted">Select a beach above to load forecast.</p>}
    </div>
  );
}
