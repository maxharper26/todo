import { useEffect, useState } from 'react';

const CACHE_KEY = 'indices_cache';
const CACHE_TTL = 30 * 60 * 1000;

export default function TickerTape() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
        if (cached && Date.now() - cached.ts < CACHE_TTL) {
          setItems(cached.data);
          return;
        }
      } catch {}
      try {
        const res = await fetch('/api/indices');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setItems(data);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch {}
      } catch (err) {
        console.warn('Indices fetch failed:', err.message);
      }
    }
    load();
  }, []);

  if (!items.length) return null;

  const doubled = [...items, ...items];

  return (
    <div className="ticker-tape">
      <div className="ticker-track">
        {doubled.map((item, i) => {
          const pos = item.change > 0;
          const neg = item.change < 0;
          return (
            <span key={i} className="ticker-item">
              <span className="ticker-symbol">{item.label}</span>
              <span className={`ticker-value ${pos ? 'pos' : neg ? 'neg' : 'flat'}`}>
                {item.change == null ? '—' : (pos ? '+' : '') + (item.change * 100).toFixed(2) + '%'}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
