import { loadTrades, getOpenTickers, fetchPriceHistory, alignPrices, buildPositions, USD_ALLOCATION_TICKERS } from '../../lib/portfolio.js';
import { calculateTWR, pctChange, mean, std } from '../../lib/math.js';
import { getLowCorrelationEtfs, etfListHash } from '../../lib/etfs.js';
import { head } from '@vercel/blob';

async function getRawTrades() {
  try {
    const blob = await head('portfolio.json');
    const res = await fetch(blob.url);
    return await res.json();
  } catch {
    return [];
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const rawTrades = await getRawTrades();
    const trades = await loadTrades(rawTrades);
    const openTickers = getOpenTickers(trades);
    if (!openTickers.length) {
      return res.status(200).json({ lowCorrelationEtfs: [], etfUpdatedAt: null });
    }

    const allHistoricalTickers = Array.from(new Set(trades.map(t => t.Ticker)));

    let earliest = null;
    for (const t of trades) {
      if (t.Date && (!earliest || t.Date < earliest)) earliest = t.Date;
    }
    const start = earliest
      ? new Date(earliest.getTime() - 7 * 24 * 3600 * 1000)
      : new Date(Date.now() - 365 * 24 * 3600 * 1000);
    const end = new Date();

    const { histByTicker, allDates } = await fetchPriceHistory(allHistoricalTickers, start, end);
    if (!allDates.length) return res.status(200).json({ lowCorrelationEtfs: [], etfUpdatedAt: null });

    // allPriceByTicker for TWR (includes closed positions), openPriceByTicker for buildPositions
    const allPriceByTicker = alignPrices(allHistoricalTickers, histByTicker, allDates);
    const openPriceByTicker = Object.fromEntries(openTickers.map(t => [t, allPriceByTicker[t]]));

    const { usdToAudRate } = await buildPositions(openTickers, trades, openPriceByTicker, allDates);
    const twrData = calculateTWR(trades, allPriceByTicker, allDates);
    const portfolioReturnPoints = twrData.values.map((value, idx, arr) => {
      if (idx === 0) return null;
      return { date: allDates[idx], value: pctChange(value, arr[idx - 1]) };
    }).slice(1).filter(p => p && typeof p.value === 'number' && !isNaN(p.value));

    const hash = etfListHash();
    const cacheKey = `${hash}:${openTickers.join(',')}`;
    const { data: lowCorrelationEtfs, updatedAt: etfUpdatedAt } = await getLowCorrelationEtfs(
      portfolioReturnPoints.slice(-252),
      cacheKey
    );

    return res.status(200).json({ lowCorrelationEtfs, etfUpdatedAt });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: String(err) });
  }
}
