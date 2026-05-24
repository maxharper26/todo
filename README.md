# unified-app

Personal dashboard — Next.js 13, deployed on Vercel. Two pages: a portfolio tracker and a task manager. All persistent data lives in Vercel Blob.

---

## Repo layout

```
unified-app/
├── pages/
│   ├── index.js                  # Redirects / → /stocks
│   ├── _app.js                   # Shared layout wrapper, imports global CSS
│   ├── stocks.js                 # Portfolio dashboard (main page)
│   ├── todo.js                   # Task manager
│   └── api/
│       ├── stocks.js             # GET — orchestrates lib/* modules, returns JSON
│       ├── portfolio.js          # GET list of trades / POST new trade / DELETE trade by id
│       └── tasks.js              # GET tasks / PUT full tasks array → writes to blob
├── lib/                          # Shared server-side modules (imported by api/stocks.js)
│   ├── math.js                   # Pure maths: mean, std, correlation, TWR, drawdown,
│   │                             #   standardizedReturns, calcBeta, formatDate, pctChange
│   ├── yahoo.js                  # fetchYahooChart, fetchUsdToAudRate, dailyReturnPoints
│   ├── etfs.js                   # GLOBAL_X_ASX_ETFS list, etfListHash, getLowCorrelationEtfs
│   │                             #   (returns { data, updatedAt }), displayTicker
│   ├── portfolio.js              # loadTrades, getOpenTickers, fetchPriceHistory, alignPrices,
│   │                             #   buildPositions, buildBenchmark, buildVgsReturnsMap,
│   │                             #   buildPriceSeries, buildTickerReturnPoints
│   └── sectors.js                # SECTORS constant (list of sector names)
├── components/
│   └── charts/
│       ├── LineChart.js          # TWR line chart; accepts avgPrice prop for cost basis line
│       ├── AreaChart.js          # Drawdown area chart
│       ├── Heatmap.js            # Correlation matrix heatmap
│       ├── PieChart.js           # Allocation donut; Holdings/Sectors toggle
│       └── index.js              # Re-exports all charts
├── styles/
│   ├── globals.css               # html/body reset only
│   └── dashboard.css             # All shared styles — dark theme, design tokens, components
│                                 # Imported once in _app.js. Both pages use these classes.
├── scripts/
│   ├── migrate_portfolio_to_blob.mjs   # One-off: CSV → portfolio.json blob
│   └── add_sectors_to_trades.mjs       # One-off: adds sector field to existing trades
└── .env.local                    # BLOB_READ_WRITE_TOKEN (not committed)
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
- **Single Asset Viewer** — Collapsible. Dropdown selects a position, shows raw price history. Amber dashed cost basis line at avgPrice.
- **Trade History** — Collapsible, lazy-loads from `/api/portfolio`. Sorted newest first, buy/sell badge, delete button.
- **Add trade modal** — Buy/sell toggle, ticker/date/price/units/sector fields. Sector auto-populates from existing holding on ticker entry. Reloads data after submit.

### `/todo` — Task Manager

Kanban board (High/Medium/Low urgency columns). Tasks stored in `tasks.json` blob. Features: drag-and-drop to reprioritise (drag handle is the card header row), close/reopen, edit (pencil button opens modal pre-filled), work/all category filter, due dates with overdue highlighting, add/edit task modal, copyable text in cards.

---

## Blob store

| Key | Written by | Read by | Notes |
|---|---|---|---|
| `portfolio.json` | `/api/portfolio` POST | `/api/stocks`, `/api/portfolio` GET | Array of trade objects |
| `tasks.json` | `/api/tasks` PUT | `/api/tasks` GET | `{ tasks: [...] }` |
| `etf-correlations.json` | `lib/etfs.js` | `lib/etfs.js` | 7-day TTL, cache key = ETF list hash + open tickers |

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

**Response shape (abbreviated):**

```js
{
  tickers,              // display tickers (no .AX suffix)
  perTicker,            // { [ticker]: { latestPrice, units, avgPrice, positionValue,
                        //   totalReturn, sharpe, beta, sector } }
  allocations,          // sorted by weight desc, includes sector
  sectorAllocations,    // [{ sector, value, weight }] sorted by value desc
  portfolio,            // { total_cost, current_value, portfolio_return, sharpe, beta }
                        //   total_cost converts USD positions to AUD at current rate
  twrSeries,            // [{ date, value }] rebased to 100
  drawdownSeries,
  benchmarkTwrSeries,   // VGS.AX rebased to 100 at portfolio start
  benchmarkDrawdownSeries,
  standardizedReturns,  // { Portfolio, [ticker]: { 1d, 1w, 1m } }
  correlationMatrix,
  lowCorrelationEtfs,   // top 40 lowest-correlation ETFs
  etfUpdatedAt,         // ISO string — when ETF cache was last written
  priceSeries,          // { [ticker]: [{ date, value }] } raw close prices
  loaded_at
}
```

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

## Environment

| Variable | Where | Purpose |
|---|---|---|
| `BLOB_READ_WRITE_TOKEN` | `.env.local` + Vercel project settings | Vercel Blob read/write access |

---

## Known gaps / future work

- No loading indicator after add-trade submit (page reloads fully, takes 30s+ on cold start) — fix is to split ETF correlations into a separate lazy endpoint
- Chart components use hardcoded hex rather than CSS variables
- Mobile layout: returns table overflows on narrow screens (min-width 1020px)
- `portfolioSeries` (absolute AUD portfolio value over time) was removed — would be useful to re-add
- No edit on trade history (delete and re-add as workaround)
