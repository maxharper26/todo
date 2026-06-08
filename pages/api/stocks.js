import {
  loadTrades, getOpenTickers, fetchPriceHistory, alignPrices,
  buildPositions, buildBenchmark, buildVgsReturnsMap,
  buildPriceSeries, buildTickerReturnPoints, USD_ALLOCATION_TICKERS,
} from '../../lib/portfolio.js';
import { put, list } from '@vercel/blob';
import {
  calculateTWR, calculateDrawdown, calculateStandardizedReturns,
  calcBeta, correlation, pctChange, mean, std, formatDate,
} from '../../lib/math.js';
import { displayTicker } from '../../lib/etfs.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // ── Load trades ──────────────────────────────────────────────
    const trades = await loadTrades();
    const openTickers = getOpenTickers(trades);
    if (!openTickers.length) {
      return res.status(200).json({ tickers: [], perTicker: {}, portfolio: {}, allocations: [], sectorAllocations: [] });
    }

    // All tickers ever traded — needed for accurate TWR across closed positions
    const allHistoricalTickers = Array.from(new Set(trades.map(t => t.Ticker)));

    // ── Fetch price history ──────────────────────────────────────
    let earliest = null;
    for (const t of trades) {
      if (t.Date && (!earliest || t.Date < earliest)) earliest = t.Date;
    }
    const start = earliest
      ? new Date(earliest.getTime() - 7 * 24 * 3600 * 1000)
      : new Date(Date.now() - 365 * 24 * 3600 * 1000);
    const end = new Date();

    // Fetch prices for all historical tickers so TWR can account for closed positions
    const { histByTicker, allDates } = await fetchPriceHistory(allHistoricalTickers, start, end);
    if (!allDates.length) {
      return res.status(500).json({ error: 'No price history returned for tickers.' });
    }

    // allPriceByTicker: used for TWR (needs closed positions too)
    // openPriceByTicker: used for display metrics (open positions only)
    const allPriceByTicker = alignPrices(allHistoricalTickers, histByTicker, allDates);
    const openPriceByTicker = Object.fromEntries(openTickers.map(t => [t, allPriceByTicker[t]]));

    // ── Positions ────────────────────────────────────────────────
    const { perTicker, allocations, usdToAudRate } = await buildPositions(openTickers, trades, openPriceByTicker, allDates);

    // Cost basis for open positions only: avgPrice * openUnits per ticker.
    // Using all-buy-trades total would inflate cost by including already-sold shares.
    const total_cost = openTickers.reduce((sum, ticker) => {
      const { avgPrice, units } = perTicker[ticker];
      if (!avgPrice || !units) return sum;
      const nativeCost = avgPrice * units;
      return sum + (USD_ALLOCATION_TICKERS.has(ticker) ? nativeCost * usdToAudRate : nativeCost);
    }, 0);

    const current_value = allocations.reduce((sum, a) => sum + a.positionValue, 0);
    const portfolio_return = total_cost ? (current_value - total_cost) / total_cost : null;
    const weightedAllocations = allocations
      .map(a => ({ ...a, weight: current_value ? a.positionValue / current_value : null }))
      .sort((a, b) => (b.weight || 0) - (a.weight || 0));

    // ── Correlation matrix ───────────────────────────────────────
    const correlationMatrix = {};
    for (const a of openTickers) {
      correlationMatrix[a] = {};
      for (const b of openTickers) {
        const aRets = perTicker[a].returns;
        const bRets = perTicker[b].returns;
        correlationMatrix[a][b] = correlation(aRets, bRets);
      }
    }

    // ── Benchmark (VGS.AX) ───────────────────────────────────────
    const { benchmarkTwrSeries, benchmarkDrawdownSeries } = await buildBenchmark(start, end, allDates, calculateDrawdown);

    // ── TWR — uses allPriceByTicker so closed positions contribute correctly ──
    const twrData = calculateTWR(trades, allPriceByTicker, allDates);
    const portfolioReturnPoints = twrData.values.map((value, idx, arr) => {
      if (idx === 0) return null;
      return { date: allDates[idx], value: pctChange(value, arr[idx - 1]) };
    }).slice(1).filter(p => p && typeof p.value === 'number' && !isNaN(p.value));
    const twrReturns = portfolioReturnPoints.map(p => p.value);
    const portfolioSharpe = twrReturns.length > 1 && std(twrReturns) > 0
      ? mean(twrReturns) / std(twrReturns) * Math.sqrt(252)
      : null;
    const twrSeries = allDates.map((date, i) => ({ date, value: twrData.values[i] }));
    const drawdownSeries = allDates.map((date, i) => ({ date, value: calculateDrawdown(twrData.values)[i] }));

    // ── Standardized returns ─────────────────────────────────────
    const standardizedReturns = {};
    for (const ticker of openTickers) {
      standardizedReturns[ticker] = calculateStandardizedReturns(openPriceByTicker[ticker], {
        useLatestNonZeroOneDay: ticker === 'DXYZ',
      });
    }
    standardizedReturns['Portfolio'] = calculateStandardizedReturns(twrData.values);

    // ── Beta vs VGS ──────────────────────────────────────────────
    const vgsReturnsMap = buildVgsReturnsMap(benchmarkTwrSeries);
    const portfolioBeta = calcBeta(portfolioReturnPoints, vgsReturnsMap);
    const tickerBetas = {};
    for (const ticker of openTickers) {
      tickerBetas[ticker] = calcBeta(buildTickerReturnPoints(ticker, openPriceByTicker, allDates), vgsReturnsMap);
    }

    // ── Build display-safe response objects ──────────────────────
    const displayTickers = openTickers.map(displayTicker);
    const displayPerTicker = {};
    const displayStandardizedReturns = { Portfolio: standardizedReturns.Portfolio };
    const displayCorrelationMatrix = {};

    for (const ticker of openTickers) {
      const label = displayTicker(ticker);
      displayPerTicker[label] = { ...perTicker[ticker], ticker: label, symbol: ticker, beta: tickerBetas[ticker] ?? null };
      displayStandardizedReturns[label] = standardizedReturns[ticker];
      displayCorrelationMatrix[label] = {};
      for (const other of openTickers) {
        displayCorrelationMatrix[label][displayTicker(other)] = correlationMatrix[ticker][other];
      }
    }

    const priceSeries = buildPriceSeries(openTickers, openPriceByTicker, allDates);

    // ── Sector allocations ───────────────────────────────────────
    const sectorMap = {};
    for (const a of weightedAllocations) {
      const s = a.sector || 'Unassigned';
      sectorMap[s] = (sectorMap[s] || 0) + a.positionValue;
    }
    const sectorAllocations = Object.entries(sectorMap)
      .map(([sector, value]) => ({ sector, value, weight: current_value ? value / current_value : 0 }))
      .sort((a, b) => b.value - a.value);

    // TWR cache for portfolio site — 24hr throttle via blob uploadedAt, fire and forget
    list({ prefix: 'portfolio-twr-cache' })
      .then(({ blobs }) => {
        const stale = !blobs.length || (Date.now() - new Date(blobs[0].uploadedAt).getTime()) > 24 * 60 * 60 * 1000;
        if (!stale) return;
        return put(
          'portfolio-twr-cache.json',
          JSON.stringify({
            twr: twrSeries.map(p => ({ date: p.date, twr: p.value })),
            vgs: benchmarkTwrSeries.map(p => ({ date: p.date, twr: p.value })),
          }),
          { access: 'public', contentType: 'application/json', addRandomSuffix: false }
        );
      })
      .catch(e => console.warn('TWR cache write failed:', e.message));

    return res.status(200).json({
      tickers: displayTickers,
      perTicker: displayPerTicker,
      allocations: weightedAllocations.map(a => ({ ...a, ticker: displayTicker(a.ticker), symbol: a.ticker })),
      portfolio: { total_cost, current_value, portfolio_return, sharpe: portfolioSharpe, beta: portfolioBeta },
      twrSeries,
      drawdownSeries,
      benchmarkTwrSeries,
      benchmarkDrawdownSeries,
      standardizedReturns: displayStandardizedReturns,
      correlationMatrix: displayCorrelationMatrix,
      priceSeries,
      sectorAllocations,
      loaded_at: new Date().toISOString(),
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: String(err) });
  }
}
