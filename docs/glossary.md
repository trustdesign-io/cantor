# Glossary

Definitions of the key terms used in Cantor. Plain language — no prior finance knowledge assumed.

---

## EMA — Exponential Moving Average

An average of closing prices over a given period, where more recent prices are weighted more heavily than older ones.

**Why it matters:** It smooths out short-term noise so you can see the overall direction of a price trend more clearly than looking at raw prices.

**In Cantor:** Two EMAs are computed — a fast one (9 periods) and a slow one (21 periods). When the fast EMA crosses above the slow EMA, that is a potential buy signal; when it crosses below, a potential sell signal. Cantor uses 1-minute candles for live trading and 60-minute candles for backtesting.

---

## RSI — Relative Strength Index

A momentum indicator on a 0–100 scale that measures how fast and how much prices have recently risen or fallen.

**Why it matters:** It helps identify whether an asset is "overbought" (RSI above 70 — possibly due for a pullback) or "oversold" (RSI below 30 — possibly due for a bounce).

**In Cantor:** RSI is used as a filter on top of the EMA crossover signal. A buy signal is only acted on if RSI is between 30 and 70 (i.e. not in an extreme zone). The period is 14 bars.

---

## Paper trading

Simulated trading using real market prices but with no real money at stake.

**Why it matters:** It lets you test whether a strategy would have worked, or is working right now, without financial risk.

**In Cantor:** The paper trader starts with a fixed balance (£10,000) and places simulated buy and sell orders at the live market price when the strategy fires a signal. No real orders are sent to any exchange. All trade records are ephemeral — they exist only in memory and are reset when the page is refreshed.

---

## Backtesting

Running a strategy against historical price data to see how it would have performed in the past.

**Why it matters:** It gives a rough indication of whether a strategy has any edge, though past performance does not guarantee future results.

**In Cantor:** The backtest tab fetches historical 60-minute OHLC candles from Kraken's public REST API for the selected date range. The same EMA crossover + RSI strategy is then replayed bar-by-bar. Each bar recomputes the indicators from scratch over all preceding data (O(n²) — acceptable for up to ~720 candles).

---

## Sharpe ratio

A measure of risk-adjusted return: how much return you earned per unit of volatility.

**Why it matters:** A strategy with a high average return but wild swings may be worse in practice than a steadier strategy with a lower average return. The Sharpe ratio accounts for that.

**In Cantor:** Computed per-trade, not annualised. The risk-free rate is set to zero. The formula uses sample standard deviation (N−1) of per-trade percentage returns. Returns below 0 indicate the strategy lost more per unit of risk than it gained. A value above 1 is generally considered acceptable; above 2 is good.

---

## Drawdown

The peak-to-trough decline in account balance — how far the balance fell from its highest point before recovering.

**Why it matters:** A strategy might ultimately be profitable but suffer a large intermediate loss. Drawdown tells you the worst-case losing streak you would have had to endure.

**In Cantor:** Maximum drawdown is shown as a percentage of the peak balance. It is computed over the sequence of completed trades in chronological order. Open positions are not included.

---

## Win rate

The proportion of completed trades that were profitable.

**Why it matters:** A high win rate alone does not make a strategy good — you also need to know the average size of wins vs. losses. A 40% win rate is fine if wins are 3× larger than losses on average.

**In Cantor:** Win rate = number of trades with pnlAbsolute > 0 divided by total completed trades. Break-even trades (exactly £0 P&L) are counted as losses.

---

## Position sizing

How much of the available capital is deployed into each trade.

**Why it matters:** Deploying too much on a single trade amplifies both gains and losses. Most risk management frameworks limit each trade to a small percentage of total capital.

**In Cantor:** The paper trader is simplified — it deploys 100% of the available balance into each trade. There is no fractional sizing, risk-per-trade limit, or Kelly criterion. This is a deliberate simplification to keep the system easy to understand.

---

## Crossover signal

The moment when a faster-moving average crosses above or below a slower-moving average, indicating a potential trend change.

**Why it matters:** Crossovers are one of the most widely used signals in technical analysis because they are objective and easy to automate.

**In Cantor:** A golden cross (EMA 9 crosses above EMA 21) is a BUY signal. A death cross (EMA 9 crosses below EMA 21) is a SELL signal. Both are subject to the RSI filter (30–70 range) before being acted on.

---

## Base signal

The raw BUY, SELL, or HOLD emitted by the core EMA crossover + RSI strategy, before any supplementary filters are applied.

**Why it matters:** Separating the base signal from the final signal makes it possible to log *why* a trade was suppressed (e.g. "BUY was ready but funding was extreme"), which helps you evaluate whether each filter is actually adding value.

**In Cantor:** `detectSignal` returns both `baseSignal` and `signal`. The Signal Log shows the base signal classification alongside any veto reason so you can see what the strategy *wanted* to do.

---

## Filter

A pure, synchronous function that can veto a base signal by returning `{ ok: false, reason }`. Filters run in order; the first veto wins.

**Why it matters:** The EMA crossover strategy fires on price action alone. Supplementary filters add awareness of external conditions — extreme funding rates, macro event windows, sentiment extremes — that historically degrade signal quality.

**In Cantor:** Filters live in `src/strategy/filters/` and are registered in `DEFAULT_FILTERS` in `src/strategy/signals.ts`. Each filter receives the full candle history and a `FilterContext` object containing pre-fetched async data (funding rate, fear & greed index, etc.). Filters must not make network calls.

---

## Veto

The act of a filter downgrading a non-HOLD base signal to HOLD. When a veto occurs, the signal engine records which filter fired and the human-readable reason.

**Why it matters:** Without explicit veto logging, a suppressed trade is invisible — you can't distinguish "strategy said HOLD" from "strategy said BUY but a filter blocked it". Cantor surfaces both in the Signal Log.

**In Cantor:** A vetoed event appears in the Signal Log with muted styling and a "vetoed: <reason>" note. The filter contribution report (Phase 9) uses veto data to measure each filter's impact on backtested performance.

---

## Funding rate

In perpetual futures markets, the funding rate is a recurring payment exchanged between long and short holders, typically every 8 hours. When the rate is positive, longs pay shorts; when negative, shorts pay longs.

**Why it matters:** Funding rate is a proxy for crowd positioning. Extreme positive funding means leveraged longs are paying to hold positions — the market is crowded on the long side and mean-reversion shorts have historical edge. Extreme negative funding signals crowded shorts.

**In Cantor:** The average funding rate from Binance and Bybit is displayed in the app header. The `isFundingExtreme` filter vetoes new long positions when average funding exceeds +0.1% per 8 hours, and new short positions when it falls below -0.05% per 8 hours.

---

## Perpetual futures

Derivative contracts that track the spot price of an asset with no expiry date. They use a funding mechanism to keep the contract price anchored to spot.

**Why it matters:** Perpetual futures represent the dominant trading instrument for crypto retail and institutional traders. Funding rate data from perp markets provides insight into crowd positioning that spot price alone cannot.

**In Cantor:** Funding rate data is fetched from the Binance (`fapi.binance.com`) and Bybit (`api.bybit.com`) public APIs, no authentication required.

---

## Basis

The difference between the perpetual futures price and the spot price. Related to funding rate: a positive basis (futures trading above spot) tends to produce positive funding as long holders pay to maintain their position.

**Why it matters:** When basis is extreme, it can indicate speculative excess. Basis compression (futures price falling toward spot) often accompanies deleveraging events.

**In Cantor:** Basis is not currently tracked directly — funding rate is used as the practical proxy since it is more directly actionable.
