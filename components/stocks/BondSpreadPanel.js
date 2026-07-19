import { useState, useRef } from 'react';
import { LineChart } from '../charts';

export default function BondSpreadPanel() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const loadedRef = useRef(false);

  function handleOpen() {
    setOpen(o => {
      const next = !o;
      if (next && !loadedRef.current) {
        setLoading(true);
        fetch('/api/bond-spread')
          .then(r => r.json())
          .then(d => { setData(d); loadedRef.current = true; })
          .catch(e => console.warn('Bond spread load failed:', e))
          .finally(() => setLoading(false));
      }
      return next;
    });
  }

  const bonds = data?.bonds ?? {};
  const bondEntries = Object.entries(bonds);

  return (
    <div style={{ marginBottom: 24, background: '#111118', border: '1px solid #1e1e2e', borderRadius: 8, color: '#e2e8f0' }}>
      <div onClick={handleOpen} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer', userSelect: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>Bond Spread</h2>
          {data?.updated_at && <span style={{ fontSize: '0.72rem', color: '#3a3a52' }}>as of {new Date(data.updated_at).toLocaleDateString()}</span>}
        </div>
        <span style={{ fontSize: '0.65rem', color: '#64748b', display: 'inline-block', transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'none' }}>▶</span>
      </div>
      {open && (
        <div style={{ padding: '0 18px 18px' }}>
          {loading && <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Loading…</p>}
          {!loading && bondEntries.length === 0 && (
            <p style={{ color: '#3a3a52', fontSize: '0.85rem' }}>No bond spread data.</p>
          )}
          {!loading && bondEntries.map(([label, bond]) => {
            const series = bond.series ?? [];
            const latest = series[series.length - 1];
            const spreadPoints = series
              .filter(p => p.spread_bps != null)
              .map(p => ({ date: p.date, value: p.spread_bps }));

            return (
              <div key={label} style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Bond', value: label },
                    { label: 'Price', value: latest ? `${(latest.price * 100).toFixed(2)}` : '—' },
                    { label: 'Yield', value: latest ? `${latest.yield.toFixed(2)}%` : '—' },
                    { label: 'Spread', value: latest?.spread_bps != null ? `${latest.spread_bps >= 0 ? '+' : ''}${latest.spread_bps.toFixed(0)} bps` : '—' },
                  ].map(({ label: l, value }) => (
                    <div key={l} style={{ background: '#16161f', border: '1px solid #1e1e2e', borderRadius: 8, padding: '12px 18px', minWidth: 130 }}>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: 4 }}>{l}</div>
                      <div style={{ fontSize: l === 'Bond' ? '0.85rem' : '1.05rem', fontWeight: 700 }}>{value}</div>
                    </div>
                  ))}
                </div>
                {spreadPoints.length >= 2 && (
                  <LineChart points={spreadPoints} height={320} title={`${label} — Spread vs 10Y Treasury (bps)`} color="#6366f1" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
