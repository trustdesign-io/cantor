# Plan: Cantor

Generated from PRD.md on 2026-04-10.
Each item maps to one GitHub issue on Mission Control.

---

## Phase 1 — Foundation

**1.1 — Project scaffolding and tooling**
Set up the base Vite + React + TypeScript project. Configure ESLint, Prettier, and TypeScript strict mode. Add CSS custom properties for all brand tokens from the PRD colour palette. Load Inter and JetBrains Mono via Google Fonts CDN in `index.html`. Verify `npm run dev` boots cleanly.
- Category: Chore | Priority: High | Size: S

**1.2 — App shell: header + tab layout**
Build the persistent header (Cantor brand name, pair selector toggle BTC/USDT ↔ ETH/USDT, live price placeholder, 24h change % placeholder) and the four-tab navigation (Live, Backtest, Journal, Performance). Tabs are wired but show empty placeholder content. All brand tokens applied. Min-width 1280px enforced with a "please resize" message below.
- Category: Feature | Priority: High | Size: S

**1.3 — Kraken WebSocket hook**
Implement `useKrakenWebSocket` — a React hook that opens a connection to `wss://ws.kraken.com/`, subscribes to the `ticker` channel for the active pair, and exposes live price + 24h change %. Reconnects automatically on disconnect. Switches subscription cleanly when the active pair changes. Unit-testable with a mock WebSocket.
- Category: Feature | Priority: High | Size: M

**1.4 — Kraken OHLC WebSocket hook**
Extend the WebSocket layer to subscribe to the `ohlc` channel (1-minute candles) for the active pair. Exposes a rolling buffer of recent OHLC candles as React state. Appends new candles as they arrive and updates the current candle in place.
- Category: Feature | Priority: High | Size: M

---

## Phase 2 — Strategy engine

**2.1 — EMA and RSI indicator library**
Implement `src/indicators/ema.ts` and `src/indicators/rsi.ts`. Pure functions, no side effects: `ema(prices, period)` → number[], `rsi(prices, period)` → number[]. Fully commented — each function explains the formula, the period choice, and what the output means. Tested with known input/output pairs.
- Category: Feature | Priority: High | Size: S

**2.2 — Signal generation**
Implement `src/strategy/signals.ts`. Given a candle array + current indicator values, returns `'BUY' | 'SELL' | 'HOLD'`. Hard-coded params: EMA fast=9, slow=21, RSI period=14, oversold=30, overbought=70. Signal conditions documented in comments. Unit tested for each signal condition and edge cases (crossover on same candle, RSI at boundary).
- Category: Feature | Priority: High | Size: S

**2.3 — Paper trader**
Implement `src/strategy/paperTrader.ts`. Manages fake balance, open position (one per pair max), and completed trade history. Exposes: `onSignal(signal, price, timestamp)` → updates state. Returns current balance, open position (entry price, size, unrealised P&L), and completed trades array. Each trade records: pair, entry price, exit price, entry time, exit time, signal reason. Position sizing: 100% of available balance (documented simplification). Fully commented and unit tested.
- Category: Feature | Priority: High | Size: M

**2.4 — Live strategy runner**
Wire the OHLC WebSocket hook → indicators → signal generator → paper trader into a `useLiveStrategy` hook. Runs continuously in the background when the app is open. Exposes: latest signal, current position, balance, and completed trades. Resets cleanly when the active pair changes.
- Category: Feature | Priority: High | Size: M

---

## Phase 3 — UI: Live tab

**3.1 — Lightweight Charts: price + EMA chart**
Install `lightweight-charts`. Implement `<PriceChart />` — a Lightweight Charts candlestick series consuming the live OHLC buffer. Overlay EMA 9 (cyan `#22d3ee`) and EMA 21 (amber `#f59e0b`) as line series. Chart background, grid, and axis colours from brand tokens. Updates efficiently on new candles — no full re-render.
- Category: Feature | Priority: High | Size: M

**3.2 — Lightweight Charts: RSI panel**
Implement `<RsiChart />` — a second Lightweight Charts instance, stacked below `<PriceChart />` with aligned time axis. RSI(14) as a line series (purple `#a78bfa`). Horizontal reference lines at 30 and 70. Panel height ~25% of total chart area.
- Category: Feature | Priority: High | Size: S

