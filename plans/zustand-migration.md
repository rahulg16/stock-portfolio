# Zustand Migration Plan

**Status:** Planned — not implemented. No source files have been changed.
**Scope:** Replace the hand-rolled store classes with Zustand vanilla stores.
**Tests:** Excluded from scope. Obsolete store tests are deleted, no new tests are written.
**Reference:** `plans/market-store.md` for the market state field-by-field rationale.

---

## 1. Goal

Make the state layer easier to read and smaller to maintain by removing the
hand-rolled pub/sub classes, without changing:

- the domain money/calculation logic,
- the `PriceFeed` contract and the simulator's public API,
- the hook APIs that screens already use,
- the storage keys.

Target: **three stores, each one readable file**, persistence declared through
middleware instead of a custom persist queue.

### Non-goals

- No rewrite of `src/domain/*`.
- No rewrite of `src/api/*`.
- No change to the `PriceFeed` interface or the simulator's observable behaviour.
- No new tests. See §11.
- No UI redesign.
- No new persisted state (market quotes stay in memory).

---

## 2. Target structure

```text
src/store/
  marketStore.ts      # quotes, ticks, baseline, feed status, hooks
  portfolioStore.ts   # holdings, orders, persistence, hooks
  watchlistStore.ts   # symbols, add/remove, persistence, hooks
  storage.ts          # safeStorage + legacy-format normaliser

src/feed/
  simulator.ts        # factory, no class (simplified; same public API)
  types.ts            # unchanged
```

`feedStatus.ts` is deleted entirely; its one pure function is inlined into
`marketStore.ts` (see §7). Nothing in `feed/` is a store or a class.

### Files added

| File | Purpose |
|---|---|
| `src/store/storage.ts` | `safeStorage()` wrapper; best-effort AsyncStorage |
| `plans/market-store.md` | Market state reference |
| `plans/zustand-migration.md` | This document |

### Files deleted

| File | Reason |
|---|---|
| `src/store/hooks.ts` | Hooks move beside their stores; `useSummary` is inlined |
| `src/feed/feedStatus.ts` | `computeFeedStatus` is inlined into `marketStore.ts`; the class is removed |
| `src/__tests__/marketStore.test.ts` | Imports the removed `MarketStore` class |
| `src/__tests__/portfolioStore.test.ts` | Imports the removed `PortfolioStore` class |
| `src/feed/__tests__/feedStatus.test.ts` | Imports the removed `FeedStatusStore` class |

### Files rewritten

| File | Change |
|---|---|
| `src/feed/simulator.ts` | `TickSimulator` class → `createTickSimulator()` closure factory; same public API |

### Files unchanged

`src/domain/**`, `src/api/**`, `src/feed/types.ts`, theme, navigation.

---

## 3. Dependency and conventions

```bash
npm install zustand
```

Use Zustand v5 (compatible with React 19).

Imports:

```ts
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
```

Why `createStore` (vanilla) + `useStore` instead of `create`:

- Factories return isolated instances, so tests do not leak singletons.
- The app exports one singleton per store; no provider wrapper is needed.
- React components read through `useStore(singleton, selector)`.

Conventions:

- State holds only serializable, renderable data.
- Non-reactive internals (`timer`, `startedAt`) live in a closure.
- Never mutate `Map`/arrays in place; always replace:
  ```ts
  const next = new Map(get().quotes);
  next.set(symbol, quote);
  set({ quotes: next });
  ```
- Never return object/array literals from a selector:
  ```ts
  // bad: new object every render
  useStore(marketStore, (s) => ({ quote: s.quotes.get(symbol) }))
  // good: stable reference
  useStore(marketStore, (s) => s.quotes.get(symbol))
  ```
- Persist only user data through `partialize`; never actions.

---

## 4. Portfolio store

`src/store/portfolioStore.ts`

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createStartingHoldings } from '../domain/seed';
import { executeOrder } from '../domain/orders';
import type { Holding, MoneyPaise, OrderSide } from '../domain/types';
import { safeStorage, type StorageLike } from './storage';

export const HOLDINGS_STORAGE_KEY = 'stockportfolio.holdings.v1';

export interface PortfolioState {
  holdings: Holding[];
  applyOrder: (
    symbol: string,
    side: OrderSide,
    qty: number,
    fillPricePaise: MoneyPaise,
  ) => void;
}

