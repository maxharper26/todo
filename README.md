# unified-app

Personal dashboard — Next.js 13, deployed on Vercel. Four pages: portfolio tracker, task manager, NRL team lists, surf forecast. All persistent data lives in Vercel Blob.

---

## Repo layout

```
unified-app/
├── pages/
│   ├── index.js                  # Home — greeting + 4 nav cards
│   ├── _app.js                   # Shared layout wrapper, imports global CSS
│   ├── stocks.js                 # Portfolio dashboard
│   ├── todo.js                   # Task manager
│   ├── nrl.js                    # NRL team lists — jersey diffs vs prev round + odds tape
│   ├── surf.js                   # Surf forecast (swell, wind, tides)
│   └── api/
│       ├── stocks.js             # GET — orchestrates lib/* modules, returns JSON
│       ├── portfolio.js          # GET list of trades / POST new trade / DELETE trade by id
│       ├── tasks.js              # GET tasks / PUT full tasks array → writes to blob
│       ├── nrl.js                # GET — reads nrl_rounds.json blob (all rounds)
│       ├── nrl-odds.js           # GET — proxies The Odds API, filters to current round
│       ├── surf.js               # GET — Stormglass proxy, blob stale-cache fallback
│       ├── auth.js               # POST — password check, sets auth cookie; rate-limited (5 attempts / 15 min lockout)
│       └── super.js              # GET — super TWR from hardcoded contribution schedule + Yahoo
├── lib/                          # Shared modules
│   ├── math.js                   # Pure maths: mean, std, correlation, TWR, drawdown,
│   │                             #   standardizedReturns, calcBeta, formatDate, pctChange
│   ├── yahoo.js                  # fetchYahooChart, fetchUsdToAudRate, dailyReturnPoints
│   ├── etfs.js                   # GLOBAL_X_ASX_ETFS list, etfListHash, getLowCorrelationEtfs
│   │                             #   (returns { data, updatedAt }), displayTicker
│   ├── portfolio.js              # loadTrades, getOpenTickers, fetchPriceHistory, alignPrices,
│   │                             #   buildPositions, buildBenchmark, buildVgsReturnsMap,
│   │                             #   buildPriceSeries, buildTickerReturnPoints
│   ├── sectors.js                # SECTORS constant (list of sector names)
│   ├── stocksFormatters.js       # Client-side display helpers: pct, fmt, returnStyle, mixColor,
│   │                             #   conditionalCellStyle, getColumnStats
│   └── surfHelpers.js            # aussieFt, waveColour, windColour, periodColour, compassDir
├── components/
│   ├── OddsTape.js               # Scrolling odds ticker for NRL page (6h localStorage cache)
│   ├── stocks/                   # Stocks page panel components
│   │   ├── CotPanel.js           # COT signals table (lazy-loads /api/cot)
│   │   ├── BondSpreadPanel.js    # ORCL bond credit-spread chart (lazy-loads /api/bond-spread)
│   │   ├── EtfCorrelations.js    # Low-correlation ETF list (collapsible)
│   │   ├── PnlContributions.js   # Per-ticker P&L contribution bar chart (collapsible)
│   │   ├── PortfolioChartToggle.js # TWR / Drawdown chart toggle
│   │   ├── SuperPanel.js         # Super TWR panel (lazy-loads /api/super)
│   │   ├── TickerChart.js        # Single asset price viewer with cost basis line (collapsible)
│   │   ├── TickerTape.js         # Scrolling ticker tape (portfolio + watchlist 1d returns)
│   │   └── TradeHistory.js       # Trade log + closed positions FIFO summary (lazy-loads)
│   └── charts/
│       ├── LineChart.js          # TWR line chart; accepts avgPrice prop for cost basis line
│       ├── AreaChart.js          # Drawdown area chart
│       ├── Heatmap.js            # Correlation matrix heatmap
│       ├── PieChart.js           # Allocation donut; Holdings/Sectors toggle
│       ├── TideChart.js          # SVG tide curve with extremes labelled
│       ├── SwellTable.js         # Daily swell/wind/period table with bar
│       └── index.js              # Re-exports all charts
├── styles/
│   ├── globals.css               # html/body reset only
│   └── dashboard.css             # All shared styles — dark theme, design tokens, components
│                                 # Imported once in _app.js. Both pages use these classes.
├── scripts/
│   ├── migrate_portfolio_to_blob.mjs   # One-off: CSV → portfolio.json blob
│   ├── add_sectors_to_trades.mjs       # One-off: adds sector field to existing trades
│   ├── inspect_nrl_blob.py             # Print current nrl_rounds.json blob structure
│   ├── upload_nrl_blob.py              # Push local nrl_rounds.json → Vercel Blob (all round-N keys, skips 'main')
│   └── fetch_nrl_odds.py               # Fetch current NRL odds from The Odds API and print them
└── .env.local                    # Secrets (not committed)
```

