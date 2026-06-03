// Super balance tracker
// Hardcoded schedule: $3360 on 2026-03-15, then $800 every 15th thereafter.
// Allocation: 80% VGS.AX, 20% VAS.AX.
// Returns TWR series rebased to 100, plus headline stats.

import { fetchYahooChart } from '../../lib/yahoo.js';
import { formatDate } from '../../lib/math.js';

const START_DATE = '2026-03-15';
const INITIAL_CONTRIBUTION = 3360;
const RECURRING_CONTRIBUTION = 800;
const ALLOC = { 'VGS.AX': 0.8, 'VAS.AX': 0.2 };

// Generate contribution schedule from start to today
function buildContributions() {
  const contributions = [];
  const start = new Date(START_DATE);
  const today = new Date();

  // Initial
  contributions.push({ date: START_DATE, amount: INITIAL_CONTRIBUTION });

  // Recurring: every 15th of month after start
  let d = new Date(start.getFullYear(), start.getMonth() + 1, 15);
  while (d <= today) {
    contributions.push({ date: formatDate(d), amount: RECURRING_CONTRIBUTION });
    d = new Date(d.getFullYear(), d.getMonth() + 1, 15);
  }

  return contributions;
}

// Forward-fill prices across allDates
function alignPrices(series, allDates) {
  const map = series.reduce((m, p) => { m[p.date] = p.close; return m; }, {});
  let last = null;
  return allDates.map(date => {
    if (map[date] != null) last = map[date];
    return last;
  });
}

// TWR with external cash flows.
// On a contribution date we buy units at that day's price.
// Between contribution dates the portfolio just drifts with prices.
function computeTwr(allDates, pricesByTicker, contributions) {
  const contribByDate = {};
  for (const c of contributions) contribByDate[c.date] = c.amount;

  // units held per ticker
  const holdings = Object.fromEntries(Object.keys(ALLOC).map(t => [t, 0]));

  const values = [];
  let prevValue = 0;
  const twrMultiplier = []; // chain-linked sub-period returns

  for (let i = 0; i < allDates.length; i++) {
    const date = allDates[i];
    const contrib = contribByDate[date] ?? 0;

    // Buy units if there's a contribution on this date
    if (contrib > 0) {
      for (const [ticker, weight] of Object.entries(ALLOC)) {
        const price = pricesByTicker[ticker][i];
        if (price) holdings[ticker] += (contrib * weight) / price;
      }
    }

    // Portfolio value after any purchase
    let currValue = 0;
    for (const [ticker, units] of Object.entries(holdings)) {
      const price = pricesByTicker[ticker][i];
      if (price) currValue += units * price;
    }

    // Sub-period return: denominator = prevValue + today's cash flow
    const denom = prevValue + contrib;
    twrMultiplier.push(denom > 0 ? currValue / denom : 1);
    prevValue = currValue;
    values.push(currValue);
  }

  // Rebase to 100
  let idx = 100;
  const twrSeries = allDates.map((date, i) => {
    idx *= twrMultiplier[i];
    return { date, value: idx };
  });

  return { twrSeries, portfolioValues: values };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const contributions = buildContributions();
    const start = new Date(START_DATE);
    // Go back a few days before start to get price on first contribution date
    const fetchStart = new Date(start.getTime() - 7 * 24 * 3600 * 1000);
    const end = new Date();

    const tickers = Object.keys(ALLOC);
    const histByTicker = {};
    const allDatesSet = new Set();

    for (const ticker of tickers) {
      const series = await fetchYahooChart(ticker, fetchStart, end);
      histByTicker[ticker] = series;
      series.forEach(p => allDatesSet.add(p.date));
    }

    const allDates = Array.from(allDatesSet).sort().filter(d => d >= START_DATE);
    const pricesByTicker = Object.fromEntries(
      tickers.map(t => [t, alignPrices(histByTicker[t], allDates)])
    );

    const { twrSeries, portfolioValues } = computeTwr(allDates, pricesByTicker, contributions);

    // Headline stats
    const currentValue = portfolioValues[portfolioValues.length - 1] ?? 0;
    const totalContributed = contributions.reduce((s, c) => s + c.amount, 0);
    const pnl = currentValue - totalContributed;
    const totalReturn = totalContributed > 0 ? pnl / totalContributed : null;

    return res.status(200).json({
      twrSeries,
      currentValue,
      totalContributed,
      pnl,
      totalReturn,
      contributions,
      loaded_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: String(err) });
  }
}
