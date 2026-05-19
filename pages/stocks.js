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
  if (value == null) return { color: '#57606a' };
  return {
    color: value > 0 ? '#1a7f37' : value < 0 ? '#d1242f' : '#57606a',
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
    color: value == null ? '#57606a' : '#24292f',
    fontWeight: strong ? 700 : 500,
  };
  if (value == null || !stats || stats.min === stats.max) return style;

  const ratio = (value - stats.min) / (stats.max - stats.min);
  const red = [255, 235, 232];
  const white = [255, 255, 255];
  const green = [229, 245, 234];

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
  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

export default function StocksPage() {
  const [data, setData] = useState(null);
  const [cot, setCot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [res, cotRes] = await Promise.all([fetch('/api/stocks'), fetch('/api/cot')]);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const cotJson = await cotRes.json();
        setData(json);
        setCot(cotJson);
      } catch (err) {
        setError(err.message || 'Failed to load stock data.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div style={{padding:20}}><h1>Stocks</h1><p>Loading latest market data…</p></div>;
  if (error) return <div style={{padding:20}}><h1>Stocks</h1><p style={{color:'red'}}>{error}</p></div>;
  if (!data) return <div style={{padding:20}}>No data</div>;

  const { perTicker, portfolio, allocations, twrSeries, drawdownSeries, benchmarkTwrSeries, benchmarkDrawdownSeries, standardizedReturns, correlationMatrix, lowCorrelationEtfs, tickers, loaded_at } = data;
  const portfolioTotalReturn = twrSeries?.length ? (twrSeries[twrSeries.length - 1].value - 100) / 100 : null;
  const returnRows = standardizedReturns ? [
    {
      asset: 'Portfolio',
      isPortfolio: true,
      totalReturn: portfolioTotalReturn,
      oneDay: standardizedReturns.Portfolio?.['1d'],
      oneWeek: standardizedReturns.Portfolio?.['1w'],
      oneMonth: standardizedReturns.Portfolio?.['1m'],
      oneYear: standardizedReturns.Portfolio?.['1y'],
      sharpe: portfolio?.sharpe,
    },
    ...tickers.map(ticker => ({
      asset: ticker,
      totalReturn: perTicker[ticker]?.totalReturn,
      oneDay: standardizedReturns[ticker]?.['1d'],
      oneWeek: standardizedReturns[ticker]?.['1w'],
      oneMonth: standardizedReturns[ticker]?.['1m'],
      oneYear: standardizedReturns[ticker]?.['1y'],
      sharpe: perTicker[ticker]?.sharpe,
    }))
  ] : [];
  const columnStats = {
    totalReturn: getColumnStats(returnRows, 'totalReturn'),
    oneDay: getColumnStats(returnRows, 'oneDay'),
    oneWeek: getColumnStats(returnRows, 'oneWeek'),
    oneMonth: getColumnStats(returnRows, 'oneMonth'),
    oneYear: getColumnStats(returnRows, 'oneYear'),
    sharpe: getColumnStats(returnRows, 'sharpe'),
  };

  return (
    <div style={{padding:20, maxWidth: 1280, margin: '0 auto'}}>
      <h1 style={{marginTop: 0}}>Stocks</h1>

      <div style={{marginBottom: 24, background:'#fff', border:'1px solid #d8dee4', borderRadius:8, padding: 18}}>
        <h2 style={{marginTop:0, marginBottom: 14}}>Standardized Returns</h2>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%', minWidth:920, borderCollapse:'collapse'}}>
            <thead>
              <tr style={{textAlign:'left', borderBottom:'1px solid #d8dee4', color: '#57606a', fontSize: 13}}>
                <th style={{padding:'11px 8px'}}>Asset</th>
                <th style={{padding:'11px 8px', textAlign:'right'}}>Total Return</th>
                <th style={{padding:'11px 8px', textAlign:'right'}}>1d</th>
                <th style={{padding:'11px 8px', textAlign:'right'}}>1w</th>
                <th style={{padding:'11px 8px', textAlign:'right'}}>1m</th>
                <th style={{padding:'11px 8px', textAlign:'right'}}>1y</th>
                <th style={{padding:'11px 8px', textAlign:'right'}}>Sharpe Ratio</th>
              </tr>
            </thead>
            <tbody>
              {returnRows.map(row => (
                <tr
                  key={row.asset}
                  style={{
                    fontWeight: row.isPortfolio ? 'bold' : 'normal',
                    borderBottom: row.isPortfolio ? '1px solid #d8dee4' : '1px solid #f0f0f0',
                  }}
                >
                  <td style={{padding: row.isPortfolio ? '12px 8px' : '11px 8px', fontWeight: row.isPortfolio ? 700 : 600}}>{row.asset}</td>
                  <td style={{padding: row.isPortfolio ? '12px 8px' : '11px 8px', textAlign:'right', ...conditionalCellStyle(row.totalReturn, columnStats.totalReturn, row.isPortfolio)}}>{pct(row.totalReturn)}</td>
                  <td style={{padding: row.isPortfolio ? '12px 8px' : '11px 8px', textAlign:'right', ...conditionalCellStyle(row.oneDay, columnStats.oneDay, row.isPortfolio)}}>{pct(row.oneDay)}</td>
                  <td style={{padding: row.isPortfolio ? '12px 8px' : '11px 8px', textAlign:'right', ...conditionalCellStyle(row.oneWeek, columnStats.oneWeek, row.isPortfolio)}}>{pct(row.oneWeek)}</td>
                  <td style={{padding: row.isPortfolio ? '12px 8px' : '11px 8px', textAlign:'right', ...conditionalCellStyle(row.oneMonth, columnStats.oneMonth, row.isPortfolio)}}>{pct(row.oneMonth)}</td>
                  <td style={{padding: row.isPortfolio ? '12px 8px' : '11px 8px', textAlign:'right', ...conditionalCellStyle(row.oneYear, columnStats.oneYear, row.isPortfolio)}}>{pct(row.oneYear)}</td>
                  <td style={{padding: row.isPortfolio ? '12px 8px' : '11px 8px', textAlign:'right', ...conditionalCellStyle(row.sharpe, columnStats.sharpe, row.isPortfolio)}}>{fmt(row.sharpe)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {twrSeries && <LineChart points={twrSeries} comparatorPoints={benchmarkTwrSeries} height={390} title="Cumulative Portfolio TWR" />}

      {drawdownSeries && <AreaChart points={drawdownSeries} comparatorPoints={benchmarkDrawdownSeries} height={340} title="Drawdown" color="#d1242f" />}

      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(min(100%, 500px), 1fr))', gap: 24, marginBottom: 24}}>
        {correlationMatrix && <Heatmap matrix={correlationMatrix} tickers={tickers} size={540} />}
        {allocations && <PieChart allocations={allocations} size={520} />}
      </div>

      {lowCorrelationEtfs?.length > 0 && (
        <div style={{marginBottom: 24, background:'#fff', borderRadius:8, padding: 18}}>
          <h2 style={{marginTop:0, marginBottom: 14}}>Lowest ETF Correlations</h2>
          <div style={{overflowX:'auto', overflowY:'auto', maxHeight:480, borderRadius:6, border:'1px solid #d8dee4'}}>
            <table style={{width:'100%', minWidth:600, borderCollapse:'collapse'}}>
              <thead>
                <tr style={{textAlign:'left', color: '#57606a', fontSize: 13, position:'sticky', top:0, background:'#f6f8fa', zIndex:1}}>
                  <th style={{padding:'10px 12px', borderBottom:'2px solid #d8dee4', whiteSpace:'nowrap'}}>Ticker</th>
                  <th style={{padding:'10px 12px', borderBottom:'2px solid #d8dee4'}}>ETF</th>
                  <th style={{padding:'10px 12px', borderBottom:'2px solid #d8dee4', textAlign:'right', whiteSpace:'nowrap'}}>Correlation</th>
                  <th style={{padding:'10px 12px', borderBottom:'2px solid #d8dee4', textAlign:'right', whiteSpace:'nowrap'}}>1m Return</th>
                  <th style={{padding:'10px 12px', borderBottom:'2px solid #d8dee4', textAlign:'right', whiteSpace:'nowrap'}}>Days</th>
                </tr>
              </thead>
              <tbody>
                {lowCorrelationEtfs.map((item, i) => (
                  <tr key={item.symbol} style={{borderBottom:'1px solid #f0f0f0', background: i % 2 === 0 ? '#fff' : '#fafafa'}}>
                    <td style={{padding:'10px 12px', fontWeight:700, whiteSpace:'nowrap'}}>{item.ticker}</td>
                    <td style={{padding:'10px 12px', color:'#24292f'}}>{item.name}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', fontVariantNumeric:'tabular-nums', ...returnStyle(item.correlation != null ? -item.correlation : null)}}>{fmt(item.correlation)}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', fontVariantNumeric:'tabular-nums', ...returnStyle(item.oneMonthReturn)}}>{pct(item.oneMonthReturn)}</td>
                    <td style={{padding:'10px 12px', textAlign:'right', color:'#57606a'}}>{item.observations}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {cot?.signals?.length > 0 && (
        <div style={{marginBottom: 24, background:'#fff', border:'1px solid #d8dee4', borderRadius:8, padding: 18}}>
          <h2 style={{marginTop:0, marginBottom: 4}}>COT Weekly Movers</h2>
          <p style={{marginTop:0, marginBottom:14, fontSize:13, color:'#57606a'}}>Managed money ratio shifts ≥ 0.035 — last updated {cot.last_updated}</p>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%', minWidth:580, borderCollapse:'collapse'}}>
              <thead>
                <tr style={{textAlign:'left', borderBottom:'2px solid #d8dee4', color:'#57606a', fontSize:13, background:'#f6f8fa'}}>
                  <th style={{padding:'10px 12px'}}>Market</th>
                  <th style={{padding:'10px 12px'}}>Category</th>
                  <th style={{padding:'10px 12px', textAlign:'right'}}>Prev</th>
                  <th style={{padding:'10px 12px', textAlign:'right'}}>Now</th>
                  <th style={{padding:'10px 12px', textAlign:'right'}}>Shift</th>
                  <th style={{padding:'10px 12px', textAlign:'right'}}>Long / Short</th>
                </tr>
              </thead>
              <tbody>
                {cot.signals.map((s, i) => {
                  const up = s.delta > 0;
                  const colour = up ? '#1a7f37' : '#d1242f';
                  const arrow = up ? '▲' : '▼';
                  return (
                    <tr key={i} style={{borderBottom:'1px solid #f0f0f0', background: i % 2 === 0 ? '#fff' : '#fafafa'}}>
                      <td style={{padding:'10px 12px', fontWeight:600}}>{s.market}</td>
                      <td style={{padding:'10px 12px', color:'#57606a', fontSize:13}}>{s.category}</td>
                      <td style={{padding:'10px 12px', textAlign:'right', fontVariantNumeric:'tabular-nums'}}>{s.ratio_prev.toFixed(2)}</td>
                      <td style={{padding:'10px 12px', textAlign:'right', fontVariantNumeric:'tabular-nums', color:colour, fontWeight:700}}>{arrow} {s.ratio_now.toFixed(2)}</td>
                      <td style={{padding:'10px 12px', textAlign:'right', fontVariantNumeric:'tabular-nums', color:colour, fontWeight:700}}>{s.delta > 0 ? '+' : ''}{s.delta.toFixed(3)}</td>
                      <td style={{padding:'10px 12px', textAlign:'right', fontVariantNumeric:'tabular-nums', color:'#57606a'}}>{s.long.toLocaleString()} / {s.short.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{marginTop:12, fontSize:12, color:'#666'}}>Last updated: {new Date(loaded_at).toLocaleString()}</div>
    </div>
  );
}
