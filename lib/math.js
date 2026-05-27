// Pure maths utilities — no I/O, no side effects

export function pctChange(latest, prev) {
  if (latest == null || prev == null || prev === 0) return null;
  return (latest - prev) / prev;
}

export function mean(values) {
  const nums = values.filter(v => typeof v === 'number' && !isNaN(v));
  if (!nums.length) return 0;
  return nums.reduce((sum, v) => sum + v, 0) / nums.length;
}

export function std(values) {
  const nums = values.filter(v => typeof v === 'number' && !isNaN(v));
  if (nums.length < 2) return 0;
  const avg = mean(nums);
  const variance = nums.reduce((sum, v) => sum + (v - avg) * (v - avg), 0) / (nums.length - 1);
  return Math.sqrt(variance);
}

export function correlation(x, y) {
  const pairs = [];
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const xi = x[i], yi = y[i];
    if (typeof xi === 'number' && typeof yi === 'number' && !isNaN(xi) && !isNaN(yi)) {
      pairs.push([xi, yi]);
    }
  }
  if (!pairs.length) return null;
  const xs = pairs.map(p => p[0]);
  const ys = pairs.map(p => p[1]);
  const mx = mean(xs), my = mean(ys);
  const num = pairs.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0);
  const den = Math.sqrt(pairs.reduce((s, p) => s + (p[0] - mx) ** 2, 0)) *
              Math.sqrt(pairs.reduce((s, p) => s + (p[1] - my) ** 2, 0));
  return den === 0 ? null : num / den;
}

// formatDate lives here since it's used by TWR and callers
export function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

export function calculateTWR(trades, priceByTicker, allDates) {
  // Initialise holdings for ALL tickers that appear in trades, not just priceByTicker keys.
  // This ensures sold-out positions are properly tracked through their held period.
  const holdings = {};
  for (const trade of trades) holdings[trade.Ticker] = 0;

  const flows = {};
  for (const date of allDates) flows[date] = 0;
  trades.forEach(trade => {
    const key = formatDate(trade.Date);
    flows[key] = (flows[key] || 0) + trade.Price * trade.Units;
  });

  const holdingsByDate = {};
  for (const date of allDates) {
    trades.forEach(trade => {
      if (formatDate(trade.Date) === date) {
        holdings[trade.Ticker] = (holdings[trade.Ticker] || 0) + trade.Units;
      }
    });
    holdingsByDate[date] = { ...holdings };
  }

  const twrReturns = [];
  let prevValue = 0;
  for (let i = 0; i < allDates.length; i++) {
    const date = allDates[i];
    const hold = holdingsByDate[date];
    let currValue = 0;
    for (const ticker of Object.keys(hold)) {
      const prices = priceByTicker[ticker];
      const price = prices ? prices[i] : null;
      if (price != null && hold[ticker]) currValue += price * hold[ticker];
    }
    const flow = flows[date] || 0;
    const denom = prevValue + flow;
    twrReturns.push(denom > 0 ? (currValue - denom) / denom : 0);
    prevValue = currValue;
  }

  let indexVal = 100;
  const values = twrReturns.map(ret => {
    indexVal *= (1 + ret);
    return indexVal;
  });

  return { values, dailyReturns: twrReturns };
}

export function calculateDrawdown(twrValues) {
  let runningMax = twrValues[0];
  return twrValues.map(val => {
    if (val > runningMax) runningMax = val;
    return (val - runningMax) / runningMax;
  });
}

function latestNonZeroReturn(priceArray) {
  const current = priceArray[priceArray.length - 1];
  if (current == null) return null;
  for (let i = priceArray.length - 2; i >= 0; i--) {
    const prev = priceArray[i];
    if (prev == null || prev === 0) continue;
    const ret = (current - prev) / prev;
    if (ret !== 0) return ret;
  }
  return null;
}

export function calculateStandardizedReturns(priceArray, options = {}) {
  const periods = { '1d': 1, '1w': 5, '1m': 21, '1y': 252 };
  const result = {};
  for (const [label, days] of Object.entries(periods)) {
    if (label === '1d' && options.useLatestNonZeroOneDay) {
      result[label] = latestNonZeroReturn(priceArray);
      continue;
    }
    if (priceArray.length > days) {
      const current = priceArray[priceArray.length - 1];
      const prev = priceArray[priceArray.length - 1 - days];
      result[label] = (current - prev) / prev;
    } else {
      result[label] = null;
    }
  }
  return result;
}

// beta = cov(a, vgs) / var(vgs)
// retPoints: [{ date, value }], vgsReturnsByDate: Map<date, value>
export function calcBeta(retPoints, vgsReturnsByDate) {
  const pairs = retPoints
    .map(p => [p.value, vgsReturnsByDate.get(p.date)])
    .filter(([a, b]) => typeof a === 'number' && typeof b === 'number');
  if (pairs.length < 8) return null;
  const aRets = pairs.map(p => p[0]);
  const vRets = pairs.map(p => p[1]);
  const vgsVar = pairs.reduce((s, p) => s + (p[1] - mean(vRets)) ** 2, 0) / (pairs.length - 1);
  const cov = pairs.reduce((s, p) => s + (p[0] - mean(aRets)) * (p[1] - mean(vRets)), 0) / (pairs.length - 1);
  return vgsVar > 0 ? cov / vgsVar : null;
}