---

## Pages

### `/stocks` — Portfolio Dashboard

Fetches `/api/stocks` on load. Displays:

- **Summary stat strip** — Market Value, Cost Basis, P&L ($), P&L (%), Sharpe, Beta
- **Standardized Returns table** — Price, Total Return, 1d/1w/1m, Sharpe, Beta (vs VGS). Rank-based conditional formatting per column. Beta rank-coloured same way.
- **TWR chart** — Cumulative time-weighted return rebased to 100. VGS.AX benchmark dashed overlay.
- **Drawdown chart** — Portfolio drawdown, VGS.AX overlaid.
- **Correlation matrix** — Pairwise return correlations across open positions.
- **Allocation pie** — Toggle between Holdings (by ticker) and Sectors (by sector tag). Holdings/Sectors button in panel header.
- **ETF Correlations** — Collapsible. 57 ETFs across sectors/geographies/alternatives. Blob-cached 7 days. Shows "as of [date]" in header. Cache key = ETF list hash + open tickers (no date, so genuinely holds 7 days).
- **Bond Spread** — Collapsible, lazy-loads `/api/bond-spread`. Chart of ORCL bond credit spread (yield minus 10Y US Treasury, bps) over time, plus latest price/yield/spread snapshot. Data written by the `lambdas/bonds` email lambda into `bond-spread.json` blob on each run.
- **Single Asset Viewer** — Collapsible. Dropdown selects a position, shows raw price history. Amber dashed cost basis line at avgPrice.
- **Trade History** — Collapsible, lazy-loads from `/api/portfolio`. Sorted newest first, buy/sell badge, delete button.
- **Add trade modal** — Buy/sell toggle, ticker/date/price/units/sector fields. Sector auto-populates from existing holding on ticker entry. Reloads data after submit.

### `/nrl` — Team Lists