export function createPortfolioStore(storage: StorageLike = AsyncStorage) {
  return createStore<PortfolioState>()(
    persist(
      (set) => ({
        holdings: createStartingHoldings(),
        applyOrder: (symbol, side, qty, fillPricePaise) => {
          set((state) => ({
            holdings: executeOrder(
              state.holdings,
              symbol,
              side,
              qty,
              fillPricePaise,
            ),
          }));
        },
      }),
      {
        name: HOLDINGS_STORAGE_KEY,
        version: 1,
        storage: createJSONStorage(() =>
          withLegacyFormat(safeStorage(storage), HOLDINGS_STORAGE_KEY),
        ),
        skipHydration: true,
        partialize: (state) => ({ holdings: state.holdings }),
        merge: (persisted, current) => ({
          ...current,
          holdings:
            parseHoldings((persisted as { holdings?: unknown } | undefined)?.holdings) ??
            createStartingHoldings(),
        }),
      },
    ),
  );
}

export const portfolioStore = createPortfolioStore();

export const useHoldings = (): readonly Holding[] =>
  useStore(portfolioStore, (state) => state.holdings);

export const useHolding = (symbol: string): Holding | undefined =>
  useStore(portfolioStore, (state) =>
    state.holdings.find((holding) => holding.symbol === symbol),
  );
```

`parseHoldings` stays private and unchanged. Hydration becomes:

```ts
await portfolioStore.persist.rehydrate();
```

`useHolding` is new: it makes Detail and BuySellSheet reactive to a trade, which
the current `getHolding()` snapshot is not.

---

## 5. Watchlist store

`src/store/watchlistStore.ts`

```ts
export interface WatchlistState {
  symbols: string[];
  add: (symbol: string) => boolean;
  remove: (symbol: string) => void;
}

export function createWatchlistStore(storage: StorageLike = AsyncStorage) {
  return createStore<WatchlistState>()(
    persist(
      (set, get) => ({
        symbols: [],
        add: (symbol) => {
          const { symbols } = get();
          if (!ALLOWED_SYMBOL_SET.has(symbol) || symbols.includes(symbol)) {
            return false;
          }
          set({ symbols: [...symbols, symbol] });
          return true;
        },
        remove: (symbol) => {
          const { symbols } = get();
          if (!symbols.includes(symbol)) return;
          set({ symbols: symbols.filter((existing) => existing !== symbol) });
        },
      }),
      {
        name: WATCHLIST_STORAGE_KEY,
        version: 1,
        storage: createJSONStorage(() =>
          withLegacyFormat(safeStorage(storage), WATCHLIST_STORAGE_KEY),
        ),
        skipHydration: true,
        partialize: (state) => ({ symbols: state.symbols }),
        merge: (persisted, current) => ({
          ...current,
          symbols: parseWatchlist(
            (persisted as { symbols?: unknown } | undefined)?.symbols,
          ),
        }),
      },
    ),
  );
}

export const watchlistStore = createWatchlistStore();

export const useWatchlist = (): readonly string[] =>
  useStore(watchlistStore, (state) => state.symbols);
```

Returning `false` without calling `set` avoids a needless notification for
duplicate/invalid adds.

---

## 6. Market store

`src/store/marketStore.ts` — full rationale in `plans/market-store.md`.

The feed-health helpers live in this file, because `status` is part of
`MarketState` and nothing else needs them:

```ts
const PAUSED_AFTER_MS = 1500;
const STALE_AFTER_MS = 10_000;
const STATUS_POLL_MS = 500;

/**
 * Derives a user-facing status from tick silence. A 5-second simulator gap is
 * "paused"; a much longer gap is "stale", so the UI can distinguish a known
 * feed gap from a broken connection.
 */
function computeFeedStatus(
  lastTickAt: number,
  now: number,
  startedAt: number,
): FeedStatus {
  const age = lastTickAt === 0 ? Number.POSITIVE_INFINITY : now - lastTickAt;
  if (age < PAUSED_AFTER_MS) return 'live';
  if (now - startedAt < PAUSED_AFTER_MS) return 'connecting';
  return age < STALE_AFTER_MS ? 'paused' : 'stale';
}

export interface MarketState {
  quotes: ReadonlyMap<string, Quote>;
  lastSeq: Record<string, number>;
  lastTickAt: number;
  status: FeedStatus;

