import { useState } from 'react';
import { pct } from '../../lib/stocksFormatters';

export default function PnlContributions({ tickers, perTicker, allocations }) {
  const [open, setOpen] = useState(false);

  const rows = tickers
    .map(ticker => {
      const alloc = allocations.find(a => a.ticker === ticker);
      const weight = alloc?.weight ?? 0;
      const totalReturn = perTicker[ticker]?.totalReturn ?? null;
      const contribution = weight != null && totalReturn != null ? weight * totalReturn : null;
      return { ticker, weight, totalReturn, contribution };
    })
    .filter(r => r.contribution != null)
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  if (!rows.length) return null;

  const maxAbs = Math.max(...rows.map(r => Math.abs(r.contribution)));

  return (
    <div style={{ marginBottom: 24, background: '#111118', border: '1px solid #1e1e2e', borderRadius: 8, color: '#e2e8f0' }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer', userSelect: 'none' }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>P&L Contributions</h2>
        <span style={{ fontSize: '0.65rem', color: '#64748b', display: 'inline-block', transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'none' }}>▶</span>
      </div>
      {open && (
        <div style={{ padding: '0 18px 18px' }}>
          {rows.map(row => {
            const isPos = row.contribution >= 0;
            const barPct = maxAbs > 0 ? (Math.abs(row.contribution) / maxAbs) * 100 : 0;
            const color = isPos ? '#22c55e' : '#ef4444';
            return (
              <div key={row.ticker} style={{ display: 'grid', gridTemplateColumns: '72px 1fr 72px 72px', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, textAlign: 'right', color: '#e2e8f0' }}>{row.ticker}</span>
                <div style={{ background: '#16161f', borderRadius: 4, height: 10, overflow: 'hidden' }}>
                  <div style={{ width: `${barPct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.4s ease' }} />
                </div>
                <span style={{ fontSize: '0.78rem', color, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{pct(row.contribution)}</span>
                <span style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{pct(row.weight)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
