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

export default function StocksPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/stocks');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setData(json);
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

  const { perTicker, portfolio, allocations, twrSeries, drawdownSeries, standardizedReturns, correlationMatrix, tickers, loaded_at } = data;
  const portfolioTotalReturn = twrSeries?.length ? (twrSeries[twrSeries.length - 1].value - 100) / 100 : null;

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
              {standardizedReturns && (
                <>
                  <tr style={{fontWeight:'bold', borderBottom:'1px solid #d8dee4', background: '#f6f8fa'}}>
                    <td style={{padding:'12px 8px'}}>Portfolio</td>
                    <td style={{padding:'12px 8px', textAlign:'right', ...returnStyle(portfolioTotalReturn, true)}}>{pct(portfolioTotalReturn)}</td>
                    <td style={{padding:'12px 8px', textAlign:'right', ...returnStyle(standardizedReturns.Portfolio?.['1d'], true)}}>{pct(standardizedReturns.Portfolio?.['1d'])}</td>
                    <td style={{padding:'12px 8px', textAlign:'right', ...returnStyle(standardizedReturns.Portfolio?.['1w'], true)}}>{pct(standardizedReturns.Portfolio?.['1w'])}</td>
                    <td style={{padding:'12px 8px', textAlign:'right', ...returnStyle(standardizedReturns.Portfolio?.['1m'], true)}}>{pct(standardizedReturns.Portfolio?.['1m'])}</td>
                    <td style={{padding:'12px 8px', textAlign:'right', ...returnStyle(standardizedReturns.Portfolio?.['1y'], true)}}>{pct(standardizedReturns.Portfolio?.['1y'])}</td>
                    <td style={{padding:'12px 8px', textAlign:'right'}}>{fmt(portfolio?.sharpe)}</td>
                  </tr>
                  {tickers.map(ticker => (
                    <tr key={ticker} style={{borderBottom:'1px solid #f0f0f0'}}>
                      <td style={{padding:'11px 8px', fontWeight: 600}}>{ticker}</td>
                      <td style={{padding:'11px 8px', textAlign:'right', ...returnStyle(perTicker[ticker]?.totalReturn)}}>{pct(perTicker[ticker]?.totalReturn)}</td>
                      <td style={{padding:'11px 8px', textAlign:'right', ...returnStyle(standardizedReturns[ticker]?.['1d'])}}>{pct(standardizedReturns[ticker]?.['1d'])}</td>
                      <td style={{padding:'11px 8px', textAlign:'right', ...returnStyle(standardizedReturns[ticker]?.['1w'])}}>{pct(standardizedReturns[ticker]?.['1w'])}</td>
                      <td style={{padding:'11px 8px', textAlign:'right', ...returnStyle(standardizedReturns[ticker]?.['1m'])}}>{pct(standardizedReturns[ticker]?.['1m'])}</td>
                      <td style={{padding:'11px 8px', textAlign:'right', ...returnStyle(standardizedReturns[ticker]?.['1y'])}}>{pct(standardizedReturns[ticker]?.['1y'])}</td>
                      <td style={{padding:'11px 8px', textAlign:'right'}}>{fmt(perTicker[ticker]?.sharpe)}</td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {twrSeries && <LineChart points={twrSeries} height={390} title="Cumulative Portfolio TWR" />}

      {drawdownSeries && <AreaChart points={drawdownSeries} height={340} title="Drawdown" color="#d1242f" />}

      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(min(100%, 500px), 1fr))', gap: 24, marginBottom: 24}}>
        {correlationMatrix && <Heatmap matrix={correlationMatrix} tickers={tickers} size={540} />}
        {allocations && <PieChart allocations={allocations} size={520} />}
      </div>

      <div style={{marginTop:12, fontSize:12, color:'#666'}}>Last updated: {new Date(loaded_at).toLocaleString()}</div>
    </div>
  );
}
