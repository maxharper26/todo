import { useEffect, useState } from 'react';

const CACHE_KEY = 'nrl_odds_cache';
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

export default function OddsTape() {
  const [odds, setOdds] = useState(null);

  useEffect(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        setOdds(cached.data);
        return;
      }
    } catch {}

    fetch('/api/nrl-odds')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.odds?.length) return;
        setOdds(data.odds);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: data.odds })); } catch {}
      })
      .catch(() => {});
  }, []);

  if (!odds?.length) return null;

  // Favourite = lower odds; display as "Team A 1.62 | Team B 2.30"
  const doubled = [...odds, ...odds];

  return (
    <div className="ticker-tape" style={{ marginBottom: 16 }}>
      <div className="ticker-track" style={{ animationDuration: `${Math.max(20, odds.length * 6)}s` }}>
        {doubled.map((g, i) => {
          const homeFav = g.homeOdds <= g.awayOdds;
          return (
            <span key={i} className="ticker-item">
              <span className="ticker-symbol" style={{ color: homeFav ? 'var(--text)' : 'var(--text-muted)', fontWeight: homeFav ? 700 : 500 }}>
                {g.home}
              </span>
              <span className="ticker-value" style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                {g.homeOdds?.toFixed(2) ?? '?'}
              </span>
              <span style={{ color: 'var(--text-faint)', fontSize: '0.72rem' }}>vs</span>
              <span className="ticker-symbol" style={{ color: !homeFav ? 'var(--text)' : 'var(--text-muted)', fontWeight: !homeFav ? 700 : 500 }}>
                {g.away}
              </span>
              <span className="ticker-value" style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                {g.awayOdds?.toFixed(2) ?? '?'}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
