import { list, put } from '@vercel/blob';
import {
  fetchPriceHistory, alignPrices, buildBenchmark,
  buildVgsReturnsMap, buildTickerReturnPoints,
} from '../../lib/portfolio.js';
import {
  calculateStandardizedReturns, calcBeta, mean, std, pctChange,
} from '../../lib/math.js';
import { displayTicker } from '../../lib/etfs.js';

const BLOB_KEY = 'watchlist.json';

async function loadWatchlist() {
  const { blobs } = await list();
  const blob = blobs.find(b => b.pathname === BLOB_KEY);
  if (!blob) return [];
  const data = await (await fetch(blob.url)).json();
  return Array.isArray(data) ? data : [];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // PUT — save watchlist tickers
  if (req.method === 'PUT') {
    const { tickers } = req.body;
    if (!Array.isArray(tickers)) return res.status(400).json({ error: 'tickers must be an array' });
    const clean = tickers.map(t => String(t).trim().toUpperCase()).filter(Boolean);
    await put(BLOB_KEY, JSON.stringify(clean), { access: 'public', contentType: 'application/json', addRandomSuffix: false });
    return res.status(200).json({ tickers: clean });
  }

  // GET — load metrics for watchlist
  if (req.method !== 'GET') return res.status(405).end();

  const tickers = await loadWatchlist();
  if (!tickers.length) return res.status(200).json({ tickers: [], perTicker: {}, loaded_at: new Date().toISOString() });

  const end = new Date();
  const start = new Date(Date.now() - 365 * 24 * 3600 * 1000);

  const { histByTicker, allDates } = await fetchPriceHistory(tickers, start, end);
  if (!allDates.length) return res.status(500).json({ error: 'No price history returned.' });

  const priceByTicker = alignPrices(tickers, histByTicker, allDates);
  const { benchmarkTwrSeries } = await buildBenchmark(start, end, allDates, () => []);
  const vgsReturnsMap = buildVgsReturnsMap(benchmarkTwrSeries);

  const perTicker = {};
  const priceSeries = {};

  for (const ticker of tickers) {
    const prices = priceByTicker[ticker];
    const label = displayTicker(ticker);
    const latestPrice = prices[prices.length - 1];

    const returns = prices.map((price, i, arr) => {
      if (i === 0 || price == null || arr[i - 1] == null) return null;
      return pctChange(price, arr[i - 1]);
    }).slice(1).filter(v => v != null);

    const sharpe = returns.length > 1 && std(returns) > 0
      ? mean(returns) / std(returns) * Math.sqrt(252)
      : null;

    const beta = calcBeta(buildTickerReturnPoints(ticker, priceByTicker, allDates), vgsReturnsMap);
    const standardizedReturns = calculateStandardizedReturns(prices);

    perTicker[label] = {
      ticker: label,
      symbol: ticker,
      latestPrice,
      sharpe,
      beta,
      oneDay:   standardizedReturns['1d'],
      oneWeek:  standardizedReturns['1w'],
      oneMonth: standardizedReturns['1m'],
      oneYear:  standardizedReturns['1y'],
    };

    priceSeries[label] = allDates
      .map((date, i) => prices[i] != null ? { date, value: prices[i] } : null)
      .filter(Boolean);
  }

  return res.status(200).json({
    tickers: tickers.map(displayTicker),
    rawTickers: tickers,
    perTicker,
    priceSeries,
    loaded_at: new Date().toISOString(),
  });
}
