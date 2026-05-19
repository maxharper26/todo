const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

function parseDateFlexible(s) {
  if (!s) return null;
  const d = new Date(s);
  if (!isNaN(d)) return d;

  const parts = s.split(/[-\\\/\.]/).map(p => p.trim());
  if (parts.length !== 3) return null;

  let [day, month, year] = parts;
  if (year.length === 2) year = '20' + year;
  if (day.length === 4) return new Date(s);

  const iso = `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  const dd = new Date(iso);
  return isNaN(dd) ? null : dd;
}

function epochSeconds(date) {
  return Math.floor(date.getTime() / 1000);
}

async function fetchYahooChart(ticker, start, end) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${epochSeconds(start)}&period2=${epochSeconds(end) + 86400}&interval=1d&includePrePost=false&events=div%2Csplit`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; unified-app/1.0)'
    }
  });
  if (!res.ok) {
    throw new Error(`Yahoo chart request failed ${res.status}`);
  }
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) return [];
  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  return timestamps.map((ts, i) => {
    const close = closes[i];
    if (close == null) return null;
    return {
      date: formatDate(new Date(ts * 1000)),
      close
    };
  }).filter(Boolean);
}

function toNumber(v) {
  if (v === null || v === undefined) return 0;
  return Number(String(v).replace(/[^0-9.-]+/g, '')) || 0;
}

function pctChange(latest, prev) {
  if (latest == null || prev == null || prev === 0) return null;
  return (latest - prev) / prev;
}

function mean(values) {
  const nums = values.filter(v => typeof v === 'number' && !isNaN(v));
  if (!nums.length) return 0;
  return nums.reduce((sum, v) => sum + v, 0) / nums.length;
}

function std(values) {
  const nums = values.filter(v => typeof v === 'number' && !isNaN(v));
  if (nums.length < 2) return 0;
  const avg = mean(nums);
  const variance = nums.reduce((sum, v) => sum + (v - avg) * (v - avg), 0) / (nums.length - 1);
  return Math.sqrt(variance);
}

function correlation(x, y) {
  const pairs = [];
  for (let i = 0; i < Math.min(x.length, y.length); i += 1) {
    const xi = x[i];
    const yi = y[i];
    if (typeof xi === 'number' && typeof yi === 'number' && !isNaN(xi) && !isNaN(yi)) {
      pairs.push([xi, yi]);
    }
  }
  if (!pairs.length) return null;

  const xs = pairs.map(p => p[0]);
  const ys = pairs.map(p => p[1]);
  const mx = mean(xs);
  const my = mean(ys);
  const numerator = pairs.reduce((sum, p) => sum + (p[0] - mx) * (p[1] - my), 0);
  const denom = (Math.sqrt(pairs.reduce((sum, p) => sum + (p[0] - mx) ** 2, 0)) * Math.sqrt(pairs.reduce((sum, p) => sum + (p[1] - my) ** 2, 0)));
  return denom === 0 ? null : numerator / denom;
}

function calculateTWR(trades, priceByTicker, allDates) {
  // Build holdings matrix over time
  const holdings = {};
  for (const ticker of Object.keys(priceByTicker)) {
    holdings[ticker] = 0;
  }

  // Build flows (cost of purchases on each date)
  const flows = {};
  for (const date of allDates) {
    flows[date] = 0;
  }
  trades.forEach(trade => {
    const key = formatDate(trade.Date);
    if (!flows[key]) flows[key] = 0;
    flows[key] += trade.Price * trade.Units;
  });

  // Update holdings as we go through dates
  const holdingsByDate = {};
  for (const date of allDates) {
    // Apply trades on this date
    trades.forEach(trade => {
      const key = formatDate(trade.Date);
      if (key === date) {
        holdings[trade.Ticker] = (holdings[trade.Ticker] || 0) + trade.Units;
      }
    });
    // Record holdings after this date
    holdingsByDate[date] = { ...holdings };
  }

  // Calculate portfolio value on each date
  const portfolioValues = [];
  const twrReturns = [];
  let prevValue = 0;

  for (let i = 0; i < allDates.length; i++) {
    const date = allDates[i];
    const hold = holdingsByDate[date];
    let currValue = 0;
    for (const ticker of Object.keys(priceByTicker)) {
      const price = priceByTicker[ticker][i];
      if (price != null && hold[ticker]) {
        currValue += price * hold[ticker];
      }
    }
    portfolioValues.push(currValue);

    // TWR return = (curr_val - (prev_val + flow)) / (prev_val + flow)
    const flow = flows[date] || 0;
    const denom = prevValue + flow;
    const ret = denom > 0 ? (currValue - denom) / denom : 0;
    twrReturns.push(ret);
    prevValue = currValue;
  }

  // Build index: 100 * cumprod(1 + returns)
  let indexVal = 100;
  const twrIndex = [];
  for (const ret of twrReturns) {
    indexVal *= (1 + ret);
    twrIndex.push(indexVal);
  }

  return {
    values: twrIndex,
    dailyReturns: twrReturns
  };
}

