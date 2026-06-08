import { useState } from 'react';
import { LineChart } from '../charts';

export default function TickerChart({ priceSeries, tickers, perTicker, watchlistPriceSeries, watchlistTickers }) {
  const allSeries = { ...priceSeries, ...(watchlistPriceSeries || {}) };
  const allTickers = [
    ...tickers,
    ...((watchlistTickers || []).filter(t => !tickers.includes(t))),
  ];

  const [selected, setSelected] = useState(allTickers[0]);
  const [open, setOpen] = useState(false);

  const safeSelected = allTickers.includes(selected) ? selected : allTickers[0];
  const points = allSeries[safeSelected] || [];
  const avgPrice = perTicker[safeSelected]?.avgPrice ?? null;
  const isWatchlist = watchlistTickers?.includes(safeSelected) && !tickers.includes(safeSelected);

  return (
    <div style={{ marginBottom: 24, background: '#111118', border: '1px solid #1e1e2e', borderRadius: 8, color: '#e2e8f0' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer', userSelect: 'none' }}
      >
        <h2 style={{ margin: 0, fontSize: 20 }}>Single Asset Viewer</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {open && (
            <select
              value={safeSelected}
              onClick={e => e.stopPropagation()}
              onChange={e => setSelected(e.target.value)}
              style={{ background: '#16161f', border: '1px solid #2a2a3d', color: '#e2e8f0', borderRadius: 6, padding: '6px 10px', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              {tickers.length > 0 && <optgroup label="Portfolio">{tickers.map(t => <option key={t} value={t}>{t}</option>)}</optgroup>}
              {watchlistTickers?.length > 0 && <optgroup label="Watchlist">{watchlistTickers.filter(t => !tickers.includes(t)).map(t => <option key={t} value={t}>{t}</option>)}</optgroup>}
            </select>
          )}
          <span style={{ fontSize: '0.65rem', color: '#64748b', transition: 'transform 0.2s', display: 'inline-block', transform: open ? 'rotate(90deg)' : 'none' }}>▶</span>
        </div>
      </div>
      {open && (
        <div style={{ padding: '0 18px 18px' }}>
          {isWatchlist && <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: 8 }}>Watchlist — no cost basis</div>}
          <LineChart key={safeSelected} points={points} height={320} title="" avgPrice={avgPrice} />
        </div>
      )}
    </div>
  );
}
