const FEEDS = [
  'https://finance.yahoo.com/news/rssindex',
  'https://au.finance.yahoo.com/news/rssindex',
  'https://feeds.reuters.com/reuters/businessNews',
  'https://feeds.content.dowjones.io/public/rss/mw_realtimeheadlines'
];

const KEYWORD_TAGS = [
  { tag: 'US Equity',   keywords: ['S&P 500', 'S&P500', 'NASDAQ', 'Dow Jones', 'Wall Street', 'Federal Reserve', 'Fed ', 'Nvidia', 'NVDA', 'US market', 'US stocks'] },
  { tag: 'Europe',      keywords: ['Europe', 'European', 'eurozone', 'euro zone', 'ECB', 'STOXX', 'DAX', 'CAC'] },
  { tag: 'Asia',        keywords: ['Asia', 'Samsung', 'TSMC', 'Taiwan', 'South Korea', 'Kospi', 'Hang Seng', 'Nikkei', 'Japan', 'BOJ', 'yen', 'Chinese market'] },
  { tag: 'Uranium',     keywords: ['uranium', 'nuclear', 'Cameco', 'Kazatomprom'] },
  { tag: 'Gold',        keywords: ['gold', 'bullion', 'XAU', 'gold price', 'precious metal'] },
  { tag: 'Commodities', keywords: ['commodities', 'commodity', 'crude oil', 'oil price', 'copper', 'iron ore'] },
  { tag: 'Macro',       keywords: ['RBA', 'Reserve Bank', 'interest rate', 'inflation', 'ASX 200', 'ASX200', 'Australian dollar', 'AUD', 'recession', 'GDP', 'CPI'] },
  { tag: 'AI',          keywords: ['Anthropic', 'OpenAI', 'artificial intelligence', 'Claude', 'ChatGPT', ] },
];

function extractText(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return m ? (m[1] || m[2] || '').trim() : '';
}

function parseItems(xml, source) {
  return xml.split('<item>').slice(1).map(block => {
    const title = extractText(block, 'title');
    const rawLink = extractText(block, 'link');
    const link = rawLink || (block.match(/<link>(.*?)<\/link>/) || [])[1] || '';
    const pubDate = extractText(block, 'pubDate');
    if (!title || !link) return null;
    return { title, link: link.trim(), pubDate, source };
  }).filter(Boolean);
}

async function fetchFeed(url) {
  const source = url.includes('reuters') ? 'Reuters' : url.includes('au.finance') ? 'Yahoo AU' : 'Yahoo Finance';
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    return parseItems(await res.text(), source);
  } catch {
    return [];
  }
}

function tagItem(item) {
  const text = item.title.toLowerCase();
  return KEYWORD_TAGS.filter(({ keywords }) =>
    keywords.some(k => text.includes(k.toLowerCase()))
  ).map(({ tag }) => tag);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).end();

  try {
    const results = await Promise.all(FEEDS.map(fetchFeed));
    const all = results.flat();

    const seen = new Set();
    const items = [];
    for (const item of all) {
      if (seen.has(item.link)) continue;
      seen.add(item.link);
      const tags = tagItem(item);
      if (!tags.length) continue;
      items.push({
        title: item.title,
        link: item.link,
        source: item.source,
        tags,
        ts: item.pubDate ? new Date(item.pubDate).getTime() : 0,
      });
    }

    items.sort((a, b) => b.ts - a.ts);
    return res.status(200).json({ items: items.slice(0, 100), updated_at: new Date().toISOString() });
  } catch (err) {
    console.error('news api error:', err);
    return res.status(500).json({ error: String(err) });
  }
}