  applyTick: (tick: Tick) => boolean;
  applyBaseline: (baseline: readonly Quote[]) => void;
  startStatusPolling: () => void;
  stopStatusPolling: () => void;
}

export function createMarketStore() {
  let timer: ReturnType<typeof setInterval> | null = null;
  let startedAt = 0;

  return createStore<MarketState>()((set, get) => {
    const evaluateStatus = () => {
      const next = computeFeedStatus(get().lastTickAt, Date.now(), startedAt);
      if (next !== get().status) set({ status: next });
    };

    return {
      quotes: new Map(),
      lastSeq: {},
      lastTickAt: 0,
      status: 'connecting',

      applyTick: (tick) => {
        if (!tick.symbol || !Number.isInteger(tick.seq) || tick.seq <= 0) {
          return false;
        }

        const { quotes, lastSeq } = get();
        if (tick.seq <= (lastSeq[tick.symbol] ?? 0)) return false;

        const previous = quotes.get(tick.symbol);
        const ltpPaise = isPositiveFinite(tick.ltp)
          ? toPaise(tick.ltp)
          : previous?.ltpPaise;

        if (ltpPaise === undefined) {
          // Advance the guard even without a price, so a replay cannot
          // resurrect an older quote later.
          set({ lastSeq: { ...lastSeq, [tick.symbol]: tick.seq } });
          return false;
        }

        const quote: Quote = {
          symbol: tick.symbol,
          ltpPaise,
          openPaise: previous?.openPaise ?? null,
          prevClosePaise: previous?.prevClosePaise ?? null,
          highPaise: isPositiveFinite(tick.high)
            ? toPaise(tick.high)
            : (previous?.highPaise ?? null),
          lowPaise: isPositiveFinite(tick.low)
            ? toPaise(tick.low)
            : (previous?.lowPaise ?? null),
          volume: isNonNegativeFinite(tick.volume)
            ? Math.round(tick.volume)
            : (previous?.volume ?? null),
          seq: tick.seq,
          updatedAt: Date.now(),
        };

        const nextQuotes = new Map(quotes);
        nextQuotes.set(tick.symbol, quote);

        set({
          quotes: nextQuotes,
          lastSeq: { ...lastSeq, [tick.symbol]: tick.seq },
          lastTickAt: quote.updatedAt,
        });
        return true;
      },

      applyBaseline: (baseline) => {
        const { quotes, lastSeq } = get();
        const nextQuotes = new Map(quotes);
        const nextSeq = { ...lastSeq };

        for (const incoming of baseline) {
          const previousSeq = nextSeq[incoming.symbol];
          const incomingSeq = Number.isInteger(incoming.seq) ? incoming.seq : 0;
          const seq =
            previousSeq === undefined
              ? incomingSeq
              : Math.max(previousSeq, incomingSeq);

          nextSeq[incoming.symbol] = seq;
          nextQuotes.set(incoming.symbol, {
            ...incoming,
            seq,
            updatedAt: Date.now(),
          });
        }

        set({ quotes: nextQuotes, lastSeq: nextSeq });
      },

      startStatusPolling: () => {
        if (timer !== null) return;
        startedAt = Date.now();
        set({ status: 'connecting' });
        evaluateStatus();
        timer = setInterval(evaluateStatus, STATUS_POLL_MS);
      },

      stopStatusPolling: () => {
        if (timer !== null) clearInterval(timer);
        timer = null;
        set({ status: 'connecting' });
      },
    };
  });
}

export const marketStore = createMarketStore();

export const useQuote = (symbol: string): Quote | undefined =>
  useStore(marketStore, (state) => state.quotes.get(symbol));

export const useFeedStatus = (): FeedStatus =>
  useStore(marketStore, (state) => state.status);