function calculateDrawdown(twrValues) {
  const drawdowns = [];
  let runningMax = twrValues[0];
  for (const val of twrValues) {
    if (val > runningMax) runningMax = val;
    drawdowns.push((val - runningMax) / runningMax);
  }
  return drawdowns;
}

function latestNonZeroReturn(priceArray) {
  const current = priceArray[priceArray.length - 1];
  if (current == null) return null;

  for (let i = priceArray.length - 2; i >= 0; i -= 1) {
    const prev = priceArray[i];
    if (prev == null || prev === 0) continue;

    const ret = (current - prev) / prev;
    if (ret !== 0) return ret;
  }

  return null;
}

function calculateStandardizedReturns(priceArray, options = {}) {
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

function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

function displayTicker(ticker) {
  return ticker.replace(/\.AX$/i, '');
}

const USD_ALLOCATION_TICKERS = new Set(['DXYZ']);

const LOW_CORRELATION_CACHE_MS = 6 * 60 * 60 * 1000;
let lowCorrelationCache = null;

const GLOBAL_X_ASX_ETFS = [
  ['GOLD.AX', 'Physical Gold'],
  ['GXLD.AX', 'Gold Bullion ETF'],
  ['GHLD.AX', 'Gold Bullion Hedged'],
  ['ETPMAG.AX', 'Physical Silver'],
  ['ETPMPT.AX', 'Physical Platinum'],
  ['ETPMPD.AX', 'Physical Palladium'],
  ['ETPMPM.AX', 'Precious Metals Basket'],
  ['BCOM.AX', 'Bloomberg Commodity'],
  ['GCO2.AX', 'Global Carbon'],
  ['SEMI.AX', 'Semiconductors'],
  ['FANG.AX', 'FANG+'],
  ['FHNG.AX', 'FANG+ Hedged'],
  ['TECH.AX', 'Global Technology'],
  ['GXAI.AX', 'Artificial Intelligence'],
  ['AINF.AX', 'AI Infrastructure'],
  ['ROBO.AX', 'Robotics & Automation'],
  ['HMND.AX', 'Humanoid Robotics'],
  ['BUGG.AX', 'Cybersecurity'],
  ['FTEC.XA', 'Fintech & Blockchain'],
  ['ACDC.AX', 'Battery Tech & Lithium'],
  ['ATOM.AX', 'Uranium'],
  ['WIRE.AX', 'Copper Miners'],
  ['HGEN.AX', 'Hydrogen'],
  ['GMTL.AX', 'Green Metal Miners'],
  ['CURE.AX', 'S&P Biotech'],
  ['DTEC.AX', 'Defence Tech'],
  ['NDIA.AX', 'India Nifty 50'],
  ['DRGN.AX', 'China Tech'],
  ['GARP.AX', 'World ex-AU GARP'],
  ['U100.AX', 'US 100'],
  ['N100.AX', 'US 100 ETF'],
  ['A300.AX', 'Australia 300'],
  ['OZXX.AX', 'Australia ex-Financials & Resources'],
  ['ZYAU.AX', 'ASX 200 High Dividend'],
  ['AYLD.AX', 'ASX 200 Covered Call'],
  ['UYLD.AX', 'S&P 500 Covered Call'],
  ['ZYUS.AX', 'S&P 500 High Yield Low Volatility'],
  ['USTB.AX', 'US Treasury Bond Hedged'],
  ['USHY.AX', 'USD High Yield Bond Hedged'],
  ['USIG.AX', 'USD Corporate Bond Hedged'],
  ['BANK.AX', 'Australian Bank Credit'],
  ['EBTC.XA', 'Bitcoin ETF'],
  ['EETH.XA', 'Ethereum ETF'],
];

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function dailyReturnPoints(series) {
  return series.slice(1).map((point, idx) => ({
    date: point.date,
    value: pctChange(point.close, series[idx].close)
  })).filter(point => typeof point.value === 'number' && !isNaN(point.value));
}

async function getLowCorrelationEtfs(portfolioReturnPoints, cacheKey) {
  if (lowCorrelationCache && lowCorrelationCache.cacheKey === cacheKey && Date.now() - lowCorrelationCache.loadedAt < LOW_CORRELATION_CACHE_MS) {
    return lowCorrelationCache.data;
  }

  const portfolioReturnsByDate = new Map(portfolioReturnPoints.map(point => [point.date, point.value]));
  const end = new Date();
  const start = new Date(Date.now() - 60 * 24 * 3600 * 1000);
  const rows = await mapWithConcurrency(GLOBAL_X_ASX_ETFS, 4, async ([ticker, name]) => {
    try {
      const series = await fetchYahooChart(ticker, start, end);
      const returns = dailyReturnPoints(series);
      const pairs = returns
        .map(point => [portfolioReturnsByDate.get(point.date), point.value])
        .filter(pair => typeof pair[0] === 'number' && typeof pair[1] === 'number' && !isNaN(pair[0]) && !isNaN(pair[1]));

      if (pairs.length < 8) return null;

      const first = series[0]?.close;
      const last = series[series.length - 1]?.close;
      return {
        ticker: displayTicker(ticker),
        symbol: ticker,
        name,
        correlation: correlation(pairs.map(pair => pair[0]), pairs.map(pair => pair[1])),
        observations: pairs.length,
        oneMonthReturn: pctChange(last, first),
      };
    } catch (error) {
      console.warn('ETF correlation failed for', ticker, error?.message || error);
      return null;
    }
  });

  const data = rows
    .filter(row => row && typeof row.correlation === 'number' && !isNaN(row.correlation))
    .sort((a, b) => a.correlation - b.correlation)
    .slice(0, 10);

  lowCorrelationCache = { cacheKey, loadedAt: Date.now(), data };
  return data;
}

async function fetchUsdToAudRate() {
  const end = new Date();
  const start = new Date(Date.now() - 14 * 24 * 3600 * 1000);
  const series = await fetchYahooChart('AUDUSD=X', start, end);
  const latestAudUsd = series[series.length - 1]?.close;
  return latestAudUsd ? 1 / latestAudUsd : 1;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const csvPath = path.join(process.cwd(), 'data', 'portfolio.csv');
    if (!fs.existsSync(csvPath)) {
      return res.status(404).json({ error: 'Portfolio CSV not found' });
    }

    const raw = fs.readFileSync(csvPath, 'utf8');
    const records = parse(raw, { columns: true, skip_empty_lines: true });
    const trades = records.map(r => ({
      Ticker: (r.Ticker || '').trim(),
      Date: parseDateFlexible(r.Date) || null,
      Price: toNumber(r.Price),
      Units: toNumber(r.Units)
    })).filter(r => r.Ticker);

    const tickers = Array.from(new Set(trades.map(t => t.Ticker)));
    if (!tickers.length) {
      return res.status(200).json({ tickers: [], perTicker: {}, portfolio: {}, portfolioSeries: [], allocations: [] });
    }

    let earliest = null;
    for (const t of trades) {
      if (t.Date && (!earliest || t.Date < earliest)) earliest = t.Date;
    }
    const start = earliest ? new Date(earliest.getTime() - 7 * 24 * 3600 * 1000) : new Date(Date.now() - 365 * 24 * 3600 * 1000);
    const end = new Date();

    const histByTicker = {};
    const allDatesSet = new Set();

    for (const ticker of tickers) {
      try {
        const series = await fetchYahooChart(ticker, start, end);
        histByTicker[ticker] = series;
        series.forEach(p => allDatesSet.add(p.date));
      } catch (error) {
        console.warn('Yahoo chart failed for', ticker, error?.message || error);
        histByTicker[ticker] = [];
      }
    }

    const allDates = Array.from(allDatesSet).sort();
    if (!allDates.length) {
      return res.status(500).json({ error: 'No price history returned for tickers.' });
    }

    const priceByTicker = {};
    for (const ticker of tickers) {
      const rows = histByTicker[ticker];
      const rowMap = rows.reduce((map, row) => ({ ...map, [row.date]: row.close }), {});
      let lastValue = null;
      priceByTicker[ticker] = allDates.map(date => {
        if (rowMap[date] != null) {
          lastValue = rowMap[date];
        }
        return lastValue;
      });
    }

    const tradesByDate = {};
    trades.forEach(trade => {
      if (!trade.Date) return;
      const key = formatDate(trade.Date);
      tradesByDate[key] = tradesByDate[key] || [];
      tradesByDate[key].push(trade);
    });

    const holdings = tickers.reduce((acc, ticker) => ({ ...acc, [ticker]: 0 }), {});
    const portfolioSeries = allDates.map(date => {
      const todaysTrades = tradesByDate[date] || [];
      todaysTrades.forEach(trade => {
        holdings[trade.Ticker] = (holdings[trade.Ticker] || 0) + trade.Units;
      });

      const value = tickers.reduce((sum, ticker) => {
        const price = priceByTicker[ticker][allDates.indexOf(date)];
        return sum + (price != null ? price * (holdings[ticker] || 0) : 0);
      }, 0);
      return { date, value };
    });

    const perTicker = {};
    const allocations = [];
    const latestDateIndex = allDates.length - 1;
    let usdToAudRate = 1;

    if (tickers.some(ticker => USD_ALLOCATION_TICKERS.has(ticker))) {
      try {
        usdToAudRate = await fetchUsdToAudRate();
      } catch (error) {
        console.warn('USD to AUD conversion failed', error?.message || error);
      }
    }

    for (const ticker of tickers) {
      const series = priceByTicker[ticker];
      const latestPrice = series[latestDateIndex];
      const tradesFor = trades.filter(t => t.Ticker === ticker);
      const totalUnits = tradesFor.reduce((sum, t) => sum + t.Units, 0);
      const avgPrice = totalUnits ? tradesFor.reduce((sum, t) => sum + t.Price * t.Units, 0) / totalUnits : null;
      const nativePositionValue = latestPrice != null ? latestPrice * totalUnits : 0;
      const positionValue = USD_ALLOCATION_TICKERS.has(ticker) ? nativePositionValue * usdToAudRate : nativePositionValue;
      const totalReturn = (avgPrice && latestPrice) ? (latestPrice - avgPrice) / avgPrice : null;

      const tickerReturns = series.map((price, i, arr) => {
        if (i === 0) return null;
        const prev = arr[i - 1];
        return (price != null && prev != null) ? pctChange(price, prev) : null;
      }).slice(1);
      const tickerSharpe = (tickerReturns.length > 1 && std(tickerReturns) > 0) ? mean(tickerReturns) / std(tickerReturns) * Math.sqrt(252) : null;

      perTicker[ticker] = {
        latestPrice,
        units: totalUnits,
        avgPrice,
        positionValue,
        totalReturn,
        sharpe: tickerSharpe,
        returns: tickerReturns
      };
      allocations.push({
        ticker,
        units: totalUnits,
        latestPrice,
        positionValue,
        nativePositionValue,
        allocationCurrency: 'AUD'
      });
    }

    const total_cost = trades.reduce((sum, trade) => sum + trade.Price * trade.Units, 0);
    const current_value = allocations.reduce((sum, item) => sum + item.positionValue, 0);
    const portfolio_return = total_cost ? (current_value - total_cost) / total_cost : null;

    const weightedAllocations = allocations
      .map(item => ({
        ...item,
        weight: current_value ? item.positionValue / current_value : null
      }))
      .sort((a, b) => (b.weight || 0) - (a.weight || 0));

    const tickerReturnsMatrix = {};
    for (const ticker of tickers) {
      const series = priceByTicker[ticker];
      const returnsSeries = series.map((price, i, arr) => {
        if (i === 0) return null;
        const prev = arr[i - 1];
        return (price != null && prev != null) ? pctChange(price, prev) : null;
      }).slice(1);
      tickerReturnsMatrix[ticker] = returnsSeries;
    }

    const correlationMatrix = {};
    for (const a of tickers) {
      correlationMatrix[a] = {};
      for (const b of tickers) {
        correlationMatrix[a][b] = correlation(tickerReturnsMatrix[a], tickerReturnsMatrix[b]);
      }
    }

    // Calculate TWR
    const twrData = calculateTWR(trades, priceByTicker, allDates);
    const portfolioReturnPoints = twrData.values.map((value, idx, arr) => {
      if (idx === 0) return null;
      return { date: allDates[idx], value: pctChange(value, arr[idx - 1]) };
    }).slice(1).filter(point => point && typeof point.value === 'number' && !isNaN(point.value));
    const twrReturns = portfolioReturnPoints.map(point => point.value);
    const portfolioSharpe = (twrReturns.length > 1 && std(twrReturns) > 0) ? mean(twrReturns) / std(twrReturns) * Math.sqrt(252) : null;
    const twrSeries = allDates.map((date, i) => ({ date, value: twrData.values[i] }));
    const drawdownSeries = allDates.map((date, i) => ({ date, value: calculateDrawdown(twrData.values)[i] }));

    // Calculate standardized returns for each ticker
    const standardizedReturns = {};
    for (const ticker of tickers) {
      standardizedReturns[ticker] = calculateStandardizedReturns(priceByTicker[ticker], {
        useLatestNonZeroOneDay: ticker === 'DXYZ'
      });
    }

    // Portfolio standardized returns from TWR
    standardizedReturns['Portfolio'] = calculateStandardizedReturns(twrData.values);

    const displayTickers = tickers.map(displayTicker);
    const displayPerTicker = {};
    const displayStandardizedReturns = {
      Portfolio: standardizedReturns.Portfolio
    };
    const displayCorrelationMatrix = {};

    for (const ticker of tickers) {
      const label = displayTicker(ticker);
      displayPerTicker[label] = {
        ...perTicker[ticker],
        ticker: label,
        symbol: ticker
      };
      displayStandardizedReturns[label] = standardizedReturns[ticker];
      displayCorrelationMatrix[label] = {};

      for (const otherTicker of tickers) {
        displayCorrelationMatrix[label][displayTicker(otherTicker)] = correlationMatrix[ticker][otherTicker];
      }
    }

    const lowCorrelationEtfs = await getLowCorrelationEtfs(
      portfolioReturnPoints.slice(-24),
      `${allDates[allDates.length - 1]}:${twrData.values[twrData.values.length - 1]}:${tickers.join(',')}`
    );

    return res.status(200).json({
      tickers: displayTickers,
      perTicker: displayPerTicker,
      allocations: weightedAllocations.map(item => ({
        ...item,
        ticker: displayTicker(item.ticker),
        symbol: item.ticker
      })),
      portfolio: {
        total_cost,
        current_value,
        portfolio_return,
        sharpe: portfolioSharpe
      },
      portfolioSeries,
      twrSeries,
      drawdownSeries,
      standardizedReturns: displayStandardizedReturns,
      correlationMatrix: displayCorrelationMatrix,
      lowCorrelationEtfs,
      loaded_at: new Date().toISOString()
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: String(err) });
  }
}
