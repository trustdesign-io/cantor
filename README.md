# Cantor

Cantor is a desktop paper-trading app for Bitcoin and Ethereum that runs an EMA crossover + RSI strategy against live Kraken market data. It shows real-time price and candlestick charts, fires buy/sell signals, tracks simulated trades, and lets you backtest the strategy over any historical date range — all without touching real money.

## Running locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. The app requires a viewport of at least 1280px wide.

## How the strategy works

The strategy watches 1-minute OHLC candles from Kraken's WebSocket API and runs two checks on each new candle:

1. **EMA crossover.** Two exponential moving averages are computed — a fast one (9 periods) and a slow one (21 periods). When the fast EMA crosses above the slow EMA (a "golden cross"), the strategy considers buying. When it crosses below (a "death cross"), it considers selling.

2. **RSI filter.** The Relative Strength Index (14 periods) must be between 30 and 70 for the signal to be acted on. This prevents entering a trade when the price is already in an extreme overbought or oversold condition.

When both conditions are met, the paper trader executes a simulated order at the current market price using 100% of the available balance. All positions and trade history are in-memory and reset on page refresh.

The Backtest tab runs the same strategy against historical 60-minute candles fetched from Kraken's REST API for any date range you choose.

## Signal filters

Signals pass through an ordered filter pipeline before the paper trader acts on them. Any filter can veto (downgrade to HOLD) with a human-readable reason shown in the Signal Log.

| Filter | What it checks | Veto condition |
|--------|----------------|----------------|
| Funding rate | Average perp funding across Binance + Bybit | > +0.1% / 8h (longs crowded) or < -0.05% / 8h (shorts crowded) |
| Fear & Greed | alternative.me index (0–100) | > 80 (extreme greed) or < 20 (extreme fear) |
| Macro blackout | Hard-coded FOMC / CPI / NFP release calendar | Within 1 hour before or after any scheduled event |

> **⚠️ Macro calendar is hard-coded.** `src/data/macroCalendar.json` covers one quarter of upcoming FOMC, CPI, and NFP dates. It must be updated manually every quarter. A future ticket will automate this from a free economic calendar API.

## Docs

- [docs/glossary.md](docs/glossary.md) — plain-language definitions for EMA, RSI, paper trading, backtesting, Sharpe ratio, drawdown, win rate, position sizing, and crossover signals
- [PRD.md](PRD.md) — product requirements and design decisions