```

`useMarketVersion` keeps the existing throttle logic but lives in this file:

```ts
export function useMarketVersion(intervalMs: number): number {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let lastBump = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const bump = () => {
      lastBump = Date.now();
      setVersion((current) => current + 1);
    };

    const unsubscribe = marketStore.subscribe(() => {
      const elapsed = Date.now() - lastBump;
      if (elapsed >= intervalMs) {
        bump();
        return;
      }
      if (timer === null) {
        timer = setTimeout(() => {
          timer = null;
          bump();
        }, intervalMs - elapsed);
      }
    });

    return () => {
      unsubscribe();
      if (timer !== null) clearTimeout(timer);
    };
  }, [intervalMs]);

  return version;
}
```

Notes:

- `lastSeq` is in state for visibility/reset; see the trade-off in
  `plans/market-store.md`.
- `quotes` is replaced, never mutated.
- `applyBaseline` does not touch `lastTickAt` (a snapshot is not a live tick).
- `startStatusPolling` is idempotent.

---

## 7. Feed status: no module, no class

There is no `src/feed/feedStatus.ts` after the migration. Everything it contained
was needed by exactly one consumer — `marketStore` — so it moves there.

| Old export | New home |
|---|---|
| `PAUSED_AFTER_MS`, `STALE_AFTER_MS`, `STATUS_POLL_MS` | private constants in `marketStore.ts` |
| `FeedStatusThresholds` | **deleted** (only tests overrode it; tests are out of scope) |
| `computeFeedStatus` | private function in `marketStore.ts` |
| `class FeedStatusStore` | **deleted**; replaced by `startStatusPolling` / `stopStatusPolling` |
| `feedStatusStore` singleton | **deleted**; use `marketStore.getState()` |

Why this is safe:

- After deleting the tests, no caller passes custom thresholds, so the options
  parameter was dead configurability.
- No other file imports `computeFeedStatus` or the constants.
- `PausedBanner` already reads through the `useFeedStatus()` hook, so its import
  path changes but its API does not.
- The `feedStatus ↔ marketStore` cycle disappears because there is only one
  module left.

If thresholds are ever needed again, restoring the parameter is a two-line
change; it does not justify a file today.

### 7.1 Simulator: closure factory, no class

`src/feed/simulator.ts` keeps the same public API but loses the class. The
`PriceFeed` seam in `types.ts` is unchanged.

```ts
import { fromPaise } from '../domain/money';
import type { Quote, Tick } from '../domain/types';
import type { PriceFeed, TickHandler, TickSimulatorOptions } from './types';

interface SymbolState {
  ltpPaise: number;
  highPaise: number | null;
  lowPaise: number | null;
  volume: number;
  seq: number;
  lastTick: Tick | null;
}

const DEFAULT_INTERVAL_MS = 50;
const DEFAULT_STALE_RATE = 0.02;
const DEFAULT_PAUSE_DURATION_MS = 5000;

export interface TickSimulator extends PriceFeed {
  /** Refreshes the running state from a REST snapshot (pull-to-refresh). */
  updateBaseline(quotes: readonly Quote[]): void;
}

