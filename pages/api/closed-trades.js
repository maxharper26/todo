import { list } from '@vercel/blob';

async function getTrades() {
  const { blobs } = await list();
  const blob = blobs.find(b => b.pathname === 'portfolio.json');
  if (!blob) return [];
  const res = await fetch(blob.url);
  return await res.json();
}

// FIFO matching: for each sell, match against oldest buy lots.
// Returns an array of closed lot records.
function buildClosedLots(trades) {
  // Group raw trades by ticker, sorted by date asc
  const byTicker = {};
  for (const t of trades) {
    const ticker = t.ticker?.trim().toUpperCase();
    if (!ticker) continue;
    if (!byTicker[ticker]) byTicker[ticker] = [];
    byTicker[ticker].push(t);
  }

  const closedLots = [];

  for (const [ticker, tickerTrades] of Object.entries(byTicker)) {
    const sorted = [...tickerTrades].sort((a, b) => a.date.localeCompare(b.date));

    // Net units to determine if fully closed
    const netUnits = sorted.reduce((sum, t) =>
      sum + (t.action === 'sell' ? -t.units : t.units), 0);

    // Only include net-zero tickers (fully closed positions)
    if (Math.abs(netUnits) > 0.0001) continue;

    // FIFO queue of buy lots: { date, price, units }
    const buyQueue = [];

    for (const t of sorted) {
      if (t.action === 'buy') {
        buyQueue.push({ date: t.date, price: t.price, remaining: t.units });
      } else if (t.action === 'sell') {
        let toSell = t.units; // sell units are positive in raw blob
        const sellDate = t.date;
        const sellPrice = t.price;

        while (toSell > 0.0001 && buyQueue.length > 0) {
          const lot = buyQueue[0];
          const matched = Math.min(lot.remaining, toSell);

          const openDate = lot.date;
          const closeDate = sellDate;
          const daysHeld = Math.round(
            (new Date(closeDate) - new Date(openDate)) / (1000 * 60 * 60 * 24)
          );
          const costBasis = matched * lot.price;
          const proceeds = matched * sellPrice;
          const pnl = proceeds - costBasis;
          const totalReturn = costBasis > 0 ? pnl / costBasis : null;

          closedLots.push({
            ticker,
            openDate,
            closeDate,
            daysHeld,
            units: matched,
            costBasis,
            proceeds,
            pnl,
            totalReturn,
          });

          lot.remaining -= matched;
          toSell -= matched;
          if (lot.remaining < 0.0001) buyQueue.shift();
        }
      }
    }
  }

  // Sort by close date desc
  return closedLots.sort((a, b) => b.closeDate.localeCompare(a.closeDate));
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const trades = await getTrades();
    const closedLots = buildClosedLots(trades);

    // Aggregate by ticker for summary view
    const byTicker = {};
    for (const lot of closedLots) {
      if (!byTicker[lot.ticker]) {
        byTicker[lot.ticker] = {
          ticker: lot.ticker,
          openDate: lot.openDate,
          closeDate: lot.closeDate,
          daysHeld: lot.daysHeld,
          costBasis: 0,
          proceeds: 0,
          pnl: 0,
          lots: [],
        };
      }
      const entry = byTicker[lot.ticker];
      entry.costBasis += lot.costBasis;
      entry.proceeds += lot.proceeds;
      entry.pnl += lot.pnl;
      entry.lots.push(lot);
      // openDate = earliest open, closeDate = latest close
      if (lot.openDate < entry.openDate) entry.openDate = lot.openDate;
      if (lot.closeDate > entry.closeDate) entry.closeDate = lot.closeDate;
    }

    const summary = Object.values(byTicker).map(e => ({
      ...e,
      totalReturn: e.costBasis > 0 ? e.pnl / e.costBasis : null,
      daysHeld: Math.round(
        (new Date(e.closeDate) - new Date(e.openDate)) / (1000 * 60 * 60 * 24)
      ),
    })).sort((a, b) => b.closeDate.localeCompare(a.closeDate));

    return res.status(200).json({ summary, lots: closedLots });
  } catch (e) {
    console.error('closed-trades error:', e);
    return res.status(500).json({ error: e.message });
  }
}
