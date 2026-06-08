import { useState, useRef } from 'react';
import { fmt, pct, returnStyle } from '../../lib/stocksFormatters';

export default function TradeHistory({ onDelete }) {
  const [open, setOpen] = useState(false);
  const [trades, setTrades] = useState(null);
  const [closedData, setClosedData] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [hideNetZero, setHideNetZero] = useState(false);

  async function fetchAll() {
    try {
      const [tradesRes, closedRes] = await Promise.all([
        fetch('/api/portfolio'),
        fetch('/api/closed-trades'),
      ]);
      const tradesJson = await tradesRes.json();
      const closedJson = await closedRes.json();
      setTrades(tradesJson.sort((a, b) => b.date.localeCompare(a.date)));
      setClosedData(closedJson);
    } catch (e) {
      setTrades([]);
      setClosedData({ summary: [] });
    }
  }

  function handleOpen() {
    setOpen(o => {
      if (!o && !trades) fetchAll();
      return !o;
    });
  }

  async function handleDelete(id) {
    if (!confirm('Delete this trade?')) return;
    setDeleting(id);
    try {
      await fetch(`/api/portfolio?id=${id}`, { method: 'DELETE' });
      setTrades(t => t.filter(x => x.id !== id));
      onDelete();
    } finally {
      setDeleting(null);
    }
  }

  const closedRows = closedData?.summary ?? [];
  const netZeroTickers = new Set(closedRows.filter(r => Math.abs(r.pnl) < 0.01).map(r => r.ticker));
  const filteredClosed = hideNetZero ? closedRows.filter(r => !netZeroTickers.has(r.ticker)) : closedRows;

  return (
    <div style={{ marginBottom: 24, background: '#111118', border: '1px solid #1e1e2e', borderRadius: 8, color: '#e2e8f0' }}>
      <div onClick={handleOpen} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer', userSelect: 'none' }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Trade History</h2>
        <span style={{ fontSize: '0.65rem', color: '#64748b', display: 'inline-block', transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'none' }}>▶</span>
      </div>
      {open && (
        <div style={{ padding: '0 18px 18px' }}>
          {!trades ? (
            <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Loading…</p>
          ) : (
            <>
              {/* Closed trades summary */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Closed positions</span>
                  {netZeroTickers.size > 0 && (
                    <button
                      onClick={e => { e.stopPropagation(); setHideNetZero(h => !h); }}
                      style={{
                        fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: 4, cursor: 'pointer',
                        background: hideNetZero ? 'var(--accent)' : 'var(--surface-2)',
                        border: `1px solid ${hideNetZero ? 'var(--accent)' : 'var(--border-2)'}`,
                        color: hideNetZero ? '#fff' : 'var(--text-muted)',
                      }}
                    >{hideNetZero ? 'Showing non-zero only' : `Hide net-zero (${netZeroTickers.size})`}</button>
                  )}
                </div>
                {filteredClosed.length === 0 ? (
                  <p style={{ color: '#3a3a52', fontSize: '0.82rem' }}>No closed positions.</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ color: '#64748b', borderBottom: '1px solid #1e1e2e', textAlign: 'left' }}>
                          <th style={{ padding: '6px 10px' }}>Ticker</th>
                          <th style={{ padding: '6px 10px' }}>Opened</th>
                          <th style={{ padding: '6px 10px' }}>Closed</th>
                          <th style={{ padding: '6px 10px', textAlign: 'right' }}>Days held</th>
                          <th style={{ padding: '6px 10px', textAlign: 'right' }}>Total return</th>
                          <th style={{ padding: '6px 10px', textAlign: 'right' }}>P&amp;L</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredClosed.map((row, i) => (
                          <tr key={row.ticker} style={{ borderBottom: '1px solid #16161f', background: i % 2 === 0 ? '#111118' : '#16161f' }}>
                            <td style={{ padding: '6px 10px', fontWeight: 700 }}>{row.ticker}</td>
                            <td style={{ padding: '6px 10px', color: '#94a3b8' }}>{row.openDate}</td>
                            <td style={{ padding: '6px 10px', color: '#94a3b8' }}>{row.closeDate}</td>
                            <td style={{ padding: '6px 10px', textAlign: 'right', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>{row.daysHeld}</td>
                            <td style={{ padding: '6px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', ...returnStyle(row.totalReturn) }}>
                              {row.totalReturn != null ? (row.totalReturn >= 0 ? '+' : '') + (row.totalReturn * 100).toFixed(2) + '%' : '—'}
                            </td>
                            <td style={{ padding: '6px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', ...returnStyle(row.pnl) }}>
                              {row.pnl >= 0 ? '+' : ''}{fmt(row.pnl)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div style={{ borderTop: '1px solid #1e1e2e', marginBottom: 16 }} />

              {/* Raw trade log */}
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>All trades</div>
              {trades.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No trades.</p>
              ) : (
                <div style={{ overflowX: 'auto', maxHeight: 320, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#111118', zIndex: 1 }}>
                      <tr style={{ color: '#64748b', borderBottom: '1px solid #1e1e2e', textAlign: 'left' }}>
                        <th style={{ padding: '8px 10px' }}>Date</th>
                        <th style={{ padding: '8px 10px' }}>Ticker</th>
                        <th style={{ padding: '8px 10px' }}>Action</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Units</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Price</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Value</th>
                        <th style={{ padding: '8px 10px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {trades.map((t, i) => (
                        <tr key={t.id} style={{ borderBottom: '1px solid #16161f', background: i % 2 === 0 ? '#111118' : '#16161f' }}>
                          <td style={{ padding: '8px 10px', color: '#94a3b8', userSelect: 'text' }}>{t.date}</td>
                          <td style={{ padding: '8px 10px', fontWeight: 700, userSelect: 'text' }}>{t.ticker}</td>
                          <td style={{ padding: '8px 10px' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 7px', borderRadius: 4,
                              background: t.action === 'buy' ? 'rgba(34,197,94,.15)' : 'rgba(239,68,68,.15)',
                              color: t.action === 'buy' ? '#22c55e' : '#ef4444' }}>
                              {t.action.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', userSelect: 'text' }}>{t.units}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', userSelect: 'text' }}>{fmt(t.price)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#94a3b8', userSelect: 'text' }}>{fmt(t.price * t.units)}</td>
                          <td style={{ padding: '8px 10px' }}>
                            <button
                              onClick={() => handleDelete(t.id)}
                              disabled={deleting === t.id}
                              style={{ fontSize: '0.72rem', border: '1px solid #2a2a3d', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', background: '#16161f', color: '#64748b', opacity: deleting === t.id ? 0.5 : 1 }}
                            >{deleting === t.id ? '…' : 'Delete'}</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