export function createTickSimulator(options: TickSimulatorOptions): TickSimulator {
  const states = new Map<string, SymbolState>();
  const handlers = new Set<TickHandler>();

  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const staleRate = options.staleRate ?? DEFAULT_STALE_RATE;
  const pauseDurationMs = options.pauseDurationMs ?? DEFAULT_PAUSE_DURATION_MS;
  const rng = options.rng ?? Math.random;

  let interval: ReturnType<typeof setInterval> | null = null;
  let pauseTimer: ReturnType<typeof setTimeout> | null = null;
  let paused = false;

  const seed = (quote: Quote): void => {
    states.set(quote.symbol, {
      ltpPaise: quote.ltpPaise,
      highPaise: quote.highPaise,
      lowPaise: quote.lowPaise,
      volume: quote.volume ?? 0,
      seq: quote.seq,
      lastTick: null,
    });
  };

  const pauseGap = (): number => {
    const configured = options.pauseIntervalMs;
    if (typeof configured === 'function') return configured();
    return configured ?? 60_000 + rng() * 30_000;
  };

  const schedulePause = (): void => {
    pauseTimer = setTimeout(() => {
      paused = true;
      pauseTimer = setTimeout(() => {
        paused = false;
        pauseTimer = null;
        if (interval !== null) schedulePause();
      }, pauseDurationMs);
    }, pauseGap());
  };

  const emit = (tick: Tick): void => {
    for (const handler of handlers) handler(tick);
  };

  const emitTick = (): void => {
    if (paused) return;

    const symbols = Array.from(states.keys());
    if (symbols.length === 0) return;

    const symbol =
      symbols[Math.min(symbols.length - 1, Math.floor(rng() * symbols.length))];
    if (symbol === undefined) return;
    const state = states.get(symbol);
    if (!state) return;

    const movement = (rng() * 2 - 1) * 0.002;
    const nextLtpPaise = Math.max(1, Math.round(state.ltpPaise * (1 + movement)));

    state.seq += 1;
    const tick: Tick = { symbol, seq: state.seq, ltp: fromPaise(nextLtpPaise) };

    if (state.highPaise === null || nextLtpPaise > state.highPaise) {
      state.highPaise = nextLtpPaise;
      tick.high = fromPaise(nextLtpPaise);
    }
    if (state.lowPaise === null || nextLtpPaise < state.lowPaise) {
      state.lowPaise = nextLtpPaise;
      tick.low = fromPaise(nextLtpPaise);
    }
    if (rng() < 0.3) {
      state.volume += 1 + Math.floor(rng() * 5000);
      tick.volume = state.volume;
    }

    const previous = state.lastTick;
    state.ltpPaise = nextLtpPaise;
    state.lastTick = tick;

    emit(tick);

    // Replay the immediately previous tick. Its seq is already behind the
    // store's guard, so it must be discarded.
    if (previous && staleRate > 0 && rng() < staleRate) emit(previous);
  };

  for (const quote of options.baseline) seed(quote);

  return {
    connect: () => {
      if (interval !== null) return;
      paused = false;
      interval = setInterval(emitTick, intervalMs);
      schedulePause();
    },
    disconnect: () => {
      if (interval !== null) clearInterval(interval);
      interval = null;
      if (pauseTimer !== null) clearTimeout(pauseTimer);
      pauseTimer = null;
      paused = false;
    },
    onTick: (handler) => {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },
    updateBaseline: (quotes) => {
      for (const quote of quotes) {
        const existing = states.get(quote.symbol);
        if (!existing) {
          seed(quote);
          continue;
        }
        existing.ltpPaise = quote.ltpPaise;
        existing.highPaise = quote.highPaise ?? existing.highPaise;
        existing.lowPaise = quote.lowPaise ?? existing.lowPaise;
        existing.volume = quote.volume ?? existing.volume;
        existing.seq = Math.max(existing.seq, quote.seq);
      }
    },
  };
}
```

### What got simpler

| Before | After |
|---|---|
| `class TickSimulator` + `new` wrapper | one `createTickSimulator()` factory |
| `private` fields + constructor assignments | plain `const` / `let` in the closure |
| `this.emitTick` arrow-binding | closure function; no `this` |
| `history: Tick[]` capped at 50 + random index math | `lastTick: Tick \| null`; replay the previous tick |
| `nextPauseTimer` + `resumeTimer` | one `pauseTimer` (the two phases never overlap) |
| duplicated baseline seeding | `seed(quote)` helper |
| `MAX_HISTORY` constant | removed |

Behaviour is deliberately identical:

- one tick per 50 ms (~20/s),
- `high` / `low` only when a new extreme is reached,
- `volume` occasionally,
- 5 s silence every 60–90 s,
- ~2% stale replay, now always the immediately previous tick,
- `updateBaseline` adds new symbols and merges existing ones.

The stale replay still exercises the store's per-symbol `seq` guard — it is
`seq - 1` relative to the tick just emitted, which is exactly what the guard
must reject.

Compatibility:

- `createTickSimulator(options)` — unchanged call.
- `TickSimulator` — now an interface; `MarketBootstrap` already imports it with
  `type`.
- `simulator.test.ts` — unchanged; all nine cases still hold, including the
  stale-replay and pause/resume tests.
- `src/feed/types.ts` — unchanged, so a real socket can implement `PriceFeed`
  without importing the simulator.

The only runtime wiring change is still in `MarketBootstrap.tsx`:

```ts
// before
simulator.onTick((tick) => marketStore.applyTick(tick));
// after
simulator.onTick((tick) => marketStore.getState().applyTick(tick));
```

---

## 8. `src/store/storage.ts`

```ts
import type AsyncStorage from '@react-native-async-storage/async-storage';

export type StorageLike = Pick<
  typeof AsyncStorage,
  'getItem' | 'setItem' | 'removeItem'
>;

