# PRD: Cantor

**Version:** 1.0
**Date:** 2026-04-10
**Status:** Draft

---

## Overview

Cantor is a personal algorithmic crypto paper trading lab that runs entirely on a Mac via `npm run dev`. It pulls live and historical market data from Kraken's public APIs, executes a hard-coded EMA crossover + RSI filter strategy against that data with fake money, and surfaces the results in a clean, terminal-aesthetic UI. It is as much a learning project as a trading tool — every metric is annotated in code, every concept is defined in a glossary.

## Problem Statement

Trading strategies are easy to imagine and hard to evaluate honestly. Cantor provides a safe, transparent, fully local sandbox for watching a strategy run against real live markets, backtesting it against historical data, and measuring performance stats rigorously — without risking real capital.

## Target Audience

Solo. One user: the owner/builder. No accounts, no multi-user, no onboarding flow.

## Product Type

Local-first developer lab / personal tool. Not SaaS. Not a content platform. A dev tool + visualiser + simulator that happens to have a UI.

---

## Layout

Single-page app with a persistent header and four tabs. No routing beyond the root `/`. No sign-in, no settings screen, no strategy editor in v0.1.

### Header (persistent)

| Element | Detail |
|---------|--------|
| Brand name | "Cantor" |
| Pair selector | BTC/USDT ↔ ETH/USDT toggle. Switching pair restarts the strategy cleanly — no stale candles. |
| Live price | Current last trade price, monospaced |
| 24h change % | Positive in green (#22c55e), negative in red (#ef4444) |

### Tabs

| # | Tab | Summary |
|---|-----|---------|
| 1 | Live | Real-time candlestick chart, EMA overlays, RSI panel, Signal Log |
| 2 | Backtest | Date range picker, run button, loading state, shared Journal + Performance results |
| 3 | Journal | Sortable completed trade table |
| 4 | Performance | Computed strategy metrics, each annotated in source |

---

## Tab Specifications

### Tab 1 — Live

- **Price chart:** Lightweight Charts candlestick series (TradingView library). Displays the selected pair on a 1-minute interval from the live Kraken WebSocket feed.
- **EMA overlays:** EMA 9 and EMA 21 rendered as line series on the price chart. Visually distinct colours (e.g. cyan for EMA 9, muted amber for EMA 21).
- **RSI panel:** Second Lightweight Charts instance, stacked below the price chart with aligned time axis. RSI(14). Horizontal reference lines at 30 (oversold) and 70 (overbought).
- **Signal Log:** Live-updating list of BUY / SELL / HOLD events as they fire from the strategy. Each entry: timestamp, signal type, price at signal, pair. Scrollable. BUY in green, SELL in red, HOLD in muted text.
- **Paper trader state:** Current open position (if any) and fake balance visible in or adjacent to the Signal Log.
- **Background:** The paper trader runs continuously against the live feed. It holds at most one open position per pair at a time.

### Tab 2 — Backtest

- **Date range selector:** Start date + end date picker. Default: last 30 days.
- **Candle interval:** 1-hour candles (Kraken REST `/0/public/OHLC`, interval=60).
- **Run backtest button:** Fetches OHLCV data, runs the strategy in-memory, produces a list of completed trades and performance metrics.
- **Loading state:** Visible spinner or progress indicator while fetching + computing.
- **Results:** Rendered using the same `<Journal />` and `<Performance />` components as tabs 3 and 4. Results are ephemeral — not persisted between sessions.

### Tab 3 — Journal

- **Table columns:** Date, Pair, Entry price, Exit price, P&L (£), P&L (%), Duration, Signal reason
- **Row colour:** Green background (muted) for winning trades, red background (muted) for losing trades
- **Sortable:** By date (default desc), P&L, duration
- **Data source:** Completed trades from the live paper trader session (in-memory). Backtest results render the same component with their own trade list.

### Tab 4 — Performance

| Metric | Notes in source required |
|--------|--------------------------|
| Total return % | Return over the session/backtest period |
| Win rate % | Winning trades / total trades |
| Average win | Mean P&L of winning trades |
| Average loss | Mean P&L of losing trades |
| Max drawdown % | Largest peak-to-trough decline in portfolio value |
| Simplified Sharpe ratio | Mean return / std dev of returns (daily). Comment must explain the simplification. |
| Total trades | Count of completed trades |
| Current balance | Fake starting balance ± realised P&L |

Each metric must have a code comment explaining: what it is, why it matters, and what "good" looks like for a systematic strategy. This is a first-class requirement, not optional documentation.

---

## Strategy

Defined in `src/strategy/signals.ts`. Hard-coded in v0.1 — no UI to change params.

| Parameter | Value |
|-----------|-------|
| Fast EMA | 9 periods |
| Slow EMA | 21 periods |
| RSI period | 14 |
| RSI oversold threshold | 30 |
| RSI overbought threshold | 70 |
| Signal: BUY | EMA 9 crosses above EMA 21 AND RSI < 70 |
| Signal: SELL | EMA 9 crosses below EMA 21 AND RSI > 30 |
| Signal: HOLD | All other conditions |
| Position sizing | 100% of available balance per trade (simplification — documented in comments) |
| Max open positions | 1 per pair |

---

## Data Layer

### Live feed
- **Source:** Kraken public WebSocket `wss://ws.kraken.com/`
- **Subscription:** `ticker` and `ohlc` channels for the selected pair
- **Auth:** None required

### Historical data
- **Source:** Kraken REST `https://api.kraken.com/0/public/OHLC`
- **Params:** `pair`, `interval` (60 for 1-hour), `since` (Unix timestamp)
- **Auth:** None required

### State management
- All state in-memory (React state / context). Nothing persisted to disk in v0.1.
- Switching pair resets live state cleanly.

---

## Brand

### Identity
- **Name:** Cantor
- **Tagline:** Personal algorithmic paper trading
- **Personality:** Hacker-terminal meets quant notebook. Precise, confident, dry. Data-forward, not decorative.
- **Tone of voice (UI labels):** Dry and technical. "Balance", "Open position", "Max drawdown". No marketing verbs. No exclamation marks.
- **Tone of voice (code + glossary):** Curious and educational. Full sentences, plain English. Written for me-in-six-months. Not afraid to say "this is a simplified version because..."

### Colour palette

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-base` | `#0b0d10` | Page background |
| `--bg-surface` | `#131720` | Cards, panels, tab content areas |
| `--bg-elevated` | `#1c2333` | Hover states, selected rows |
| `--border` | `#2a3040` | Grid lines, dividers |
| `--text-primary` | `#e8eaf0` | Primary readable text |
| `--text-secondary` | `#8892a4` | Labels, metadata, muted |
| `--text-mono` | `#e8eaf0` | Prices, tickers, timestamps (monospace) |
| `--accent` | `#22d3ee` | Brand accent, active tab, cursor, EMA 9 line |
| `--win` | `#22c55e` | Profit, BUY signal, positive change |
| `--loss` | `#ef4444` | Loss, SELL signal, negative change |
| `--ema-fast` | `#22d3ee` | EMA 9 line (cyan = signal) |
| `--ema-slow` | `#f59e0b` | EMA 21 line (amber = baseline) |
| `--rsi-line` | `#a78bfa` | RSI line (purple = distinct from price) |

No gradients. No box shadows. No glass. No transparency effects.

### Typography

| Use | Font | Weight |
|-----|------|--------|
| Headings, labels, body | Inter | 400, 500, 600 |
| Numbers, prices, tickers, timestamps, code | JetBrains Mono | 400, 500 |

Both loaded via Google Fonts CDN. All price/P&L/balance/timestamp values must use JetBrains Mono so columns align and digits don't jitter on tick updates.

### Visual references
- **Primary:** TradingView (chart density, dark palette), Linear (calm hierarchy), Raycast (confident minimalism, monospace metadata)
- **Secondary:** Bloomberg terminal (density, numbers as product), Vercel dashboard early era (typographic restraint)
- **Anti-references:** Robinhood (gamified, toy-like), Coinbase consumer (rounded, reassuring), any dashboard with 3D chart illustrations or bright gradient cards

---

## Technical Requirements

- **Stack:** Vite + React + TypeScript
- **Charting:** Lightweight Charts (TradingView) — MIT license, purpose-built for financial charts, 60fps
  - Two instances per Live tab: one for price + EMA overlays, one for RSI panel
  - Instances share aligned time axes
- **Fonts:** Google Fonts CDN — Inter, JetBrains Mono
- **External APIs:** Kraken REST + WebSocket (public, no auth)
- **Target:** Desktop-only. Chrome on Mac. Minimum viewport 1280×800.
- **No mobile layout.** Below 1280px, a "please resize" message is acceptable.
- **No telemetry, no analytics, no Sentry, no paid services.**
- **No environment variables required.**

---

## Out of Scope (v0.1)

- Strategy editor / param panel
- Persistent trade history (no localStorage, no IndexedDB)
- Multiple simultaneous open positions
- Additional pairs beyond BTC/USDT and ETH/USDT
- Settings screen
- Mobile / tablet layout
- Any form of auth or user accounts
- Glossary as an in-app view (lives at `docs/glossary.md`)

---

## Success Criteria

- [ ] App runs with `npm run dev`, no env vars required
- [ ] Live tab: candlestick chart updates in real time from Kraken WebSocket
- [ ] Live tab: EMA 9/21 overlays correct, RSI panel correct, Signal Log fires events
- [ ] Backtest tab: fetches 30 days of 1-hour candles, runs strategy, renders Journal + Performance
- [ ] Journal: all columns present, sortable, correct row colouring
- [ ] Performance: all 8 metrics present, each with required code comment
- [ ] Brand tokens applied consistently — no hardcoded hex values in component files
- [ ] No console errors in normal operation
- [ ] Minimum viewport 1280×800 renders correctly in Chrome
