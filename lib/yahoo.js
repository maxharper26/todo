// Yahoo Finance fetch helpers

import { formatDate } from './math.js';

function epochSeconds(date) {
  return Math.floor(date.getTime() / 1000);
}

export async function fetchYahooChart(ticker, start, end) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}` +
    `?period1=${epochSeconds(start)}&period2=${epochSeconds(end) + 86400}` +
    `&interval=1d&includePrePost=false&events=div%2Csplit`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; unified-app/1.0)' }
  });
  if (!res.ok) throw new Error(`Yahoo chart request failed ${res.status}`);

  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) return [];

  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  return timestamps.map((ts, i) => {
    const close = closes[i];
    if (close == null) return null;
    return { date: formatDate(new Date(ts * 1000)), close };
  }).filter(Boolean);
}

export async function fetchUsdToAudRate() {
  const end = new Date();
  const start = new Date(Date.now() - 14 * 24 * 3600 * 1000);
  const series = await fetchYahooChart('AUDUSD=X', start, end);
  const latestAudUsd = series[series.length - 1]?.close;
  return latestAudUsd ? 1 / latestAudUsd : 1;
}

export function dailyReturnPoints(series) {
  return series.slice(1).map((point, idx) => ({
    date: point.date,
    value: (point.close - series[idx].close) / series[idx].close,
  })).filter(p => typeof p.value === 'number' && !isNaN(p.value));
}
