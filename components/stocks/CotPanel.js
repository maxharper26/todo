import { useState, useRef } from 'react';
import { fmt } from '../../lib/stocksFormatters';

export default function CotPanel() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const loadedRef = useRef(false);

  function handleOpen() {
    setOpen(o => {
      const next = !o;
      if (next && !loadedRef.current) {
        setLoading(true);
        fetch('/api/cot')
          .then(r => r.json())
          .then(d => { setData(d); loadedRef.current = true; })
          .catch(e => console.warn('COT load failed:', e))
          .finally(() => setLoading(false));
      }
      return next;
    });
  }

  const signals = data?.signals ?? [];
  const sorted = [...signals].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const maxAbs = sorted.length ? Math.max(...sorted.map(s => Math.abs(s.delta))) : 1;

  return (
    <div style={{ marginBottom: 24, background: '#111118', border: '1px solid #1e1e2e', borderRadius: 8, color: '#e2e8f0' }}>
      <div onClick={handleOpen} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer', userSelect: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>COT Signals</h2>
          {data?.last_updated && <span style={{ fontSize: '0.72rem', color: '#3a3a52' }}>as of {data.last_updated}</span>}
        </div>
        <span style={{ fontSize: '0.65rem', color: '#64748b', display: 'inline-block', transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'none' }}>▶</span>
      </div>
      {open && (
        <div style={{ padding: '0 18px 18px' }}>
          {loading && <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Loading…</p>}
          {!loading && sorted.length === 0 && <p style={{ color: '#3a3a52', fontSize: '0.85rem' }}>No signals.</p>}
          {!loading && sorted.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ color: '#64748b', borderBottom: '1px solid #1e1e2e', textAlign: 'left' }}>
                    <th style={{ padding: '6px 10px' }}>Market</th>
                    <th style={{ padding: '6px 10px', color: '#3a3a52' }}>Category</th>
                    <th style={{ padding: '6px 10px', textAlign: 'right' }}>L/S Ratio</th>
                    <th style={{ padding: '6px 10px', textAlign: 'right' }}>Prev</th>
                    <th style={{ padding: '6px 10px' }}>Week Δ</th>
                    <th style={{ padding: '6px 10px', textAlign: 'right' }}>Long</th>
                    <th style={{ padding: '6px 10px', textAlign: 'right' }}>Short</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((s, i) => {
                    const isPos = s.delta > 0;
                    const barPct = maxAbs > 0 ? (Math.abs(s.delta) / maxAbs) * 100 : 0;
                    const color = isPos ? '#22c55e' : '#ef4444';
                    return (
                      <tr key={s.market} style={{ borderBottom: '1px solid #16161f', background: i % 2 === 0 ? '#111118' : '#16161f' }}>
                        <td style={{ padding: '6px 10px', fontWeight: 700 }}>{s.market}</td>
                        <td style={{ padding: '6px 10px', color: '#3a3a52', fontSize: '0.78rem' }}>{s.category}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#e2e8f0' }}>{s.ratio_now.toFixed(3)}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#64748b' }}>{s.ratio_prev.toFixed(3)}</td>
                        <td style={{ padding: '6px 10px', minWidth: 140 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, background: '#16161f', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                              <div style={{ width: `${barPct}%`, height: '100%', background: color, borderRadius: 4 }} />
                            </div>
                            <span style={{ fontSize: '0.78rem', color, fontVariantNumeric: 'tabular-nums', minWidth: 52, textAlign: 'right' }}>{isPos ? '+' : ''}{s.delta.toFixed(3)}</span>
                          </div>
                        </td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#94a3b8' }}>{s.long.toLocaleString()}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#94a3b8' }}>{s.short.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
