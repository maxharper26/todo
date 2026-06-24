import { useEffect, useRef, useState } from 'react';
import { Heatmap, PieChart } from '../components/charts';
import { fmt, pct, conditionalCellStyle, getColumnStats } from '../lib/stocksFormatters';
import CotPanel from '../components/stocks/CotPanel';
import EtfCorrelations from '../components/stocks/EtfCorrelations';
import PnlContributions from '../components/stocks/PnlContributions';
import PortfolioChartToggle from '../components/stocks/PortfolioChartToggle';
import SuperPanel from '../components/stocks/SuperPanel';
import TickerChart from '../components/stocks/TickerChart';
import TickerTape from '../components/stocks/TickerTape';
import TradeHistory from '../components/stocks/TradeHistory';

const SECTORS = [
  'US Equity', 'Non-US Developed Equity', 'EM Equity', 'VC',
  'Gold', 'Commodities', 'Fixed Income', 'Infrastructure', 'Hedged Equities',
  'Real Estate', 'Crypto', 'Alternatives',
];

const CACHE_KEY = 'stocks_cache';
const CACHE_TTL = 30 * 60 * 1000;
const PORTFOLIO_CACHE_KEY = 'portfolio_cache';
const WATCHLIST_CACHE_KEY = 'watchlist_cache';
const WATCHLIST_CACHE_TTL = 30 * 60 * 1000;

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
  const [watchlistData, setWatchlistData] = useState(null);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [watchlistEditing, setWatchlistEditing] = useState(false);
  const [watchlistInput, setWatchlistInput] = useState('');
  const [watchlistSaving, setWatchlistSaving] = useState(false);
  const etfLoadedRef = useRef(false);

  async function load(force = false) {
    if (!force) {
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
        if (cached && Date.now() - cached.ts < CACHE_TTL) { setData(cached.data); setLoading(false); return; }
      } catch {}
    }

    if (force && data) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      let json;
      const cachedPortfolio = (() => { try { return JSON.parse(localStorage.getItem(PORTFOLIO_CACHE_KEY)); } catch { return null; } })();
      if (!force && cachedPortfolio) {
        const res = await fetch('/api/stocks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trades: cachedPortfolio }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        json = await res.json();
      } else {
        const res = await fetch('/api/stocks');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        json = await res.json();
        if (json.rawTrades) { try { localStorage.setItem(PORTFOLIO_CACHE_KEY, JSON.stringify(json.rawTrades)); } catch {} }
      }
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

  useEffect(() => { load(); loadWatchlist(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadWatchlist(force = false) {
    if (!force) {
      try {
        const cached = JSON.parse(localStorage.getItem(WATCHLIST_CACHE_KEY));
        if (cached && Date.now() - cached.ts < WATCHLIST_CACHE_TTL) {
          setWatchlistData(cached.data);
          setWatchlistLoading(false);
          return;
        }
      } catch {}
    }
    setWatchlistLoading(true);
    try {
      const res = await fetch('/api/watchlist');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setWatchlistData(json);
      try { localStorage.setItem(WATCHLIST_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: json })); } catch {}
    } catch (e) {
      console.warn('Watchlist load failed:', e.message);
    } finally {
      setWatchlistLoading(false);
    }
  }

  async function saveWatchlist(newRawTickers) {
    setWatchlistSaving(true);
    try {
      const res = await fetch('/api/watchlist', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers: newRawTickers }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      try { localStorage.removeItem(WATCHLIST_CACHE_KEY); } catch {}
      await loadWatchlist(true);
    } catch (e) {
      console.warn('Watchlist save failed:', e.message);
    } finally {
      setWatchlistSaving(false);
    }
  }

  async function handleWatchlistAdd() {
    const toAdd = watchlistInput.split(/[,\s]+/).map(t => t.trim().toUpperCase()).filter(Boolean);
    if (!toAdd.length) return;
    const merged = Array.from(new Set([...(watchlistData?.rawTickers || []), ...toAdd]));
    setWatchlistInput('');
    await saveWatchlist(merged);
  }

  async function handleWatchlistRemove(rawTicker) {
    await saveWatchlist((watchlistData?.rawTickers || []).filter(t => t !== rawTicker));
  }

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
      try { localStorage.removeItem(CACHE_KEY); localStorage.removeItem(PORTFOLIO_CACHE_KEY); } catch {}
      await load(true);
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
  const watchlistPriceSeries = watchlistData?.priceSeries ?? null;
  const watchlistTickers = watchlistData?.tickers ?? [];

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
      {<TickerTape />}

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
          { label: 'Unrealised P&L', value: portfolio?.current_value != null && portfolio?.total_cost != null
            ? `${fmt(portfolio.current_value - portfolio.total_cost)}`
            : '—',
            colour: portfolio?.current_value != null && portfolio?.total_cost != null
              ? portfolio.current_value >= portfolio.total_cost ? '#22c55e' : '#ef4444'
              : '#64748b' },
          { label: 'Realised P&L', value: portfolio?.realised_pnl != null ? fmt(portfolio.realised_pnl) : '—',
            colour: portfolio?.realised_pnl != null
              ? portfolio.realised_pnl >= 0 ? '#22c55e' : '#ef4444'
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

      {/* Watchlist */}
      {(() => {
        const wRows = (watchlistData?.tickers || []).map(t => ({
          asset: t,
          rawTicker: watchlistData.rawTickers?.[watchlistData.tickers.indexOf(t)],
          latestPrice: watchlistData.perTicker[t]?.latestPrice,
          oneDay:   watchlistData.perTicker[t]?.oneDay,
          oneWeek:  watchlistData.perTicker[t]?.oneWeek,
          oneMonth: watchlistData.perTicker[t]?.oneMonth,
          oneYear:  watchlistData.perTicker[t]?.oneYear,
          sharpe:   watchlistData.perTicker[t]?.sharpe,
          beta:     watchlistData.perTicker[t]?.beta,
        }));
        const wStats = {
          oneDay:   getColumnStats(wRows, 'oneDay'),
          oneWeek:  getColumnStats(wRows, 'oneWeek'),
          oneMonth: getColumnStats(wRows, 'oneMonth'),
          oneYear:  getColumnStats(wRows, 'oneYear'),
          sharpe:   getColumnStats(wRows, 'sharpe'),
          beta:     getColumnStats(wRows, 'beta'),
        };
        return (
          <div className="panel">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}>Watchlist</h2>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {watchlistEditing && (
                  <>
                    <input
                      value={watchlistInput}
                      onChange={e => setWatchlistInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleWatchlistAdd()}
                      placeholder="IVV.AX, AAPL"
                      style={{ background: '#16161f', border: '1px solid #2a2a3d', color: '#e2e8f0', borderRadius: 6, padding: '4px 10px', fontSize: '0.82rem', width: 180 }}
                    />
                    <button onClick={handleWatchlistAdd} disabled={watchlistSaving || !watchlistInput.trim()} className="btn btn-primary" style={{ fontSize: '0.78rem', padding: '4px 12px', opacity: watchlistSaving || !watchlistInput.trim() ? 0.5 : 1 }}>{watchlistSaving ? 'Saving…' : 'Add'}</button>
                  </>
                )}
                <button
                  onClick={() => setWatchlistEditing(v => !v)}
                  style={{
                    fontSize: '0.72rem', fontWeight: 600, padding: '3px 10px', borderRadius: 4, cursor: 'pointer',
                    background: watchlistEditing ? 'var(--accent)' : 'var(--surface-2)',
                    border: `1px solid ${watchlistEditing ? 'var(--accent)' : 'var(--border-2)'}`,
                    color: watchlistEditing ? '#fff' : 'var(--text-muted)',
                  }}
                >{watchlistEditing ? 'Done' : 'Edit'}</button>
              </div>
            </div>
            {watchlistLoading && <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Loading…</p>}
            {!watchlistLoading && wRows.length === 0 && (
              <p style={{ color: '#3a3a52', fontSize: '0.85rem' }}>No tickers — click Edit to add some.</p>
            )}
            {!watchlistLoading && wRows.length > 0 && (
              <div className="panel-scroll">
                <table className="returns-table">
                  <thead>
                    <tr>
                      {watchlistEditing && <th></th>}
                      <th>Asset</th><th>Price</th>
                      <th>1d</th><th>1w</th><th>1m</th><th>1y</th>
                      <th>Sharpe</th><th>Beta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wRows.map(row => (
                      <tr key={row.asset} className="row-ticker">
                        {watchlistEditing && (
                          <td style={{ paddingRight: 6 }}>
                            <button onClick={() => handleWatchlistRemove(row.rawTicker)} disabled={watchlistSaving} style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: 4, cursor: 'pointer', background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.3)', color: '#ef4444', opacity: watchlistSaving ? 0.5 : 1 }}>✕</button>
                          </td>
                        )}
                        <td style={{ fontWeight: 600 }}>{row.asset}</td>
                        <td className="num" style={{ color: '#64748b' }}>{row.latestPrice != null ? fmt(row.latestPrice) : '—'}</td>
                        <td className="num" style={conditionalCellStyle(row.oneDay,   wStats.oneDay)}>{pct(row.oneDay)}</td>
                        <td className="num" style={conditionalCellStyle(row.oneWeek,  wStats.oneWeek)}>{pct(row.oneWeek)}</td>
                        <td className="num" style={conditionalCellStyle(row.oneMonth, wStats.oneMonth)}>{pct(row.oneMonth)}</td>
                        <td className="num" style={conditionalCellStyle(row.oneYear,  wStats.oneYear)}>{pct(row.oneYear)}</td>
                        <td className="num" style={conditionalCellStyle(row.sharpe,   wStats.sharpe)}>{fmt(row.sharpe)}</td>
                        <td className="num" style={conditionalCellStyle(row.beta,     wStats.beta)}>{row.beta != null ? fmt(row.beta) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      {/* Single Asset Viewer */}
      {priceSeries && tickers.length > 0 && <TickerChart priceSeries={priceSeries} tickers={tickers} perTicker={perTicker} watchlistPriceSeries={watchlistData?.priceSeries ?? null} watchlistTickers={watchlistData?.tickers ?? []} />}


      {/* ETF Correlations */}
      <EtfCorrelations etfs={lowCorrelationEtfs} updatedAt={etfUpdatedAt} loading={etfLoading} everLoaded={etfLoadedRef.current} onOpen={() => { if (!etfLoadedRef.current) loadEtfs(); }} />

      <PnlContributions tickers={tickers} perTicker={perTicker} allocations={allocations} />

      <SuperPanel />

      <TradeHistory onDelete={() => { try { localStorage.removeItem(CACHE_KEY); localStorage.removeItem(PORTFOLIO_CACHE_KEY); } catch {} load(true); }} />

      <CotPanel />

      <div className="last-updated">Last updated: {new Date(loaded_at).toLocaleString()}</div>
    </div>
  );
}






