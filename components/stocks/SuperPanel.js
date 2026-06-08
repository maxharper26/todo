import { useState, useRef } from 'react';
import { fmt, pct } from '../../lib/stocksFormatters';
import { LineChart } from '../charts';

export default function SuperPanel() {
  const [open, setOpen] = useState(false);
  const [superData, setSuperData] = useState(null);
  const [loading, setLoading] = useState(false);
  const loadedRef = useRef(false);

  function handleOpen() {
    setOpen(o => {
      const next = !o;
      if (next && !loadedRef.current) {
        setLoading(true);
        fetch('/api/super')
          .then(r => r.json())
          .then(d => { setSuperData(d); loadedRef.current = true; })
          .catch(e => console.warn('Super load failed:', e))
          .finally(() => setLoading(false));
      }
      return next;
    });
  }

  const pnlColour = superData?.pnl == null ? '#64748b' : superData.pnl >= 0 ? '#22c55e' : '#ef4444';

  return (
    <div style={{ marginBottom: 24, background: '#111118', border: '1px solid #1e1e2e', borderRadius: 8, color: '#e2e8f0' }}>
      <div onClick={handleOpen} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer', userSelect: 'none' }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Super</h2>
        <span style={{ fontSize: '0.65rem', color: '#64748b', display: 'inline-block', transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'none' }}>▶</span>
      </div>
      {open && (
        <div style={{ padding: '0 18px 18px' }}>
          {loading && <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Loading…</p>}
          {!loading && superData && (
            <>
              <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                {[
                  { label: 'Total Return', value: pct(superData.totalReturn), colour: pnlColour },
                  { label: 'P&L', value: `${fmt(superData.pnl)}`, colour: pnlColour },
                  { label: 'Balance', value: `${fmt(superData.currentValue)}`, colour: pnlColour },
                ].map(({ label, value, colour }) => (
                  <div key={label} style={{ background: '#16161f', border: '1px solid #1e1e2e', borderRadius: 8, padding: '12px 18px', minWidth: 130 }}>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: colour || '#e2e8f0' }}>{value}</div>
                  </div>
                ))}
              </div>
              {superData.twrSeries?.length >= 2 && (
                <LineChart points={superData.twrSeries} comparatorPoints={superData.benchmarkTwrSeries} height={320} title="Super TWR" color="#6366f1" />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