**3.3 — Signal Log**
Implement `<SignalLog />` — a scrollable, live-updating list of signal events from `useLiveStrategy`. Each entry: timestamp, pair, signal type (BUY / SELL / HOLD), price at signal. BUY rows in green, SELL rows in red, HOLD rows in muted text. Most recent at top. Shows current open position and fake balance below the log.
- Category: Feature | Priority: High | Size: S

**3.4 — Wire Live tab**
Compose `<PriceChart />`, `<RsiChart />`, and `<SignalLog />` into the Live tab. Charts left (2/3 width), signal log right (1/3 width). Header live price and 24h change % wired to `useKrakenWebSocket` output.
- Category: Feature | Priority: High | Size: S

---

## Phase 4 — UI: Journal and Performance

**4.1 — Journal component**
Implement `<Journal trades={Trade[]} />`. Table columns: Date, Pair, Entry, Exit, P&L (£), P&L (%), Duration, Signal reason. Sortable by column header click (default: date desc). Winning rows: muted green background. Losing rows: muted red background. Monospace font for all numeric columns. Handles empty state (no completed trades yet).
- Category: Feature | Priority: High | Size: M

**4.2 — Performance metrics engine**
Implement `src/metrics/performance.ts`. Pure function: `computeMetrics(trades: Trade[], startingBalance: number)` → `PerformanceMetrics`. Computes all 8 metrics from the PRD. Each metric function has the required code comment (what it is, why it matters, what "good" looks like). Unit tested with known trade sequences.
- Category: Feature | Priority: High | Size: M

**4.3 — Performance component**
Implement `<Performance metrics={PerformanceMetrics} />`. Displays all 8 metrics in a clean grid. Metric name in Inter (secondary text colour), value in JetBrains Mono (primary). Positive total return and win rate coloured green; negative coloured red. Handles zero-trades empty state.
- Category: Feature | Priority: High | Size: S

---

## Phase 5 — Backtest tab

**5.1 — Kraken OHLC REST fetch**
Implement `src/api/krakenRest.ts` — `fetchOHLC(pair, interval, since)` → `Candle[]`. Fetches from `https://api.kraken.com/0/public/OHLC`. Handles Kraken's response envelope, maps to the shared `Candle` type. Error handling for network failures and API error responses. Unit testable with a mock fetch.
- Category: Feature | Priority: High | Size: S

**5.2 — Backtest runner**
Implement `src/strategy/backtest.ts`. Takes a `Candle[]` array, runs the signal generator and paper trader over the full series in-memory, returns completed trades and final balance. Pure function — no side effects, no async. Fast enough to process 720 candles (30 days × 24 hours) synchronously without blocking the UI (use `setTimeout` or worker if needed).
- Category: Feature | Priority: High | Size: M

**5.3 — Backtest tab UI**
Implement the Backtest tab: date range picker (start + end, default last 30 days), "Run backtest" button, loading spinner while fetching + computing, error state. On completion, renders `<Journal />` and `<Performance />` with backtest results. Results are ephemeral — cleared on next run or tab switch.
- Category: Feature | Priority: High | Size: M

---

## Phase 6 — Polish and documentation

**6.1 — Glossary**
Write `docs/glossary.md`. Entries for: EMA, RSI, paper trading, backtesting, Sharpe ratio, drawdown, win rate, position sizing, crossover signal. Each entry: plain English definition, why it matters, any relevant caveats or simplifications made in Cantor. Linked from README.
- Category: Docs | Priority: Medium | Size: S

**6.2 — README**
Write `README.md`. Covers: what Cantor is (one paragraph), how to run it (`npm run dev`), how the strategy works (plain English), link to `docs/glossary.md`, link to `PRD.md`. No install instructions beyond `npm install`. No badges, no shields, no marketing.
- Category: Docs | Priority: Medium | Size: S

**6.3 — Final QA pass**
Manual smoke test in Chrome at 1280×800 and 1440×900. Verify: WebSocket connects and live price updates; chart renders candles and EMA lines; RSI panel tracks correctly; Signal Log fires events; pair switch resets state cleanly; Backtest runs for both pairs; Journal sorts correctly; Performance metrics compute correctly; no console errors in normal operation.
- Category: Chore | Priority: Medium | Size: S