export function safeStorage(storage: StorageLike) {
  return {
    getItem: async (key: string): Promise<string | null> => {
      try {
        return await storage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem: async (key: string, value: string): Promise<void> => {
      try {
        await storage.setItem(key, value);
      } catch {
        // Persistence is best effort.
      }
    },
    removeItem: async (key: string): Promise<void> => {
      try {
        await storage.removeItem(key);
      } catch {
        // Persistence is best effort.
      }
    },
  };
}
```

### Legacy on-disk format compatibility

The current stores write bare JSON arrays:

```
stockportfolio.holdings.v1  →  [{"symbol":"TCS","qty":10,"avgPricePaise":...}, ...]
stockportfolio.watchlist.v1 →  ["TCS","INFY"]
```

Zustand `persist` writes an envelope instead:

```
{"state":{"holdings":[...]},"version":1}
```

If the key is kept and the old value is read unchanged, Zustand extracts
`parsed.state`, which is `undefined` for a bare array, and the user's holdings
are silently replaced by the seeded bundle. Handle this once, at read time:

```ts
export function withLegacyFormat(
  storage: ReturnType<typeof safeStorage>,
  key: string,
): ReturnType<typeof safeStorage> {
  return {
    ...storage,
    getItem: async (storageKey) => {
      const raw = await storage.getItem(storageKey);
      if (raw === null) return null;
      try {
        const parsed: unknown = JSON.parse(raw);
        // Zustand envelope already: leave it alone.
        if (
          parsed !== null &&
          typeof parsed === 'object' &&
          !Array.isArray(parsed) &&
          'state' in parsed
        ) {
          return raw;
        }
        // Legacy bare array / object: wrap it in the Zustand envelope.
        const state =
          storageKey === HOLDINGS_STORAGE_KEY
            ? { holdings: parsed }
            : { symbols: parsed };
        return JSON.stringify({ state, version: 1 });
      } catch {
        return raw; // Let persist fall back to defaults.
      }
    },
  };
}
```

Alternative if preserving local data is not a requirement: bump the keys to
`stockportfolio.holdings.v2` / `stockportfolio.watchlist.v2` and accept a reset on
first launch after the upgrade. This is simpler but discards holdings and
watchlist. **Recommendation: keep the keys and use the normaliser.**

Because the two stores share the helper, `withLegacyFormat` checks the storage
key to decide the wrapper shape. If that coupling is undesirable, pass an
explicit `wrap: (legacy: unknown) => object` callback instead.

> Note: `withLegacyFormat` is only needed for upgrades from the current build.
> On a fresh install the legacy path is never taken.

---

## 9. Hooks placement

**Decision:** co-locate per-store hooks; keep cross-store derived hooks at the
consumer.

| Old (`src/store/hooks.ts`) | New location |
|---|---|
| `useQuote` | `marketStore.ts` |
| `useFeedStatus` | `marketStore.ts` |
| `useMarketVersion` | `marketStore.ts` |
| `useHoldings` | `portfolioStore.ts` |
| `useHolding` | `portfolioStore.ts` (new) |
| `useWatchlist` | `watchlistStore.ts` |
| `useSummary` | inlined into `SummaryCard.tsx` |

Delete `src/store/hooks.ts`. Update every import.

---

## 10. Component touchpoints

| File | Change |
|---|---|
| `src/screens/WatchlistScreen.tsx` | `watchlistStore.getSymbols()` → `useWatchlist()`; `watchlistStore.remove(x)` → `watchlistStore.getState().remove(x)`; `watchlistStore.add(x)` → `watchlistStore.getState().add(x)`; import `useQuote` from `../store/marketStore` |
| `src/screens/AddSymbolScreen.tsx` | `watchlistStore.add(x)` → `watchlistStore.getState().add(x)`; import `useQuote` from `../store/marketStore` |
| `src/screens/AddSymbolRow.tsx` | import `useQuote` from `../store/marketStore` |
| `src/screens/PortfolioScreen.tsx` | `marketStore.getQuotes()` → `marketStore.getState().quotes`; import `useHoldings` from `../store/portfolioStore` and `useMarketVersion` from `../store/marketStore` |
| `src/screens/Portfolio/components/HoldingRow.tsx` | import `useQuote` from `../../../store/marketStore` |
| `src/screens/Portfolio/components/SummaryCard.tsx` | inline `useMarketVersion(250)` + `calculateSummary(holdings, marketStore.getState().quotes)` via `useMemo` |
| `src/screens/StockDetailScreen.tsx` | `portfolioStore.getHolding(symbol)` → `useHolding(symbol)`; import `useQuote` from `../store/marketStore` |
| `src/screens/StockDetail/components/PositionCard.tsx` | `portfolioStore.getHolding(symbol)` → `useHolding(symbol)`; imports from `../../../store/...` |
| `src/screens/StockDetail/components/StatGrid.tsx` | imports from `../../../store/marketStore` |
| `src/screens/StockDetail/components/PriceChart.tsx` | `marketStore.getQuote(symbol)` → `marketStore.getState().quotes.get(symbol)`; import `useMarketVersion` from `../../../store/marketStore` |
| `src/components/BuySellSheet.tsx` | `useHolding(symbol)`; `marketStore.getQuote` → `marketStore.getState().quotes.get`; `portfolioStore.applyOrder` → `portfolioStore.getState().applyOrder`; import `useQuote` from `../store/marketStore` |
| `src/components/PausedBanner.tsx` | import `useFeedStatus` from `../store/marketStore` |
| `src/bootstrap/MarketBootstrap.tsx` | see §11 |

Two bugs fixed as a side effect:

- **Watchlist swipe-delete** currently removes from the store but not from the
  rendered list, because `getSymbols()` is not a subscription. `useWatchlist()`
  fixes it.
- **Detail / BuySellSheet position** becomes reactive to trades via
  `useHolding()`.

Out of scope but nearby: `PortfolioScreen` renders `HoldingRow` without an
`onPress`, so row taps do not navigate. Not part of this migration; can be
fixed separately.

---

## 11. Bootstrap changes

`src/bootstrap/MarketBootstrap.tsx`

```ts
await Promise.all([
  portfolioStore.persist.rehydrate(),
  watchlistStore.persist.rehydrate(),
]);

const quotes = await fetchQuotes(ALLOWED_SYMBOLS);
marketStore.getState().applyBaseline(quotes);
marketStore.getState().startStatusPolling();

simulator.onTick((tick) => {
  marketStore.getState().applyTick(tick);
});
```

Refresh:

```ts
marketStore.getState().applyBaseline(quotes);
simulator.updateBaseline(quotes);
simulator.connect();
marketStore.getState().startStatusPolling();
```

Error / cleanup / background:

```ts
marketStore.getState().stopStatusPolling();
```

Remove the `feedStatusStore` import. Everything else — request IDs, mounted
guards, error state, AppState handling — stays as-is.

---

## 12. Tests

**Excluded from this migration.**

Delete the three files that import removed classes:

| File | Why it breaks |
|---|---|
| `src/__tests__/marketStore.test.ts` | imports `MarketStore` |
| `src/__tests__/portfolioStore.test.ts` | imports `PortfolioStore` |
| `src/feed/__tests__/feedStatus.test.ts` | imports `FeedStatusStore` |

Keep and do not modify:

- `src/domain/__tests__/calculations.test.ts`
- `src/domain/__tests__/money.test.ts`
- `src/domain/__tests__/orders.test.ts`
- `src/api/__tests__/liquide.test.ts`
- `src/feed/__tests__/simulator.test.ts`

Do not add or rewrite tests. `npm test` should still pass with the store tests
gone.

The simulator factory conversion (§7.1) is already covered by the existing
`src/feed/__tests__/simulator.test.ts`; it must stay green **unchanged**. That
test is the safety net for the rewrite.

> If tests were in scope later, the factories (`createPortfolioStore`,
> `createWatchlistStore`, `createMarketStore`) already support isolated
> instances. That is why factories are used instead of plain `create()`.

---

## 13. Documentation update

`README.md` currently claims:

> Custom External Stores + `useSyncExternalStore` … Why not Redux/Zustand?

That section becomes false. Replace it with:

- **Zustand vanilla stores + selectors** as the state layer.
- Per-symbol selector isolation: a tick replaces only that symbol's `Quote`, so
  untouched rows return the same reference and do not re-render.
- Honest note: all subscribed selectors are evaluated per `set`; at ~25 symbols
  this is negligible, but it is not O(1) notification like the old per-symbol
  listeners.
- Aggregates still throttled at 250 ms (summary) and 1 s (sort) via
  `useMarketVersion`.
- Persistence via `persist` + AsyncStorage; market data stays in memory.
- Update the file-structure section to list the three store files and the
  removal of `hooks.ts` and `feedStatus.ts`.
- Update the simulator section: `TickSimulator` is now an interface and
  `createTickSimulator()` the factory, but the behavioural bullets (20 ticks/s,
  partial ticks, 2% stale replay of the previous tick, 5 s pauses) stay.
- Project structure: `feed/` is `PriceFeed types + tick simulator factory`, not
  `TickSimulator, FeedStatusStore`.

Keep the money, OLDCO, and testing sections unchanged.

---

## 14. Implementation order and commits

Each step should leave `npm run typecheck` green.

1. `chore(deps): add zustand`
2. `refactor(feed): replace TickSimulator class with a factory`
3. `refactor(store): add safeStorage and legacy-format helper`
4. `refactor(store): rewrite portfolioStore with zustand persist`
5. `refactor(store): rewrite watchlistStore with zustand persist`
6. `refactor(store): rewrite marketStore and fold in feed status`
7. `refactor(store): colocate hooks and delete hooks.ts`
8. `refactor(app): update bootstrap and components to store actions`
9. `chore: remove obsolete store unit tests`
10. `docs: update architecture and state section`

Suggested checkpoints:

```bash
npm run typecheck
npm test
```

---

## 15. Manual verification

No new automated tests, so verify by running the app:

```bash
npx expo start --go
```

- [ ] App launches: loading → data, no red screen.
- [ ] ~20 ticks/sec; only the ticked row visibly updates (React DevTools
      Profiler: unrelated rows do not commit).
- [ ] Summary updates roughly every 250 ms.
- [ ] Sort order updates roughly every 1 s and stays frozen during drag.
- [ ] A stale/duplicate `seq` is ignored (the simulator still replays the
      previous tick ~2% of the time).
- [ ] A partial tick preserves `high`, `low`, and `volume`.
- [ ] Simulator emits ~20 ticks/sec; `high`/`low` change only on new extremes.
- [ ] `OLDCO` renders `—` and is excluded from totals; note is shown.
- [ ] Buy updates quantity and weighted average; Summary reconciles.
- [ ] Sell-all removes the row.
- [ ] Watchlist add works; swipe-delete removes the row immediately.
- [ ] Holdings survive a restart.
- [ ] Watchlist survives a restart.
- [ ] Upgrading from the current build keeps existing holdings/watchlist
      (legacy-format helper).
- [ ] Pull-to-refresh merges the baseline; a failure keeps current prices.
- [ ] Simulator silence shows the paused banner; resume clears it.
- [ ] Backgrounding stops polling; foregrounding restarts it.
- [ ] Light/dark theme follows the system.
- [ ] Stock detail chart and stats still update.

---

## 16. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Selector returns a new object/array each tick | Select raw state refs only |
| `Map` mutated in place → no re-render | Always `new Map(prev)` |
| Stale-tick guard lost | Keep `lastSeq` and its no-price advance; verify manually |
| `applyBaseline` resets ordering | Use `max(previousSeq, incoming.seq)` |
| Persist hydration race | `skipHydration: true` + `await rehydrate()` before render |
| Malformed stored data | `merge` + `parseHoldings` / `parseWatchlist` fallback |
| Legacy raw-array storage silently wiped | `withLegacyFormat` normaliser (§8) |
| Storage rejection blocks boot | `safeStorage` resolves to `null` / no-op |
| Status timer leak | `stopStatusPolling()` on unmount, error, background |
| Feed-status logic left in a stale module | Inline into `marketStore.ts`; delete `feedStatus.ts` |
| Simulator accidentally coupled to Zustand | Keep it store-agnostic; only `MarketBootstrap` calls `applyTick` |
| Simulator rewrite changes timing/stale behaviour | Public API unchanged; `simulator.test.ts` is kept and must stay green |
| README now inaccurate | Update in the same PR |
| Zustand/React 19 incompatibility | Use Zustand v5; verify with `npm ls zustand` |
| Test files import removed classes | Delete the three obsolete files (§12) |

---

## 17. Out of scope

- Rewriting `domain/` or `api/`.
- Persisting quotes or feed status.
- Cross-store derived selectors beyond `useSummary` (inlined).
- Fixing the missing `onPress` on Portfolio rows (separate change).
- New tests or test rewrites.
- Devtools / time-travel middleware.
