import { useState } from 'react';
import { fmt, pct, returnStyle } from '../../lib/stocksFormatters';

export default function EtfCorrelations({ etfs, updatedAt, loading, onOpen }) {
  const [open, setOpen] = useState(false);
  const age = updatedAt
    ? new Date(updatedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  function handleToggle() {
    if (!open) onOpen?.();
    setOpen(o => !o);
  }
  return (
    <div style={{ marginBottom: 24, background: '#111118', border: '1px solid #1e1e2e', borderRadius: 8, color: '#e2e8f0' }}>
      <div
        onClick={() => handleToggle()}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer', userSelect: 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>ETF Correlations</h2>
          {age && <span style={{ fontSize: '0.72rem', color: '#3a3a52' }}>as of {age}</span>}
        </div>
        <span style={{ fontSize: '0.65rem', color: '#64748b', display: 'inline-block', transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'none' }}>▶</span>
      </div>
      {open && loading && (
        <div style={{ padding: '12px 18px 18px', color: '#3a3a52', fontSize: '0.85rem' }}>Loading…</div>
      )}
      {open && !loading && etfs?.length > 0 && (
        <div style={{ padding: '0 18px 18px' }}>
          <div className="etf-scroll">
            <table className="etf-table">
              <thead>
                <tr>
                  <th>Ticker</th><th>ETF</th>
                  <th>Correlation</th><th>1m Return</th><th>Days</th>
                </tr>
              </thead>
              <tbody>
                {etfs.map((item, i) => (
                  <tr key={item.symbol} className={i % 2 === 0 ? 'row-even' : 'row-odd'}>
                    <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{item.ticker}</td>
                    <td>{item.name}</td>
                    <td className="num" style={returnStyle(item.correlation != null ? -item.correlation : null)}>{fmt(item.correlation)}</td>
                    <td className="num" style={returnStyle(item.oneMonthReturn)}>{pct(item.oneMonthReturn)}</td>
                    <td className="num muted">{item.observations}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
