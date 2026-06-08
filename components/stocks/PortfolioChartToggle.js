import { useState } from 'react';
import { AreaChart, LineChart } from '../charts';

export default function PortfolioChartToggle({ twrSeries, benchmarkTwrSeries, drawdownSeries, benchmarkDrawdownSeries }) {
  const [view, setView] = useState('twr');
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', top: 18, right: 18, zIndex: 1, display: 'flex', gap: 4 }}>
        {[['twr', 'TWR'], ['drawdown', 'Drawdown']].map(([key, label]) => (
          <button key={key} onClick={() => setView(key)} style={{
            fontSize: '0.75rem', fontWeight: 600, padding: '3px 10px', borderRadius: 4, cursor: 'pointer',
            background: view === key ? 'var(--accent)' : 'var(--surface-2)',
            border: `1px solid ${view === key ? 'var(--accent)' : 'var(--border-2)'}`,
            color: view === key ? '#fff' : 'var(--text-muted)',
          }}>{label}</button>
        ))}
      </div>
      {view === 'twr'
        ? <LineChart points={twrSeries} comparatorPoints={benchmarkTwrSeries} height={390} title="Cumulative TWR" />
        : <AreaChart points={drawdownSeries} comparatorPoints={benchmarkDrawdownSeries} height={390} title="Drawdown" color="#ef4444" />
      }
    </div>
  );
}