Reads `nrl_rounds.json` from Vercel Blob (written by the teamlists Lambda). Blob now stores **all rounds** (keyed `round-N`). Page derives latest and previous round client-side, computes **jersey-level diffs** (who changed per jersey number vs same team's prior round squad). localStorage cache (24h TTL, key `nrl_cache_v2`) with force-refresh button.

- **OddsTape** — scrolling ticker above match cards showing h2h odds for the current round. Fetched from `/api/nrl-odds`, cached 6h in localStorage.
- **Jersey diffs** — `# | Was | Now` table per team. Bye detection: if a team has no entry in the previous round they get "Bye last round" rather than a full squad diff.
- **Matching logic** — diffs are keyed by team name (not fixture), so cross-round matchup changes don't break the lookup.

### `/surf` — Surf Forecast

Beach selector (Queenscliff, Bondi). Fetches `/api/surf` which proxies Stormglass (10 calls/day limit). localStorage cache (24h TTL). On Stormglass 429 falls back to `surf-cache.json` blob with `stale: true` warning.

- **Headlines strip** — today's swell (aussie ft), avg wind, period, current tide height + direction
- **Swell table** — 7-day forecast with colour-coded bar. Green = 2ft+, amber = 1–2ft or 8ft+, red = flat
- **Tide chart** — SVG spline curve of tide extremes over next ~4 days

**Swell height dampening:** `aussieFt()` in `lib/surfHelpers.js` applies `v^0.85 * 0.43` to Stormglass `swellHeight` (offshore significant wave height in metres) before bucketing into aussie ft labels. Calibrated so 2.5m raw ≈ 2–3ft at beach. Adjust the multiplier (`0.43`) to shift all readings up/down uniformly.

### `/stocks` — Super panel

Collapsible `SuperPanel` at the bottom of the stocks page. Lazy-loads `/api/super` on first open. Hardcoded schedule: $3360 on 2026-03-15, then $800 on the 15th of each month. Allocation: 80% VGS.AX / 20% VAS.AX. Shows TWR chart + headline stats (balance, P&L, total return, contributed).

### `/todo` — Task Manager

Kanban board (High/Medium/Low urgency columns). Tasks stored in `tasks.json` blob. Features: drag-and-drop to reprioritise (drag handle is the card header row), close/reopen, edit (pencil button opens modal pre-filled), work/all category filter, due dates with overdue highlighting, add/edit task modal, copyable text in cards.

---

## Caching pattern

**localStorage is the default cache** — always check localStorage before hitting an API route. TTLs: stocks 30 min, tasks 5 min, NRL 24h, surf 24h.

- **Stocks page** also caches raw `portfolio.json` trades indefinitely under `portfolio_cache` key (no TTL). On a stocks cache miss, trades are POSTed to `/api/stocks` so the handler skips the blob read. `portfolio_cache` is busted on add/delete trade and manual refresh.

**Blob is for two things only:**
1. **Persistent user data** that must survive across devices: `portfolio.json`, `tasks.json`, `nrl_rounds.json`
2. **Rate-limited / expensive external API fallbacks** where stale > failure: `surf-cache.json` (Stormglass 10 calls/day), `etf-correlations.json` (7-day TTL, heavy multi-ticker Yahoo computation), `cot.json` (Lambda output)

**Do not use blob as a general-purpose cache** for cheap/frequent calls (RSS feeds, Yahoo prices, etc.) — localStorage on the client is sufficient.

---

## Blob store

| Key | Written by | Read by | Notes |
|---|---|---|---|
| `portfolio.json` | `/api/portfolio` POST | `/api/stocks`, `/api/portfolio` GET | Array of trade objects |
| `tasks.json` | `/api/tasks` PUT | `/api/tasks` GET | `{ tasks: [...] }` |
| `etf-correlations.json` | `lib/etfs.js` | `lib/etfs.js` | 7-day TTL, cache key = ETF list hash + open tickers |
| `nrl_rounds.json` | teamlists Lambda | `/api/nrl` GET | All rounds `{ rounds: { round-N: {...} }, updated_at }` |
| `surf-cache.json` | `/api/surf` | `/api/surf` | Stale fallback on Stormglass 429; keyed by beach ID |
| `bond-spread.json` | `lambdas/bonds` Lambda | `/api/bond-spread` GET | `{ bonds: { label: { cusip, series: [{date, price, yield, spread_bps}] } }, updated_at }` |

### Trade schema (`portfolio.json`)

```json
[
  {
    "id": "uuid",
    "ticker": "IVV.AX",
    "date": "2026-03-24",
    "price": 62.7,
    "units": 20,
    "action": "buy",
    "sector": "US Equity"
  }
]
```

- `action` is `"buy"` or `"sell"` — sign of units is derived from this in the API, always store `units` as positive
- `sector` must be one of the values in `lib/sectors.js` (or null/omitted for untagged)
- Closed positions (net units = 0) are excluded from analytics but preserved in history

### Task schema (`tasks.json`)

```json
{
  "tasks": [
    {
      "id": "uuid",
      "title": "string",
      "description": "string",
      "urgency": "high|medium|low",
      "category": "work|personal",
      "status": "open|closed",
      "due_date": "2026-05-01 or null",
      "created_at": "ISO string",
      "updated_at": "ISO string"
    }
  ]
}
```

---

## Lambdas (`/lambdas/teamlists/`)

Scrapes NRL team lists and writes to both S3 and Vercel Blob. EventBridge cron: Sunday 9pm UTC (Monday 7am AEST).

**`main.py`** — handler entry point:
1. Loads existing rounds from S3
2. Discovers latest team lists URL by scraping `nrl.com/news/topic/team-lists/` (finds first `<a class="card">` matching `/nrl-team-lists-round-\d+/`)
3. Parses round HTML → `round_object`
4. Saves all rounds to S3
5. Writes full `{ rounds: {...}, updated_at }` to Vercel Blob (overwrites; all `round-N` keys preserved)
6. Computes jersey diffs vs previous round, sends HTML email

**`helpers.py`** — parsing + output:
- `parse_round` / `parse_match` / `parse_section` — BeautifulSoup HTML parsing
- `_squad_to_jersey_map(squad)` — flattens `{Backs, Forwards, Interchange, Reserves}` → `{jersey_number: name}`
- `compute_jersey_diffs(current, prev)` — compares by **team name** (not fixture), returns `[{jersey, prev, curr}]` per match. Sets `home_bye`/`away_bye` flags if team absent from previous round.
- `generate_ins_outs_html(round, prev_round)` — produces email HTML with `# | Was | Now` diff tables
- `write_rounds_to_blob(payload)` — PUT to Vercel Blob (`BLOB_TOKEN` env var required)

**NRL team name mapping** (Odds API full name → blob short name) lives in `pages/api/nrl-odds.js`.

---

## API: `/api/stocks`

Thin orchestration handler. All logic lives in `lib/`. Runs sequentially per ticker to avoid Yahoo rate limits.

**Modules called:**

| Module | Responsibility |
|---|---|
| `lib/portfolio.js` | Load trades from blob, compute positions (including sector), align prices, build benchmark |
| `lib/math.js` | TWR, drawdown, Sharpe, beta, correlation, standardised returns |
| `lib/yahoo.js` | Yahoo Finance fetch, USD/AUD rate, daily return point extraction |
| `lib/etfs.js` | ETF universe, 7-day blob-cached correlation scan, returns `{ data, updatedAt }` |

**Key data flow:**

```
portfolio.json (blob)
  → trades array (with sector)
  → open tickers (net units > 0)
  → Yahoo Finance fetch per ticker + VGS.AX
  → aligned date array + priceByTicker
  → TWR, drawdown, Sharpe, Beta, priceSeries
  → sectorAllocations (aggregated from allocations)
  → ETF correlations (7-day blob cache)
  → JSON response
```

---

## Auth

`middleware.js` protects all routes except `/login`, `/api/auth`, `/_next`, `/favicon.ico`. Sets a 30-day `auth=ok` httpOnly cookie on success.

`/api/auth` rate-limits by IP: 5 failed attempts triggers a 15-min lockout. Counter is module-level (resets on Lambda cold start — acceptable for personal use).

---

## Environment

| Variable | Where | Purpose |
|---|---|---|
| `BLOB_READ_WRITE_TOKEN` | `.env.local` + Vercel | Vercel Blob read/write |
| `AUTH_PASSWORD` | `.env.local` + Vercel | Login password |
| `STORMGLASS_API_KEY` | `.env.local` + Vercel | Surf forecast |
| `ODDS_API_KEY` | `.env.local` + Vercel | NRL odds (the-odds-api.com, free tier 500 req/month) |

---

## Styling

Single stylesheet: `styles/dashboard.css`. Imported once in `_app.js`.

**Design tokens (CSS variables):**

```css
--bg:          #0a0a0f   /* page background */
--surface:     #111118   /* cards, panels */
--surface-2:   #16161f   /* inputs, col headers */
--border:      #1e1e2e
--border-2:    #2a2a3d
--text:        #e2e8f0
--text-muted:  #64748b
--accent:      #6366f1   /* indigo — buttons, focus rings, nav links */
--green:       #22c55e
--red:         #ef4444
```

Chart components use hardcoded hex values matching these tokens (not yet migrated to CSS variables).

---

## Sectors

Defined in `lib/sectors.js`:

```
US Equity · Non-US Developed Equity · EM Equity · VC
Gold · Commodities · Fixed Income · Infrastructure · Hedged Equities
```

To add a sector: add it to `lib/sectors.js`, then run `node scripts/add_sectors_to_trades.mjs` (update `SECTOR_MAP` first) to backfill existing trades.

---

## Known gaps / future work

- No loading indicator after add-trade submit (page reloads fully, takes 30s+ on cold start) — fix is to split ETF correlations into a separate lazy endpoint
- Chart components use hardcoded hex rather than CSS variables
- Mobile layout: returns table overflows on narrow screens (min-width 1020px)
- `portfolioSeries` (absolute AUD portfolio value over time) was removed — would be useful to re-add
- No edit on trade history (delete and re-add as workaround)
- Super contribution schedule is hardcoded in `pages/api/super.js` — not editable via UI
- Surf dampening calibrated for Sydney beaches; would need adjustment for other breaks
- Auth rate-limit counter resets on Lambda cold start — for stronger protection, persist to Blob
