import { pct, returnStyle } from '../../lib/stocksFormatters';

export default function TickerTape({ tickers, standardizedReturns, watchlistData }) {
  const portfolioItems = tickers.map(t => ({ ticker: t, value: standardizedReturns[t]?.['1d'] ?? null, isWatchlist: false }));
  const watchlistItems = (watchlistData?.tickers || [])
    .filter(t => !tickers.includes(t))
    .map(t => ({ ticker: t, value: watchlistData.perTicker[t]?.oneDay ?? null, isWatchlist: true }));
  const items = [...portfolioItems, watchlistItems.length ? { ticker: '│', value: null, isSep: true } : null, ...watchlistItems].filter(Boolean);
  const doubled = [...items, ...items];

  return (
    <div className="ticker-tape">
      <div className="ticker-track">
        {doubled.map((item, i) => {
          const pos = item.value > 0;
          const neg = item.value < 0;
          return (
            <span key={i} className="ticker-item">
              {item.isSep
                ? <span style={{ color: '#2a2a3d', margin: '0 4px' }}>│</span>
                : <><span className="ticker-symbol" style={item.isWatchlist ? { color: '#64748b' } : {}}>{item.ticker}</span>
                   <span className={`ticker-value ${pos ? 'pos' : neg ? 'neg' : 'flat'}`}>
                     {item.value == null ? '—' : (pos ? '+' : '') + (item.value * 100).toFixed(2) + '%'}
                   </span></>
              }
            </span>
          );
        })}
      </div>
    </div>
  );
}
