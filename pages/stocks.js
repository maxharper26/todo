import Link from 'next/link';
import { useEffect, useState } from 'react';
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

const TRADE_FORM_DEFAULT = { ticker: '', date: new Date().toISOString().slice(0, 10), price: '', units: '', action: 'buy', sector: '' };

export default function StocksPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [etfData, setEtfData] = useState(null);
  const [etfLoading, setEtfLoading] = useState(false);
  const [tradeModal, setTradeModal] = useState(false);
  const [tradeForm, setTradeForm] = useState(TRADE_FORM_DEFAULT);
  const [tradeSubmitting, setTradeSubmitting] = useState(false);
  const [tradeError, setTradeError] = useState(null);

  const CACHE_KEY = 'stocks_cache';
  const CACHE_TTL = 30 * 60 * 1000;

  async function load(force = false) {
    // Check local cache first
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
    setLoading(true);
    setError(null);
    setEtfData(null);
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
    }
  }

  async function loadEtfs() {
    setEtfLoading(true);
    try {
      const res = await fetch('/api/etf-correlations');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setEtfData(await res.json());
    } catch (err) {
      console.warn('ETF correlations failed:', err.message);
    } finally {
      setEtfLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { if (data) loadEtfs(); }, [data]);

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
      load(true);
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
    <div className="stocks-page">

      {/* Header */}
      <div className="page-header">
        <h1>Stocks</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => { setTradeModal(true); setTradeError(null); }}>+ Add trade</button>
          <Link href="/todo" style={{ padding: '6px 12px', borderRadius: 6, background: '#6366f1', border: '1px solid #6366f1', color: '#fff', textDecoration: 'none', fontSize: '0.82rem', fontWeight: 500 }}>Todo</Link>
        </div>
      </div>

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
                      // Auto-fill sector from existing holding when ticker is entered
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
          // { label: 'Market Value',  value: portfolio?.current_value != null ? `${fmt(portfolio.current_value)}` : '—' },
          // { label: 'Cost Basis',    value: portfolio?.total_cost    != null ? `${fmt(portfolio.total_cost)}`    : '—' },
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

      {twrSeries && <LineChart points={twrSeries} comparatorPoints={benchmarkTwrSeries} height={390} title="Cumulative Portfolio TWR" />}
      {drawdownSeries && <AreaChart points={drawdownSeries} comparatorPoints={benchmarkDrawdownSeries} height={340} title="Drawdown" color="#ef4444" />}

      {/* Charts grid */}
      <div className="chart-grid">
        {correlationMatrix && <Heatmap matrix={correlationMatrix} tickers={tickers} size={540} />}
        {allocations && <PieChart allocations={allocations} sectorAllocations={sectorAllocations} size={520} />}
      </div>

      {/* ETF Correlations */}
      {etfLoading && (
        <div style={{ marginBottom: 24, background: '#111118', border: '1px solid #1e1e2e', borderRadius: 8, padding: '14px 18px', color: '#3a3a52', fontSize: '0.85rem' }}>
          ETF correlations loading…
        </div>
      )}
      {!etfLoading && lowCorrelationEtfs?.length > 0 && <EtfCorrelations etfs={lowCorrelationEtfs} updatedAt={etfUpdatedAt} />}

      {priceSeries && tickers.length > 0 && <TickerChart priceSeries={priceSeries} tickers={tickers} perTicker={perTicker} />}

      <PnlContributions tickers={tickers} perTicker={perTicker} allocations={allocations} />

      <TradeHistory onDelete={() => load(true)} />

      <div className="last-updated">Last updated: {new Date(loaded_at).toLocaleString()}</div>
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

function TradeHistory({ onDelete }) {
  const [open, setOpen] = useState(false);
  const [trades, setTrades] = useState(null);
  const [deleting, setDeleting] = useState(null);

  async function fetchTrades() {
    try {
      const res = await fetch('/api/portfolio');
      const data = await res.json();
      setTrades(data.sort((a, b) => b.date.localeCompare(a.date)));
    } catch (e) {
      setTrades([]);
    }
  }

  function handleOpen() {
    setOpen(o => {
      if (!o && !trades) fetchTrades();
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
          ) : trades.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No trades.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
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
