# Market Store — State Reference

**Status:** Reference for the Zustand migration. Not yet implemented.
**Related:** `plans/zustand-migration.md`

## Purpose

The market store is the only place high-frequency price data lives outside React.
It turns a ~20 ticks/sec firehose into ordered, merged, paise-denominated
per-symbol updates, and notifies only the components that care about the changed
symbol.

Two things it must guarantee:

1. **Correctness** — a late or duplicate tick can never overwrite a newer price.
2. **Isolation** — a RELIANCE tick must not re-render the TCS row, the summary,
   or the screen container.

Everything below exists to serve one of those two goals.

---

## Target shape (Zustand)

```ts
interface MarketState {
  quotes: ReadonlyMap<string, Quote>;
  lastSeq: Record<string, number>;
  lastTickAt: number;
  status: FeedStatus;

  applyTick: (tick: Tick) => boolean;
  applyBaseline: (baseline: readonly Quote[]) => void;
  startStatusPolling: () => void;
  stopStatusPolling: () => void;
}
```

Created with `createStore` from `zustand/vanilla`, consumed with `useStore` from
`zustand`. Exported as a singleton plus a `createMarketStore()` factory so tests
and non-app code get isolated instances.

---

## Fields

| Field | Question it answers | Who reads it |
|---|---|---|
| `quotes` | What is the current price per symbol? | `useQuote` rows, chart, detail, buy/sell, summary, sort |
| `lastSeq` | What is the newest tick accepted per symbol? | only `applyTick` / `applyBaseline` |
| `lastTickAt` | When did a live tick last land? | `computeFeedStatus` |
| `status` | Is the feed connecting / live / paused / stale? | `PausedBanner` |

### `quotes: ReadonlyMap<string, Quote>`

The single renderable price state.

- `useQuote(symbol)` selects `state.quotes.get(symbol)`; the `Map` gives O(1)
  lookup per selector.
- Non-reactive readers use `getState().quotes`: `PortfolioScreen` sort,
  `SummaryCard` totals, `BuySellSheet` fill price.
- It is a `Map` rather than a `Record` because `calculateSummary`,
  `sortHoldings`, and their tests already accept `ReadonlyMap`. Keeping the type
  leaves the domain layer untouched.
- **Replace, never mutate:** `new Map(prev)` then `.set()`. The new `Map`
  identity signals the change; untouched `Quote` objects keep their old identity,
  so their selectors return `Object.is`-equal values and those rows bail out.
  That is the re-render isolation mechanism.

Without it there is nothing to render and nothing for selectors to watch.

### `lastSeq: Record<string, number>`

The per-symbol high-water mark of accepted ticks — the correctness guard, not
render state.

- Ticks can arrive late or duplicated; without the guard an older tick overwrites
  a newer price.
- The guard is **per symbol**. A RELIANCE tick at seq 5 must not be rejected
  because TCS reached seq 9.
- It must advance even when a tick carries no usable `ltp`, so replaying that
  sequence later cannot resurrect an old price.
- It is not persisted and no component selects it.

**Trade-off:** keeping it in state makes it visible and resettable, but a
no-price tick now triggers a store notification (the old class did not). At ~25
symbols this is negligible; if exact parity matters, keep `lastSeq` in the
closure and leave only the four render-relevant fields in state.

Without it, stale ticks overwrite fresh prices and refresh can regress ordering.

### `lastTickAt: number`

Timestamp (ms) of the last successful tick — i.e. `quote.updatedAt`.

- Sole input to `computeFeedStatus(lastTickAt, now(), startedAt)`.
- Set only when a tick actually produced a quote, so a valid-but-priceless tick
  does not reset the silence clock.
- **Not** set by `applyBaseline`: a REST snapshot is not a live tick and must not
  make a dead feed look alive.

A scalar rather than deriving from `quotes` keeps feed health O(1) and separate
from price contents. Without it, `paused` and `stale` cannot be distinguished
from `live`.

### `status: FeedStatus`

`'connecting' | 'live' | 'paused' | 'stale'` — the renderable projection of feed
health, read by `PausedBanner` through `useFeedStatus()`.

It is cached in state rather than computed in render because it is evaluated on a
500 ms timer. The poller only calls `set` on an actual transition, so the banner
re-renders when health changes, not twice per second.

Folding it into `marketStore` removes the separate `FeedStatusStore`, giving one
store and one lifecycle owner for quotes plus feed health.

---

## Actions

### `applyTick(tick): boolean`

The single write path for live data. It owns four rules that must not be
reimplemented elsewhere:

1. Validate `symbol` and `seq`.
2. Apply the per-symbol stale guard against `lastSeq`.
3. Partial merge — absent `high` / `low` / `volume` keep their previous values.
4. Convert rupees to integer paise once, at this boundary.

