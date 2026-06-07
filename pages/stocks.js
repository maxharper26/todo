import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { AreaChart, Heatmap, LineChart, PieChart } from '../components/charts';

function pct(n) {
  if (n == null) return '-';
  return (n * 100).toFixed(2) + '%';
}

function fmt(n) {
  if (n == null) return '-';
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function returnStyle(value, strong = false) {
  if (value == null) return { color: '#64748b' };
  return {
    color: value > 0 ? '#22c55e' : value < 0 ? '#ef4444' : '#64748b',
    fontWeight: strong ? 700 : 500,
  };
}

function mixColor(from, to, amount) {
  const clamped = Math.max(0, Math.min(1, amount));
  const channel = (idx) => Math.round(from[idx] + (to[idx] - from[idx]) * clamped);
  return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`;
}

function conditionalCellStyle(value, stats, strong = false) {
  const style = {
    color: value == null ? '#64748b' : '#e2e8f0',
    fontWeight: strong ? 700 : 500,
  };
  if (value == null || !stats || stats.sortedValues.length < 2) return style;

  const sorted = stats.sortedValues;
  const rank = sorted.filter(v => v <= value).length - 1;
  const ratio = rank / (sorted.length - 1);

  const red   = [50, 20, 20];
  const white = [22, 22, 31];
  const green = [20, 50, 25];

  return {
    ...style,
    backgroundColor: ratio < 0.5
      ? mixColor(red, white, ratio * 2)
      : mixColor(white, green, (ratio - 0.5) * 2),
  };
}

function getColumnStats(rows, key) {
  const values = rows
    .map(row => row[key])
    .filter(value => typeof value === 'number' && !Number.isNaN(value));
  if (!values.length) return null;
  return { sortedValues: [...values].sort((a, b) => a - b) };
}

const SECTORS = [
  'US Equity', 'Non-US Developed Equity', 'EM Equity', 'VC',
  'Gold', 'Commodities', 'Fixed Income', 'Infrastructure', 'Hedged Equities',
  'Real Estate', 'Crypto', 'Alternatives',
];

const CACHE_KEY = 'stocks_cache';
const CACHE_TTL = 30 * 60 * 1000;

const TRADE_FORM_DEFAULT = { ticker: '', date: new Date().toISOString().slice(0, 10), price: '', units: '', action: 'buy', sector: '' };

export default function StocksPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false); // soft refresh — keeps existing data visible
  const [error, setError] = useState(null);
  const [etfData, setEtfData] = useState(null);
  const [etfLoading, setEtfLoading] = useState(false);
  const [tradeModal, setTradeModal] = useState(false);
  const [tradeForm, setTradeForm] = useState(TRADE_FORM_DEFAULT);
  const [tradeSubmitting, setTradeSubmitting] = useState(false);
  const [tradeError, setTradeError] = useState(null);
  const etfLoadedRef = useRef(false);

  async function load(force = false) {
    if (!force) {
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
        if (cached && Date.now() - cached.ts < CACHE_TTL) {
          setData(cached.data);
          setLoading(false);
          return;
        }
      } catch {}
    }

    // If we already have data, do a soft refresh (no full-page loading state)
    if (force && data) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const res = await fetch('/api/stocks');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: json })); } catch {}
    } catch (err) {
      setError(err.message || 'Failed to load stock data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadEtfs() {
    setEtfLoading(true);
    try {
      const res = await fetch('/api/etf-correlations');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setEtfData(await res.json());
      etfLoadedRef.current = true;
    } catch (err) {
      console.warn('ETF correlations failed:', err.message);
    } finally {
      setEtfLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Only load ETFs once on initial data load, not on every refresh
  useEffect(() => {
    if (data && !etfLoadedRef.current) loadEtfs();
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submitTrade() {
    const { ticker, date, price, units, action } = tradeForm;
    if (!ticker || !date || !price || !units) {
      setTradeError('All fields are required.');
      return;
    }
    setTradeSubmitting(true);
    setTradeError(null);
    try {
      const res = await fetch('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, date, price: Number(price), units: Number(units), action, sector: tradeForm.sector || null }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      setTradeModal(false);
      setTradeForm(TRADE_FORM_DEFAULT);
      await load(true); // await so refreshing state is accurate
    } catch (err) {
      setTradeError(err.message);
    } finally {
      setTradeSubmitting(false);
    }
  }

  if (loading) return <div className="stocks-loading"><h1>Stocks</h1><p>Loading latest market data…</p></div>;
  if (error)   return <div className="stocks-loading"><h1>Stocks</h1><p className="stocks-error">{error}</p></div>;
  if (!data)   return <div className="stocks-loading">No data</div>;

  const { perTicker, portfolio, allocations, twrSeries, drawdownSeries, benchmarkTwrSeries, benchmarkDrawdownSeries, standardizedReturns, correlationMatrix, priceSeries, sectorAllocations, tickers, loaded_at } = data;
  const lowCorrelationEtfs = etfData?.lowCorrelationEtfs;
  const etfUpdatedAt = etfData?.etfUpdatedAt;

  const portfolioTotalReturn = twrSeries?.length ? (twrSeries[twrSeries.length - 1].value - 100) / 100 : null;
  const returnRows = standardizedReturns ? [
    {
      asset: 'Portfolio', isPortfolio: true,
      totalReturn: portfolioTotalReturn,
      oneDay:   standardizedReturns.Portfolio?.['1d'],
      oneWeek:  standardizedReturns.Portfolio?.['1w'],
      oneMonth: standardizedReturns.Portfolio?.['1m'],
      sharpe: portfolio?.sharpe,
      beta: portfolio?.beta,
    },
    ...tickers.map(ticker => ({
      asset: ticker,
      latestPrice: perTicker[ticker]?.latestPrice,
      totalReturn: perTicker[ticker]?.totalReturn,
      oneDay:   standardizedReturns[ticker]?.['1d'],
      oneWeek:  standardizedReturns[ticker]?.['1w'],
      oneMonth: standardizedReturns[ticker]?.['1m'],
      sharpe: perTicker[ticker]?.sharpe,
      beta: perTicker[ticker]?.beta,
    }))
  ] : [];

  const columnStats = {
    totalReturn: getColumnStats(returnRows, 'totalReturn'),
    oneDay:      getColumnStats(returnRows, 'oneDay'),
    oneWeek:     getColumnStats(returnRows, 'oneWeek'),
    oneMonth:    getColumnStats(returnRows, 'oneMonth'),
    sharpe:      getColumnStats(returnRows, 'sharpe'),
    beta:        getColumnStats(returnRows, 'beta'),
  };

  return (
    <div className="page">

      {/* Ticker tape */}
      {standardizedReturns && <TickerTape tickers={tickers} standardizedReturns={standardizedReturns} />}

      {/* Header */}
      <div className="page-header">
        <h1>Stocks</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => { setTradeModal(true); setTradeError(null); }}>+ Add trade</button>
          <button className="btn" onClick={() => load(true)} disabled={refreshing} style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text-muted)', opacity: refreshing ? 0.5 : 1 }}>{refreshing ? 'Refreshing…' : 'Refresh'}</button>
        </div>
      </div>

      {/* Soft-refresh indicator */}
      {refreshing && (
        <div style={{ marginBottom: 12, fontSize: '0.78rem', color: '#64748b' }}>Refreshing…</div>
      )}

      {/* Trade modal */}
      {tradeModal && (
        <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) setTradeModal(false); }}>
          <div className="modal">
            <h2>Add trade</h2>

            <div className="trade-field-group">
              <label>Action</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['buy', 'sell'].map(a => (
                  <button
                    key={a}
                    className="trade-action-btn"
                    onClick={() => setTradeForm(f => ({ ...f, action: a }))}
                    style={{
                      border: tradeForm.action === a ? 'none' : '1px solid var(--border-2)',
                      background: tradeForm.action === a ? (a === 'buy' ? '#22c55e' : '#ef4444') : 'var(--surface-2)',
                      color: tradeForm.action === a ? '#fff' : 'var(--text-muted)',
                    }}
                  >{a.charAt(0).toUpperCase() + a.slice(1)}</button>
                ))}
              </div>
            </div>

            {[['Ticker', 'ticker', 'text', 'e.g. IVV.AX'], ['Date', 'date', 'date', ''], ['Price', 'price', 'number', '0.00'], ['Units', 'units', 'number', '0']].map(([lbl, key, type, placeholder]) => (
              <div key={key} className="form-group">
                <label>{lbl}</label>
                <input
                  type={type}
                  placeholder={placeholder}
                  value={tradeForm[key]}
                  onChange={e => {
                    const val = e.target.value;
                    setTradeForm(f => {
                      const update = { ...f, [key]: val };
                      if (key === 'ticker' && !f.sector) {
                        const match = allocations?.find(a => a.ticker?.toUpperCase() === val.toUpperCase().replace(/\.AX$/i, '') || a.symbol?.toUpperCase() === val.toUpperCase());
                        if (match?.sector) update.sector = match.sector;
                      }
                      return update;
                    });
                  }}
                />
              </div>
            ))}

            <div className="form-group">
              <label>Sector</label>
              <select value={tradeForm.sector} onChange={e => setTradeForm(f => ({ ...f, sector: e.target.value }))}>
                <option value="">— select —</option>
                {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {tradeError && <p className="trade-error">{tradeError}</p>}

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setTradeModal(false)}>Cancel</button>
              <button
                className="btn"
                onClick={submitTrade}
                disabled={tradeSubmitting}
                style={{
                  background: tradeForm.action === 'sell' ? '#ef4444' : '#22c55e',
                  border: 'none', color: '#fff',
                  opacity: tradeSubmitting ? 0.7 : 1,
                }}
              >{tradeSubmitting ? 'Saving…' : `Confirm ${tradeForm.action}`}</button>
            </div>
          </div>
        </div>
      )}

      {/* Summary stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'P&L',          value: portfolio?.current_value != null && portfolio?.total_cost != null
            ? `${fmt(portfolio.current_value - portfolio.total_cost)}`
            : '—',
            colour: portfolio?.current_value != null && portfolio?.total_cost != null
              ? portfolio.current_value >= portfolio.total_cost ? '#22c55e' : '#ef4444'
              : '#64748b' },
          { label: 'Total Return',  value: portfolio?.portfolio_return != null ? pct(portfolio.portfolio_return) : '—',
            colour: portfolio?.portfolio_return != null
              ? portfolio.portfolio_return >= 0 ? '#22c55e' : '#ef4444'
              : '#64748b' },
          { label: 'Sharpe',        value: portfolio?.sharpe != null ? fmt(portfolio.sharpe) : '—' },
          { label: 'Beta (vs VGS)', value: portfolio?.beta   != null ? fmt(portfolio.beta)   : '—' },
        ].map(({ label, value, colour }) => (
          <div key={label} style={{ background: '#111118', border: '1px solid #1e1e2e', borderRadius: 8, padding: '12px 18px', minWidth: 130 }}>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: colour || '#e2e8f0', userSelect: 'text' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Standardized Returns */}
      <div className="panel">
        <h2>Standardized Returns</h2>
        <div className="panel-scroll">
          <table className="returns-table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Price</th>
                <th>Total Return</th>
                <th>1d</th><th>1w</th><th>1m</th>
                <th>Sharpe</th>
                <th>Beta</th>
              </tr>
            </thead>
            <tbody>
              {returnRows.map(row => (
                <tr key={row.asset} className={row.isPortfolio ? 'row-portfolio' : 'row-ticker'}>
                  <td style={{ fontWeight: row.isPortfolio ? 700 : 600 }}>{row.asset}</td>
                  <td className="num" style={{ color: '#64748b' }}>{row.latestPrice != null ? fmt(row.latestPrice) : '—'}</td>
                  <td className="num" style={conditionalCellStyle(row.totalReturn, columnStats.totalReturn, row.isPortfolio)}>{pct(row.totalReturn)}</td>
                  <td className="num" style={conditionalCellStyle(row.oneDay,    columnStats.oneDay,    row.isPortfolio)}>{pct(row.oneDay)}</td>
                  <td className="num" style={conditionalCellStyle(row.oneWeek,   columnStats.oneWeek,   row.isPortfolio)}>{pct(row.oneWeek)}</td>
                  <td className="num" style={conditionalCellStyle(row.oneMonth,  columnStats.oneMonth,  row.isPortfolio)}>{pct(row.oneMonth)}</td>
                  <td className="num" style={conditionalCellStyle(row.sharpe,    columnStats.sharpe,    row.isPortfolio)}>{fmt(row.sharpe)}</td>
                  <td className="num" style={conditionalCellStyle(row.beta,      columnStats.beta,      row.isPortfolio)}>{row.beta != null ? fmt(row.beta) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {twrSeries && drawdownSeries && (
        <PortfolioChartToggle
          twrSeries={twrSeries} benchmarkTwrSeries={benchmarkTwrSeries}
          drawdownSeries={drawdownSeries} benchmarkDrawdownSeries={benchmarkDrawdownSeries}
        />
      )}

      {/* Charts grid */}
      <div className="chart-grid">
        {correlationMatrix && <Heatmap matrix={correlationMatrix} tickers={tickers} size={540} />}
        {allocations && <PieChart allocations={allocations} sectorAllocations={sectorAllocations} size={520} />}
      </div>

      {/* Single Asset Viewer */}
      {priceSeries && tickers.length > 0 && <TickerChart priceSeries={priceSeries} tickers={tickers} perTicker={perTicker} />}


      {/* ETF Correlations */}
      {etfLoading && (
        <div style={{ marginBottom: 24, background: '#111118', border: '1px solid #1e1e2e', borderRadius: 8, padding: '14px 18px', color: '#3a3a52', fontSize: '0.85rem' }}>
          ETF correlations loading…
        </div>
      )}
      {!etfLoading && lowCorrelationEtfs?.length > 0 && <EtfCorrelations etfs={lowCorrelationEtfs} updatedAt={etfUpdatedAt} />}

      <PnlContributions tickers={tickers} perTicker={perTicker} allocations={allocations} />

      <SuperPanel />

      <TradeHistory onDelete={() => load(true)} />

      <div className="last-updated">Last updated: {new Date(loaded_at).toLocaleString()}</div>
    </div>
  );
}

function PortfolioChartToggle({ twrSeries, benchmarkTwrSeries, drawdownSeries, benchmarkDrawdownSeries }) {
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

function PnlContributions({ tickers, perTicker, allocations }) {
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

function TickerTape({ tickers, standardizedReturns }) {
  const items = tickers.map(t => ({
    ticker: t,
    value: standardizedReturns[t]?.['1d'] ?? null,
  }));
  const doubled = [...items, ...items];

  return (
    <div className="ticker-tape">
      <div className="ticker-track">
        {doubled.map((item, i) => {
          const pos = item.value > 0;
          const neg = item.value < 0;
          return (
            <span key={i} className="ticker-item">
              <span className="ticker-symbol">{item.ticker}</span>
              <span className={`ticker-value ${pos ? 'pos' : neg ? 'neg' : 'flat'}`}>
                {item.value == null ? '—' : (pos ? '+' : '') + (item.value * 100).toFixed(2) + '%'}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function TradeHistory({ onDelete }) {
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

              {/* Divider */}
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

function SuperPanel() {
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
              {/* Headline stats */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                {[
                  { label: 'Total Return', value: pct(superData.totalReturn), colour: pnlColour },
                  { label: 'P&L', value: `${fmt(superData.pnl)}`, colour: pnlColour },
                  { label: 'Balance', value: `${fmt(superData.currentValue)}`, colour: pnlColour },

                  // { label: 'Contributed', value: `${fmt(superData.totalContributed)}` },
                ].map(({ label, value, colour }) => (
                  <div key={label} style={{ background: '#16161f', border: '1px solid #1e1e2e', borderRadius: 8, padding: '12px 18px', minWidth: 130 }}>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: colour || '#e2e8f0' }}>{value}</div>
                  </div>
                ))}
              </div>
              {/* TWR chart */}
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

function ClosedTrades() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hideNetZero, setHideNetZero] = useState(false);
  const loadedRef = useRef(false);

  function handleOpen() {
    setOpen(o => {
      const next = !o;
      if (next && !loadedRef.current) {
        setLoading(true);
        fetch('/api/closed-trades')
          .then(r => r.json())
          .then(d => { setData(d); loadedRef.current = true; })
          .catch(e => console.warn('Closed trades load failed:', e))
          .finally(() => setLoading(false));
      }
      return next;
    });
  }

  const rows = data?.summary ?? [];

  // Identify net-zero names: tickers where pnl ≈ 0
  const netZeroTickers = new Set(
    rows.filter(r => Math.abs(r.pnl) < 0.01).map(r => r.ticker)
  );

  const filtered = hideNetZero
    ? rows.filter(r => !netZeroTickers.has(r.ticker))
    : rows;

  return (
    <div style={{ marginBottom: 24, background: '#111118', border: '1px solid #1e1e2e', borderRadius: 8, color: '#e2e8f0' }}>
      <div onClick={handleOpen} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer', userSelect: 'none' }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Closed Trades</h2>
        <span style={{ fontSize: '0.65rem', color: '#64748b', display: 'inline-block', transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'none' }}>▶</span>
      </div>
      {open && (
        <div style={{ padding: '0 18px 18px' }}>
          {loading && <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Loading…</p>}
          {!loading && data && (
            <>
              {netZeroTickers.size > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <button
                    onClick={() => setHideNetZero(h => !h)}
                    style={{
                      fontSize: '0.75rem', fontWeight: 600, padding: '3px 10px', borderRadius: 4, cursor: 'pointer',
                      background: hideNetZero ? 'var(--accent)' : 'var(--surface-2)',
                      border: `1px solid ${hideNetZero ? 'var(--accent)' : 'var(--border-2)'}`,
                      color: hideNetZero ? '#fff' : 'var(--text-muted)',
                    }}
                  >
                    {hideNetZero ? 'Showing non-zero only' : `Hide net-zero (${netZeroTickers.size})`}
                  </button>
                </div>
              )}
              {filtered.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No closed trades.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ color: '#64748b', borderBottom: '1px solid #1e1e2e', textAlign: 'left' }}>
                        <th style={{ padding: '8px 10px' }}>Ticker</th>
                        <th style={{ padding: '8px 10px' }}>Opened</th>
                        <th style={{ padding: '8px 10px' }}>Closed</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Days held</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Total return</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>P&amp;L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((row, i) => (
                        <tr key={row.ticker} style={{ borderBottom: '1px solid #16161f', background: i % 2 === 0 ? '#111118' : '#16161f' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 700 }}>{row.ticker}</td>
                          <td style={{ padding: '8px 10px', color: '#94a3b8' }}>{row.openDate}</td>
                          <td style={{ padding: '8px 10px', color: '#94a3b8' }}>{row.closeDate}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>{row.daysHeld}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', ...returnStyle(row.totalReturn) }}>
                            {row.totalReturn != null ? (row.totalReturn >= 0 ? '+' : '') + (row.totalReturn * 100).toFixed(2) + '%' : '—'}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', ...returnStyle(row.pnl) }}>
                            {row.pnl >= 0 ? '+' : ''}{fmt(row.pnl)}
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

function EtfCorrelations({ etfs, updatedAt }) {
  const [open, setOpen] = useState(false);
  const age = updatedAt
    ? new Date(updatedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;
  return (
    <div style={{ marginBottom: 24, background: '#111118', border: '1px solid #1e1e2e', borderRadius: 8, color: '#e2e8f0' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer', userSelect: 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>ETF Correlations</h2>
          {age && <span style={{ fontSize: '0.72rem', color: '#3a3a52' }}>as of {age}</span>}
        </div>
        <span style={{ fontSize: '0.65rem', color: '#64748b', display: 'inline-block', transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'none' }}>▶</span>
      </div>
      {open && (
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

function TickerChart({ priceSeries, tickers, perTicker }) {
  const [selected, setSelected] = useState(tickers[0]);
  const [open, setOpen] = useState(false);
  const points = priceSeries[selected] || [];
  const avgPrice = perTicker[selected]?.avgPrice ?? null;

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
              value={selected}
              onClick={e => e.stopPropagation()}
              onChange={e => setSelected(e.target.value)}
              style={{ background: '#16161f', border: '1px solid #2a2a3d', color: '#e2e8f0', borderRadius: 6, padding: '6px 10px', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              {tickers.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          <span style={{ fontSize: '0.65rem', color: '#64748b', transition: 'transform 0.2s', display: 'inline-block', transform: open ? 'rotate(90deg)' : 'none' }}>▶</span>
        </div>
      </div>
      {open && (
        <div style={{ padding: '0 18px 18px' }}>
          <LineChart key={selected} points={points} height={320} title="" avgPrice={avgPrice} />
        </div>
      )}
    </div>
  );
}
