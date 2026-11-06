# React Native Take-Home: Live Portfolio

## The goal

Build a small stock portfolio app in React Native that stays **correct** and **smooth** while prices tick ~20 times per second. You have **3 calendar days**. A finished core beats a half-built everything.

They explicitly optimise for three things:

1. **Performance** — live price lists must not re-render everything on every tick.
2. **Correctness** — money values never wrong, and never faked when data is missing.
3. **Structure** — code a teammate could pick up and extend.

AI tools are allowed, but you'll be asked to walk through and extend the code live in the next round.

---

## What to build

### 1. Portfolio (home)

- **Summary card**: current value, total invested, total P&L, today's P&L — each in ₹ and %.
- **Holdings list**: symbol, quantity, average price, last price, P&L in ₹ and %. Green for gain, red for loss; rows update live.
- Sort by **name, value, or P&L**; filter by symbol as you type.
- **Pull to refresh** re-fetches prices from the API.

### 2. Watchlist

- Symbol, last price, day change in ₹ and %.
- Add from the provided 25-symbol list; remove with a swipe.
- **Persists across app restart**.

### 3. Stock detail

- Opens from any Portfolio or Watchlist row.
- Live last price, day change, open, high, low, previous close, volume.
- Small **line chart of ticks received since the screen opened**.
- Shows your position if you hold the stock.

### 4. Buy/sell sheet (from Stock detail)

- Buy or sell, enter quantity, see estimated value at the live price.
- Validate: whole numbers > 0; cannot sell more than held.
- Confirm fills at the **last price** and updates holdings immediately. Buys change the average price. Holdings and Summary must stay consistent.
- Orders are **local only** — no real order.

### Every screen

- Loading, empty, and error states with retry.
- A visible **"prices paused"** indicator when ticks stop.
- Light/dark mode following the system setting.
- **Indian number formatting**, e.g. ₹12,34,567.89.

---

## Data and the price feed

**REST seed data**: `POST https://api.v2.liquide.life/api/markets/ohlc` with `{"symbols": [...]}`. No login. Success is **HTTP 201**, data under `message.data`. Fields include `ltp`, `open`, `prevClose`, `high`, `low`, `volume`, `timeStamp`, `tsn`, etc.

Important API quirks:

- Unknown symbols are **silently omitted** from the response.
- Outside market hours, prices are the last close — expected.
- It's a **shared test server**: fetch once at start and on refresh. **Do not poll.**

**The 25 allowed symbols:**

```
RELIANCE, TCS, HDFCBANK, INFY, ICICIBANK, SBIN, BHARTIARTL, ITC, LT,
HINDUNILVR, KOTAKBANK, AXISBANK, BAJFINANCE, MARUTI, SUNPHARMA, TITAN,
ASIANPAINT, ULTRACEMCO, WIPRO, NTPC, POWERGRID, ONGC, TATASTEEL,
ADANIENT, HCLTECH
```

**Starting holdings (21 rows, bundled with the app):**

| Symbol | Qty | Avg Price |
|---|---:|---:|
| RELIANCE | 25 | 1319.59 |
| TCS | 40 | 2589.71 |
| HDFCBANK | 10 | 755.86 |
| INFY | 10 | 1114.70 |
| ICICIBANK | 5 | 1566.04 |
| SBIN | 15 | 800.62 |
| BHARTIARTL | 40 | 1890.80 |
| ITC | 15 | 225.74 |
| LT | 40 | 3250.32 |
| HINDUNILVR | 100 | 1605.15 |
| KOTAKBANK | 15 | 474.57 |
| AXISBANK | 100 | 1378.55 |
| BAJFINANCE | 100 | 951.52 |
| MARUTI | 5 | 13017.25 |
| SUNPHARMA | 5 | 1784.28 |
| TITAN | 12 | 4061.93 |
| ASIANPAINT | 12 | 2316.35 |
| ULTRACEMCO | 100 | 10181.27 |
| WIPRO | 12 | 169.36 |
| NTPC | 100 | 326.00 |
| **OLDCO** | **30** | **412.50** |