It also bumps `lastTickAt` and replaces only the ticked symbol's `Quote`. The
`boolean` return reports whether the tick was applied.

Without a single action, the simulator and screens would each reimplement these
rules and drift.

### `applyBaseline(baseline)`

The single write path for REST snapshots (startup, pull-to-refresh).

REST rows carry `seq: 0`. The guard is updated with:

```ts
const seq = previousSeq === undefined
  ? incomingSeq
  : Math.max(previousSeq, incomingSeq);
```

Taking the max keeps in-flight ticks correctly ordered across a refresh. It also
does **not** touch `lastTickAt`. Keeping this rule in the store prevents callers
from silently resetting the guard.

Without it, refresh can resurrect stale prices or corrupt ordering.

### `startStatusPolling()`

Starts the 500 ms status evaluation, records `startedAt` for the connecting grace
window, sets `status: 'connecting'`, runs one evaluation immediately, and is
idempotent so refresh/resume cannot stack timers.

Called after the initial baseline, on pull-to-refresh, and on `AppState → active`.
The timer handle and `startedAt` live in the closure because they are not
renderable.

Without it, status stays `connecting` forever.

### `stopStatusPolling()`

Clears the timer and resets `status` to `'connecting'`.

Called on provider unmount, bootstrap error, and `AppState → background`. The
reset prevents a stale `paused` banner from lingering and gives a fresh grace
period on resume.

Without it, the timer leaks and the banner shows the wrong state after
backgrounding.

---

## Deliberately not in state

| Not included | Why |
|---|---|
| `timer`, `startedAt` | Non-renderable lifecycle internals; closure keeps them out of notifications |
| `getQuote` / `getQuotes` | `getState().quotes` and selectors cover this |
| `evaluateStatus` | Only start/stop are needed by callers; exposing it is optional |
| `hydrated` | Market data is not persisted; bootstrap status covers it |
| `quotesVersion` | The `Map` identity change already signals updates |

---

## Consumers

| Consumer | Read path |
|---|---|
| `HoldingRow`, `WatchlistRow`, `AddSymbolRow`, `StockDetailScreen`, `StatGrid`, `PositionCard`, `PriceChart`, `BuySellSheet` | `useQuote(symbol)` |
| `PortfolioScreen` sort | `useMarketVersion(1000)` + `getState().quotes` |
| `SummaryCard` | `useMarketVersion(250)` + `getState().quotes` |
| `PausedBanner` | `useFeedStatus()` |
| `MarketBootstrap` | `getState().applyBaseline / applyTick / startStatusPolling / stopStatusPolling` |

---

## Hooks: co-located vs separate

**Decision: co-locate per-store hooks with the store; keep cross-store derived
hooks where they are consumed.**

```
src/store/
  marketStore.ts    # state + actions + useQuote / useFeedStatus / useMarketVersion
  portfolioStore.ts # state + actions + useHoldings / useHolding
  watchlistStore.ts # state + actions + useWatchlist
```

Rationale:

- One file per store reads top-to-bottom: state → actions → persistence →
  selectors → hooks. That is the "easy to read" goal.
- No `hooks.ts` grab-bag that must import every store, which is also where
  circular imports tend to appear.
- The hook is the public read API of the store; keeping them together makes it
  obvious what a store exposes.

When **not** to co-locate:

- **Cross-store derived hooks** (e.g. `useSummary`, which needs portfolio
  holdings plus market quotes). These should live at the consumer or in a small
  `derived.ts`. This migration inlines `useSummary` into `SummaryCard`.
- **A store that must stay framework-agnostic.** Importing `useStore` from
  `zustand` pulls React into the module. For this app that is fine; if you ever
  want the vanilla store importable from plain Node with no React, split the
  hooks out.

There is no module boundary left to create a cycle:

```
feedStatus.ts  ──▶ marketStore.ts   (old: class imported the singleton)
```

The migration deletes `feedStatus.ts` entirely and inlines `computeFeedStatus`
into `marketStore.ts`, so the edge disappears rather than being reversed.
Verify with `npm run typecheck` after the move.

---

## Manual verification

- ~20 ticks/sec; only the ticked row commits in the Profiler.
- Summary ~250 ms; sort ~1 s.
- Stale `seq` ignored; partial ticks preserve `high` / `low` / `volume`.
- A tick with no usable `ltp` advances the guard but does not change the price.
- `applyBaseline` does not reset `lastSeq` and does not bump `lastTickAt`.
- Feed pause → banner → resume works; backgrounding stops polling.
- `OLDCO` still renders `—` and is excluded from totals.
