// Portfolio loading, position calculations, price alignment

import { fetchYahooChart, fetchUsdToAudRate } from './yahoo.js';
import { pctChange, mean, std, formatDate } from './math.js';
import { displayTicker } from './etfs.js';

export const USD_ALLOCATION_TICKERS = new Set(['DXYZ']);

function toNumber(v) {
  if (v === null || v === undefined) return 0;
  return Number(String(v).replace(/[^0-9.-]+/g, '')) || 0;
}

function parseDateFlexible(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

// Normalise raw trades array from portfolio.json
export async function loadTrades(rawTrades) {
  return rawTrades
    .filter(r => r.ticker && r.date)
    .map(r => ({
      Ticker: r.ticker,
      Date: parseDateFlexible(r.date),
      Price: toNumber(r.price),
      Units: toNumber(r.units) * (r.action === 'sell' ? -1 : 1),
      Action: r.action || 'buy',
      sector: r.sector || null,
    }))
    .filter(r => r.Date);
}

// Returns open tickers (net units > 0)
export function getOpenTickers(trades) {
  const allTickers = Array.from(new Set(trades.map(t => t.Ticker)));
  const netUnits = {};
  for (const t of trades) netUnits[t.Ticker] = (netUnits[t.Ticker] || 0) + t.Units;
  return allTickers.filter(t => netUnits[t] > 0);
}

// Compute avg price of currently-held units using FIFO cost basis.
// Sells consume the oldest buy lots first, so avgPrice only reflects
// the buy lots that are still open — not historical lots already exited.
function calcAvgPriceFifo(tradesFor) {
  const sorted = [...tradesFor].sort((a, b) => a.Date - b.Date);
  // Queue of { units, price } representing remaining buy lots
  const lots = [];
  for (const t of sorted) {
    if (t.Action === 'buy') {
      lots.push({ units: t.Units, price: t.Price }); // Units positive
    } else {
      // Sell: consume from the front of the queue (FIFO)
      let toConsume = Math.abs(t.Units);
      while (toConsume > 0 && lots.length > 0) {
        if (lots[0].units <= toConsume) {
          toConsume -= lots[0].units;
          lots.shift();
        } else {
          lots[0].units -= toConsume;
          toConsume = 0;
        }
      }
    }
  }
  // Remaining lots = current open position
  const totalUnits = lots.reduce((s, l) => s + l.units, 0);
  if (!totalUnits) return null;
  const totalCost = lots.reduce((s, l) => s + l.units * l.price, 0);
  return totalCost / totalUnits;
}

// Fetch price history for all tickers, returns { histByTicker, allDates }
export async function fetchPriceHistory(tickers, start, end) {
  const histByTicker = {};
  const allDatesSet = new Set();
  for (const ticker of tickers) {
    try {
      const series = await fetchYahooChart(ticker, start, end);
      histByTicker[ticker] = series;
      series.forEach(p => allDatesSet.add(p.date));
    } catch (e) {
      console.warn('Yahoo chart failed for', ticker, e?.message);
      histByTicker[ticker] = [];
    }
  }
  return { histByTicker, allDates: Array.from(allDatesSet).sort() };
}

// Forward-fill prices to a shared date array
export function alignPrices(tickers, histByTicker, allDates) {
  const priceByTicker = {};
  for (const ticker of tickers) {
    const rowMap = histByTicker[ticker].reduce((m, r) => ({ ...m, [r.date]: r.close }), {});
    let last = null;
    priceByTicker[ticker] = allDates.map(date => {
      if (rowMap[date] != null) last = rowMap[date];
      return last;
    });
  }
  return priceByTicker;
}

// Compute per-ticker position stats and allocations
export async function buildPositions(tickers, trades, priceByTicker, allDates) {
  const latestIdx = allDates.length - 1;
  let usdToAudRate = 1;
  if (tickers.some(t => USD_ALLOCATION_TICKERS.has(t))) {
    try { usdToAudRate = await fetchUsdToAudRate(); }
    catch (e) { console.warn('USD/AUD fetch failed:', e?.message); }
  }

  const perTicker = {};
  const allocations = [];

  for (const ticker of tickers) {
    const series = priceByTicker[ticker];
    const latestPrice = series[latestIdx];
    const tradesFor = trades.filter(t => t.Ticker === ticker);
    const openUnits = tradesFor.reduce((sum, t) => sum + t.Units, 0);

    // FIFO avg price — only reflects cost basis of currently held units
    const avgPrice = calcAvgPriceFifo(tradesFor);

    const nativeValue = latestPrice != null ? latestPrice * openUnits : 0;
    const positionValue = USD_ALLOCATION_TICKERS.has(ticker) ? nativeValue * usdToAudRate : nativeValue;
    const totalReturn = avgPrice && latestPrice ? (latestPrice - avgPrice) / avgPrice : null;

    const returns = series.map((price, i, arr) => {
      if (i === 0 || price == null || arr[i - 1] == null) return null;
      return pctChange(price, arr[i - 1]);
    }).slice(1);
    const sharpe = returns.length > 1 && std(returns) > 0
      ? mean(returns) / std(returns) * Math.sqrt(252)
      : null;

    perTicker[ticker] = { latestPrice, units: openUnits, avgPrice, positionValue, totalReturn, sharpe, returns, sector: tradesFor[0]?.sector || null };
    allocations.push({ ticker, units: openUnits, latestPrice, positionValue, nativePositionValue: nativeValue, allocationCurrency: 'AUD', sector: tradesFor[0]?.sector || null });
  }

  return { perTicker, allocations, usdToAudRate };
}

// Build VGS benchmark TWR and drawdown series
export async function buildBenchmark(start, end, allDates, calculateDrawdown) {
  try {
    const vgsSeries = await fetchYahooChart('VGS.AX', start, end);
    if (vgsSeries.length < 2) return { benchmarkTwrSeries: null, benchmarkDrawdownSeries: null };
    const vgsMap = vgsSeries.reduce((m, p) => ({ ...m, [p.date]: p.close }), {});
    let lastVgs = null;
    const vgsByDate = allDates.map(date => {
      if (vgsMap[date] != null) lastVgs = vgsMap[date];
      return lastVgs;
    });
    const startVal = vgsByDate.find(v => v != null) ?? 1;
    const indexed = vgsByDate.map(v => v != null ? (v / startVal) * 100 : null);
    return {
      benchmarkTwrSeries: allDates.map((date, i) => ({ date, value: indexed[i] })).filter(p => p.value != null),
      benchmarkDrawdownSeries: allDates.map((date, i) => ({ date, value: calculateDrawdown(indexed.map(v => v ?? 100))[i] })),
    };
  } catch (e) {
    console.warn('VGS benchmark fetch failed:', e?.message);
    return { benchmarkTwrSeries: null, benchmarkDrawdownSeries: null };
  }
}

// Build VGS returns map for beta calculation
export function buildVgsReturnsMap(benchmarkTwrSeries) {
  const map = new Map();
  if (!benchmarkTwrSeries) return map;
  for (let i = 1; i < benchmarkTwrSeries.length; i++) {
    const prev = benchmarkTwrSeries[i - 1].value;
    const curr = benchmarkTwrSeries[i].value;
    if (prev && curr) map.set(benchmarkTwrSeries[i].date, (curr - prev) / prev);
  }
  return map;
}

// Build raw price series per ticker for the single asset viewer
export function buildPriceSeries(tickers, priceByTicker, allDates) {
  const priceSeries = {};
  for (const ticker of tickers) {
    const label = displayTicker(ticker);
    const prices = priceByTicker[ticker];
    priceSeries[label] = allDates
      .map((date, i) => prices[i] != null ? { date, value: prices[i] } : null)
      .filter(Boolean);
  }
  return priceSeries;
}

// Build ticker daily return points for beta/correlation
export function buildTickerReturnPoints(ticker, priceByTicker, allDates) {
  const prices = priceByTicker[ticker];
  return allDates.slice(1).map((date, i) => {
    const curr = prices[i + 1], prev = prices[i];
    if (curr == null || prev == null || prev === 0) return null;
    return { date, value: (curr - prev) / prev };
  }).filter(Boolean);
}

export { displayTicker };