**`OLDCO` is deliberate:** it is not one of the API's recognised symbols, so it will never be returned. This is the built-in "missing price" case.

---

## Tick simulator (must be built)

A separate module that behaves like a socket client, exposing:

- `connect()`
- `disconnect()`
- `onTick(handler)`

The screens must **not** be able to tell it's fake.

Behaviour:

- Emit **~20 ticks/second across all symbols**.
- Each tick moves one symbol's `ltp` by up to **±0.2%**, and may also change `high`, `low`, `volume`.
- Tick shape: `{ symbol, seq, ltp?, high?, low?, volume? }`.
- Ticks are **partial updates** — only changed fields are present; don't overwrite absent fields.
- `seq` increases per symbol. **~2% of ticks arrive late, out of order, and must be ignored.**
- Roughly once a minute, the feed goes silent for **5 seconds**, then resumes — this drives the "prices paused" indicator.

---

## Missing data rule

If a price is unavailable, display **"—"**. Never show `0` or a guessed value, and **never count an unpriced holding as zero in totals**. You must decide how Summary presents the unpriced holding and justify it in the README.

---

## Firm technical requirements

- React Native + **TypeScript in strict mode**. Expo or bare RN.
- Must run on **Android or iOS**; state which you tested.
- Any state/navigation/chart libraries — be ready to explain why.
- Expect re-render issues; they'll evaluate with **React DevTools Profiler**.
- List must stay smooth while scrolling at 20 ticks/sec.
- **P&L and price calculations in plain functions outside components, with unit tests.**
- Handle money rounding deliberately; Summary totals must match the sum of displayed rows, or the README must explain why not.
- Use a theme for light/dark mode.

---

## Stretch goals (only after core is solid)

- Price-cell flash on change, running on the UI thread.
- Reconnect with backoff + catch-up REST fetch when the feed returns.
- Limit orders that fill when the simulated price crosses the limit.
- Orders history persisted across restarts.
- Dev menu simulator controls: tick rate and force disconnect.

---

## Submission

- Git repo link within 3 days.
- Keep commit history — **do not squash**.
- 1–2 minute screen recording on device/emulator.
- README must cover: install/run; state and re-render approach and why; how Summary handles an unpriced holding; what you skipped and what you'd do next; roughly how long you spent.

---

## How it's scored

| Area | Weight | What they look for |
|---|---:|---|
| Performance | 30% | Rows update in isolation, smooth scrolling under ticks, no needless re-renders |
| Correctness | 25% | Correct P&L/averages, late ticks ignored, `—` instead of fake values, totals reconcile |
| Architecture & state | 20% | Clear separation of feed/state/UI; simulator swappable for a real socket |
| UI & edge cases | 15% | Loading/empty/error/paused states, both themes, number formatting |
| TypeScript & tests | 10% | Strict types without `any`, meaningful calculation tests |

Extra features do **not** compensate for gaps in the core.

---

## The traps to flag before building

1. **`OLDCO` intentionally has no price** — Summary needs a deliberate policy (likely: exclude it from both current value and invested totals, show the totals as "excludes 1 unpriced holding", and show `—` for its last price/P&L).
2. **Late/out-of-order ticks** need a per-symbol `seq` guard, not global ordering.
3. **Partial ticks** mean each field must be merged only when present.
4. **20 ticks/sec** rules out one global React state object driving the whole tree; you need per-symbol subscriptions (external store + `useSyncExternalStore` with selectors, or Zustand selectors) plus memoised rows and a virtualised list.
5. **Don't poll the shared API** — only initial load and pull-to-refresh.
6. **Rounding**: decide integer-paise math vs floating point, and make Summary reconcile to displayed row values (or document the deviation).
7. **Paused indicator**: must distinguish "temporarily silent" (the 5-second gap) from broken/stale.
8. **Persistence** is required only for the watchlist in the core; orders history is stretch.
