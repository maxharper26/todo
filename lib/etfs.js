// ETF universe + correlation cache logic

import { put, list } from '@vercel/blob';
import { fetchYahooChart, dailyReturnPoints } from './yahoo.js';
import { correlation, pctChange } from './math.js';

export function displayTicker(ticker) {
  return ticker.replace(/\.AX$/i, '');
}

export const GLOBAL_X_ASX_ETFS = [
  // ── Precious metals ─────────────────────────────────────────
  ['GOLD.AX',  'Physical Gold'],
  ['ETPMAG.AX','Physical Silver'],
  ['ETPMPT.AX','Physical Platinum'],
  ['ETPMPD.AX','Physical Palladium'],
  ['ETPMPM.AX','Precious Metals Basket'],
  ['GDX',      'Gold Miners (VanEck)'],
  ['GLD',      'Gold Futures (SPDR)'],
  // ── Tech & innovation ────────────────────────────────────────
  ['SEMI.AX',  'Semiconductors'],
  ['FANG.AX',  'FANG+'],
  ['TECH.AX',  'Global Technology'],
  ['GXAI.AX',  'Artificial Intelligence'],
  ['AINF.AX',  'AI Infrastructure'],
  ['ROBO.AX',  'Robotics & Automation'],
  ['HMND.AX',  'Humanoid Robotics'],
  ['BUGG.AX',  'Cybersecurity'],
  ['QTUM',     'Quantum Computing Basket'],
  ['RBTZ.AX',  'Global Robotics & AI'],
  // ── Energy transition & resources ───────────────────────────
  ['ACDC.AX',  'Battery Tech & Lithium'],
  ['ATOM.AX',  'Uranium'],
  ['WIRE.AX',  'Copper Miners'],
  ['GMTL.AX',  'Green Metal Miners'],
  ['XMET.AX',  'Energy Transition Metals'],
  ['CLNE.AX',  'Global Clean Energy'],
  ['PDBC',     'Commodities Basket (Invesco)'],
  ['FOOD.AX',  'Global Agribusiness'],
  // ── Healthcare ───────────────────────────────────────────────
  ['CURE.AX',  'S&P Biotech'],
  ['DRUG.AX',  'Global Healthcare / Pharma'],
  // ── Defence ─────────────────────────────────────────────────
  ['DTEC.AX',  'Defence Tech'],
  // ── Geographic equity ────────────────────────────────────────
  ['NDIA.AX',  'India Nifty 50'],
  ['DRGN.AX',  'China Tech'],
  ['U100.AX',  'US 100'],
  ['A300.AX',  'Australia 300'],
  ['ASIA.AX',  'Asia ex-Japan'],
  ['WXOZ.AX',  'Emerging Markets ex-China'],
  ['IEM.AX',   'iShares MSCI Emerging Markets'],
  ['EMB',      'EM Bonds USD (iShares)'],
  // ── Factor / smart beta ──────────────────────────────────────
  ['GARP.AX',  'World ex-AU GARP'],
  ['WCMQ.AX',  'WCM Quality Global Growth'],
  ['QLTY.AX',  'MSCI World Quality'],
  ['VMIN.AX',  'MSCI World Min Volatility'],
  // ── Real estate ──────────────────────────────────────────────
  ['VNQ',      'US REITs (Vanguard)'],
  // ── Fixed income / rates ─────────────────────────────────────
  ['USTB.AX',  'US Treasury Bond Hedged'],
  ['TLT',      'US 20yr Treasury (iShares)'],
  ['HYG',      'US High Yield Bonds (iShares)'],
  ['BILS.AX',  'US T-Bills (zero beta reference)'],
  ['GGOV.AX',  'Global Govt Bonds'],
  // ── Crypto ───────────────────────────────────────────────────
  ['EBTC.XA',  'Bitcoin ETF'],
  ['EETH.XA',  'Ethereum ETF'],
  // ── Managed futures / CTA ────────────────────────────────────
  ['KMLM',     'KFA Mount Lucas Mgd Futures (CTA index)'],
  ['DBMF',     'iMGP DBi Managed Futures'],
  ['CTA',      'Simplify Managed Futures'],
];

export function etfListHash() {
  return GLOBAL_X_ASX_ETFS.map(([t]) => t).join(',')
    .split('').reduce((h, c) => (Math.imul(31, h) + c.charCodeAt(0)) | 0, 0)
    .toString(36);
}

const BLOB_KEY = 'etf-correlations.json';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function getLowCorrelationEtfs(portfolioReturnPoints, cacheKey) {
  // Check blob cache
  try {
    const { blobs } = await list();
    const blob = blobs.find(b => b.pathname === BLOB_KEY);
    if (blob && Date.now() - new Date(blob.uploadedAt).getTime() < TTL_MS) {
      const cached = await (await fetch(blob.url)).json();
      if (cached.cacheKey === cacheKey) {
        console.log('ETF correlations: blob cache hit');
        return { data: cached.data, updatedAt: blob.uploadedAt };
      }
    }
  } catch (e) {
    console.warn('ETF corr blob read failed:', e?.message);
  }

  const returnsByDate = new Map(portfolioReturnPoints.map(p => [p.date, p.value]));
  const end = new Date();
  const start = new Date(Date.now() - 365 * 24 * 3600 * 1000);

  const rows = await mapWithConcurrency(GLOBAL_X_ASX_ETFS, 10, async ([ticker, name]) => {
    try {
      const series = await fetchYahooChart(ticker, start, end);
      const returns = dailyReturnPoints(series);
      const pairs = returns
        .map(p => [returnsByDate.get(p.date), p.value])
        .filter(([a, b]) => typeof a === 'number' && typeof b === 'number' && !isNaN(a) && !isNaN(b));
      if (pairs.length < 8) {
        console.warn(`Dropping ${ticker}: only ${pairs.length} pairs`);
        return null;
      }
      const last = series[series.length - 1]?.close;
      const monthAgo = series.length > 21 ? series[series.length - 22]?.close : series[0]?.close;
      return {
        ticker: displayTicker(ticker),
        symbol: ticker,
        name,
        correlation: correlation(pairs.map(p => p[0]), pairs.map(p => p[1])),
        observations: pairs.length,
        oneMonthReturn: pctChange(last, monthAgo),
      };
    } catch (e) {
      console.warn('ETF corr failed for', ticker, e?.message);
      return null;
    }
  });

  const data = rows
    .filter(r => r && typeof r.correlation === 'number' && !isNaN(r.correlation))
    .sort((a, b) => a.correlation - b.correlation)
    .slice(0, 100);

  const updatedAt = new Date().toISOString();
  try {
    await put(BLOB_KEY, JSON.stringify({ cacheKey, data }, null, 2), {
      access: 'public', contentType: 'application/json', addRandomSuffix: false,
    });
    console.log('ETF correlations: blob written');
  } catch (e) {
    console.warn('ETF corr blob write failed:', e?.message);
  }

  return { data, updatedAt };
}
