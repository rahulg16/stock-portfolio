# Stock Portfolio — App Structure & Architecture

Single source of truth for how the Stock Portfolio React Native app is built, how data flows, and how the pieces fit together. Consolidated from all planning documents (`plans/*`).

---

## 1. Goal

Build a React Native stock portfolio app that stays **correct** and **smooth** while simulated prices arrive at roughly **20 ticks per second**.

Three screens plus a buy/sell sheet:
1. Portfolio (home)
2. Watchlist
3. Stock detail
4. Buy/sell sheet

The app must demonstrate:
- **Performance:** one price tick updates only the affected rows.
- **Correctness:** integer money maths, no fake values for missing prices, stale ticks ignored, Summary reconciles with rows.
- **Structure:** feed, domain, state, and UI are separable and testable; the simulator can be replaced by a real socket.

---

## 2. Final Technical Decisions

| Decision | Choice |
|----------|--------|
| Framework | Expo SDK 58, React Native 0.88.1, React 19.3 |
| Language | TypeScript, strict mode |
| Package manager | npm |
| Navigation | React Navigation: bottom tabs + native stack + modal |
| High-frequency state | Zustand v5 vanilla stores + selectors |
| App state | Plain Zustand stores (no hand-rolled pub/sub classes) |
| List | FlatList with memoised rows |
| Chart | `react-native-svg` custom sparkline; no chart library |
| Persistence | AsyncStorage for watchlist + holdings (Zustand `persist`) |
| Swipe delete | `react-native-gesture-handler` + Reanimated |
| Tests | Jest 30, `jest-expo`, React Native Testing Library |
| E2E | Out of scope |
| Theme | System light/dark only; no manual toggle |
| App name | Stock Portfolio |
| Bundle ID | `com.rahulgangadharan.stockportfolio` |

### Core only — stretch goals excluded
- Price-cell flash on change
- Reconnect with backoff + catch-up fetch
- Limit orders
- Orders history screen
- Simulator controls / dev menu

---

## 3. Stack & Dependencies

### Runtime
- `expo`, `react`, `react-native`
- `@react-navigation/native`, `@react-navigation/native-stack`, `@react-navigation/bottom-tabs`
- `react-native-screens`, `react-native-safe-area-context`
- `@react-native-async-storage/async-storage`
- `react-native-svg`
- `react-native-gesture-handler`, `react-native-reanimated`
- `expo-status-bar`
- `zustand` (v5)

### Development
- `typescript`, `jest` (v30), `jest-expo`, `@types/jest`, `@testing-library/react-native` (v14+), `eslint` / Expo lint config

### Commands
```bash
npm install
npx expo start --go          # Expo Go development
npx expo run:ios             # Dev build (needs watchman/cocoapods/modern Ruby)
npm run typecheck            # tsc --noEmit
npm test                     # jest
npm run test:ci              # jest --ci --coverage
xcrun simctl io booted recordVideo --codec=h264 demo.mp4
```

---

## 4. Architecture

### Data flow

```
Liquide REST API
      │ one-time seed + pull-to-refresh
      ▼
  MarketStore ◄──────── ticks ──────── TickSimulator
      │ per-symbol subscriptions
      ├───────────────┬──────────────────┬─────────────────┐
      ▼               ▼                  ▼                 ▼
  HoldingRow      WatchlistRow       StockDetail        BuySellSheet
      │
      ▼
 PortfolioStore ───────────────► Summary / derived views
      │
      ▼
 AsyncStorage (holdings)

WatchlistStore ──► AsyncStorage (watchlist)
Feed status (inside MarketStore) ──► PausedBanner
```

### Layer responsibilities

| Layer | Responsibility |
|-------|----------------|
| `api/liquide.ts` | REST fetch, response validation, paise conversion |
| `feed/` | `PriceFeed` interface, simulator factory, paused status |
| `store/marketStore.ts` | Quotes, sequence guard, partial merge, per-symbol listeners, feed status |
| `store/portfolioStore.ts` | Holdings, buy/sell execution, persistence |
| `store/watchlistStore.ts` | Watchlist symbols, persistence |
| `domain/` | Pure money, P&L, summary, order and formatting logic |
| `screens/` | Screen composition and user interaction |
| `components/` | Rows, summary card, chart, sheets, banners, states |
| `shared/` | Reusable UI primitives + utils |

The UI never imports the simulator directly — only the `PriceFeed` interface.

---

## 5. Domain Model & Money Rules

### Core types

```ts
type MoneyPaise = number; // integer paise

interface Quote {
  symbol: string;
  ltpPaise: MoneyPaise;
  openPaise: MoneyPaise | null;
  prevClosePaise: MoneyPaise | null;
  highPaise: MoneyPaise | null;
  lowPaise: MoneyPaise | null;
  volume: number | null;
  seq: number;
  updatedAt: number;
}

interface Holding {
  symbol: string;
  qty: number;                 // whole shares, > 0
  avgPricePaise: MoneyPaise;
}

interface Tick {
  symbol: string;
  seq: number;
  ltp?: number;                // rupees; converted at store boundary
  high?: number;
  low?: number;
  volume?: number;
}

type OrderSide = 'BUY' | 'SELL';
```

### Money calculations (all integer paise)

```text
investedPaise    = qty * avgPricePaise
currentValuePaise = qty * ltpPaise
pnlPaise          = currentValuePaise - investedPaise
pnlPct            = pnlPaise / investedPaise * 100
dayPnlPaise       = qty * (ltpPaise - prevClosePaise)
dayPct            = (ltpPaise - prevClosePaise) / prevClosePaise * 100
```

Summary totals are sums of per-row integer paise values, so displayed totals reconcile exactly with displayed rows at rest. Percentages are computed from those integers and rounded only for display.

### Allowed symbols (25)

```
RELIANCE, TCS, HDFCBANK, INFY, ICICIBANK, SBIN, BHARTIARTL, ITC, LT,
HINDUNILVR, KOTAKBANK, AXISBANK, BAJFINANCE, MARUTI, SUNPHARMA, TITAN,
ASIANPAINT, ULTRACEMCO, WIPRO, NTPC, POWERGRID, ONGC, TATASTEEL,
ADANIENT, HCLTECH
```

### Starting holdings (bundled, first launch only)

| Symbol | Qty | Avg Price |
|--------|-----|-----------|
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

`OLDCO` is deliberately **not** in the API symbol list; it exercises the missing-price path.

### Unpriced holdings policy (`OLDCO`)

- Show `—` for last price, P&L ₹, and P&L %.
- Exclude it from current value, total invested, total P&L, total P&L %, today’s P&L, and today’s P&L %.
- Never treat it as zero.
- Display: **"Excludes 1 unpriced holding (OLDCO)."**
- Disable buy/sell for `OLDCO` because there is no last price to fill at.

If a holding has a price but no `prevClose`, it remains included in current value/P&L but excluded from day P&L with a visible note.

### Formatting

- Custom Indian grouping: `₹12,34,567.89` (lakh/crore grouping), implemented as a pure function, not locale-dependent.
- P&L values show an explicit sign: `+₹1,234.56`, `-₹1,234.56`.
- Percentages: `+1.23%`, `-0.45%`, `—`.
- Use `fontVariant: ['tabular-nums']` on price/P&L text to prevent width jitter.

---

## 6. REST API (Liquide)

```http
POST https://api.v2.liquide.life/api/markets/ohlc
content-type: application/json

{ "symbols": ["RELIANCE", "TCS", "..."] }
```

- No login.
- Success is HTTP 201; data is at `message.data`.
- Unknown symbols are silently omitted.
- Shared test server: fetch once at startup and only on pull-to-refresh. **Never poll.**
- Request all 25 symbols in one call.
- Timeout: 10 seconds via `AbortController`.
- Validate response shape before using it.
- Convert API rupee values to integer paise at the boundary.
- Missing symbol → no quote → UI shows `—`.

### Startup sequence

1. Hydrate watchlist and holdings from AsyncStorage.
2. Fetch all 25 symbols.
3. If the fetch fails or returns no usable quotes: show a blocking error state with **Retry**; do not invent prices; do not start the simulator.
4. Seed `MarketStore` with the REST baseline.
5. Connect the tick simulator.
6. Render the app.

### Pull-to-refresh

1. Fetch all 25 symbols again.
2. Merge the new baseline into `MarketStore` while keeping `lastSeq` intact.
3. Keep live ticks flowing.
4. On failure: keep existing prices, show a non-blocking error banner with Retry.
5. On success: clear the banner.

---

## 7. Tick Simulator

### Interface (`src/feed/types.ts`)

```ts
interface PriceFeed {
  connect(): void;
  disconnect(): void;
  onTick(handler: (tick: Tick) => void): () => void;
}

interface TickSimulator extends PriceFeed {
  updateBaseline(quotes: readonly Quote[]): void;
}
```

The simulator is a separate module that behaves like a socket client. Screens cannot tell it is fake.

### Behaviour

- One tick every **50 ms** → approximately **20 ticks/second globally**.
- Each tick targets one randomly selected symbol.
- `ltp` moves by up to **±0.2%**.
- `high` and `low` update only when the new price makes a new running extreme.
- `volume` increases occasionally.
- Ticks are **partial**: only changed fields are present.
- `seq` increments per symbol for every new tick.
- About **2% of emitted ticks are stale** — a previously cached tick is emitted after a newer one. The store ignores it by `seq`.
- Roughly once every **60–90 seconds**, emission stops for **5 seconds**, then resumes. This drives the paused indicator.
- Injectable RNG and clock make tests deterministic.

### Replace with a real socket

Implement `PriceFeed` and swap it in at bootstrap (`MarketBootstrap.tsx`). The simulator is store-agnostic; only `MarketBootstrap` calls `applyTick`.

---

## 8. Market Store (`src/store/marketStore.ts`)

### State shape

```ts
interface MarketState {
  quotes: ReadonlyMap<string, Quote>;
  lastSeq: Record<string, number>;
  lastTickAt: number;
  status: FeedStatus; // 'connecting' | 'live' | 'paused' | 'stale'

  applyTick: (tick: Tick) => boolean;
  applyBaseline: (baseline: readonly Quote[]) => void;
  startStatusPolling: () => void;
  stopStatusPolling: () => void;
}
```

Created with `createStore` from `zustand/vanilla`, consumed with `useStore`. Exported as a singleton plus a `createMarketStore()` factory so tests get isolated instances.

### Fields

| Field | Purpose |
|-------|---------|
| `quotes` | Single renderable price state; `useQuote(symbol)` selects `quotes.get(symbol)` |
| `lastSeq` | Per-symbol high-water mark of accepted ticks — the correctness guard |
| `lastTickAt` | Timestamp of last successful tick; sole input to feed-status computation |
| `status` | Feed health: `connecting` \| `live` \| `paused` \| `stale` |

### Actions

- **`applyTick(tick)`** — the single write path for live data:
  1. Validate `symbol` and `seq`.
  2. Apply per-symbol stale guard against `lastSeq` (drop if `tick.seq <= lastSeq[symbol]`).
  3. Partial merge — absent `high`/`low`/`volume` keep previous values; convert rupees to paise once at this boundary.
  4. Replace only the ticked symbol's `Quote` object (`new Map(prev)` then `.set()`).
  5. Bump `lastTickAt`, advance `lastSeq`, notify only that symbol's listeners.
- **`applyBaseline(baseline)`** — the single write path for REST snapshots; takes `max(previousSeq, incoming.seq)` and does **not** touch `lastTickAt`.
- **`startStatusPolling()`** — idempotent 500 ms status evaluation; sets `connecting`, runs immediately.
- **`stopStatusPolling()`** — clears timer, resets to `connecting`.

### Re-render strategy (why it stays fast)

- A RELIANCE tick re-renders only RELIANCE subscribers: RELIANCE holding row, RELIANCE watchlist row (if present), open RELIANCE detail screen.
- Portfolio screen, list container, Summary, and other rows do **not** re-render on every tick.
- The list data (symbols and holdings metadata) changes only on trade, filter change, or sort tick.
- Rows are `React.memo`ised with stable keys and fixed height.
- FlatList uses `keyExtractor`, `getItemLayout`, and modest windowing.

### Aggregates & hooks

| Hook | Purpose |
|------|---------|
| `useQuote(symbol)` | Per-symbol quote; only that row re-renders on its tick |
| `useFeedStatus()` | Feed status read by `PausedBanner` |
| `useMarketVersion(250)` | Coalesced aggregate notification for `SummaryCard` |
| `useMarketVersion(1000)` | Sort order recompute (frozen during active drag) |

### Deliberately not in state

`timer`, `startedAt` (non-renderable internals kept in closure), `quotesVersion` (Map identity already signals updates), `hydrated` (market data is not persisted).

---

## 9. Portfolio Store (`src/store/portfolioStore.ts`)

### State shape

```ts
interface PortfolioState {
  holdings: Holding[];
  applyOrder: (symbol, side, qty, fillPricePaise) => void;
}
```

Created via `createPortfolioStore(storage = AsyncStorage)` using Zustand `persist` middleware:
- Storage key: `stockportfolio.holdings.v1`
- `skipHydration: true`, `partialize: (state) => ({ holdings: state.holdings })`
- `merge` validates stored shape; falls back to `createStartingHoldings()` on malformed data.
- `safeStorage` wrapper makes AsyncStorage best-effort (never blocks boot).
- `withLegacyFormat` normalises pre-migration bare-array storage into Zustand envelopes on read.

### Hooks

- `useHoldings()` → `readonly Holding[]`
- `useHolding(symbol)` → `Holding | undefined` (new; makes Detail/BuySellSheet reactive to trades)

### Orders (`src/domain/orders.ts`)

Pure functions: `validateOrder` and `executeOrder`.

Rules:
- **Buy — new position:** `avgPricePaise = fillPricePaise`.
- **Buy — existing:** `newAvg = round((oldQty * oldAvg + qty * fillPrice) / (oldQty + qty))`.
- **Sell:** average price unchanged; quantity decreases; selling full quantity removes the holding.
- Buy/sell disabled when the symbol has no quote.
- Orders are local only; no network call.
- Summary is derived from holdings + quotes, so it stays consistent automatically.

---

## 10. Watchlist Store (`src/store/watchlistStore.ts`)

### State shape

```ts
interface WatchlistState {
  symbols: string[];
  add: (symbol: string) => boolean;
  remove: (symbol: string) => void;
}
```

- Storage key: `stockportfolio.watchlist.v1`
- Defaults to `[]`; persisted after every add/remove (fire-and-forget).
- `add` returns `false` for duplicates or non-allowed symbols without calling `set` (no needless notification).
- `useWatchlist()` → `readonly string[]`

### Watchlist screen features

- Header with **+** action → opens Add Symbol Sheet.
- Rows: symbol, live LTP, day change ₹/% (`—` if missing).
- Tap row → push StockDetailScreen.
- Swipe left → Delete → removes symbol, persists immediately.
- Add Symbol Sheet: shows all 25 allowed symbols with live LTP via `useQuote`; already-added symbols disabled/greyed with checkmark.
- Empty state: "No symbols yet" + "Add symbol" button.
- Persisted across app restart; hydrates in `MarketBootstrap` before render.

---

## 11. Screens

### Portfolio (home)

- Safe-area screen with header; global paused banner.
- **Summary card:** current value, total invested, total P&L (₹ and %), today’s P&L (₹ and %), caption for unpriced holdings.
- Controls: sort (Name / Value / P&L), search input filtering by symbol (case-insensitive).
- **Holdings list:** symbol, quantity, average price, last price, P&L ₹ and %; green gain / red loss; tap row → Stock detail.
- Pull-to-refresh (RefreshControl) + non-blocking refresh error banner.
- States: loading, empty (sold everything), error (initial API failure with Retry), paused (global banner).

### Watchlist

- Header with Add action; paused banner.
- Rows: symbol, last price, day change ₹ and %.
- Tap row → Stock detail.
- Swipe left → remove.
- Add sheet: all 25 symbols, already-added disabled, tap to add.
- Persist symbol array in AsyncStorage.
- Empty state with “Add symbol”.
- Missing quote → `—`.
- Global paused banner.

### Stock detail

- Header with back navigation; paused banner.
- Hero: large last price and day change (`—` if no quote).
- Stats grid (2×3): Open, High, Low, Previous Close, Volume, Updated — all live, `—` when missing.
- Position card when held: quantity, average price, invested, current value, P&L ₹ and %.
- SVG line chart (`PriceChart.tsx`) of `ltp` ticks since screen opened; empty state “No ticks yet”; capped at 600 points; buffer updates via ref, re-renders at 250 ms cadence.
- Buy/Sell action; disabled when no price.
- Global paused banner.

### Buy/sell sheet

- Modal sheet from Stock detail; grabber handle, drag-to-dismiss.
- Buy/Sell segmented control; default Buy.
- Quantity input (numeric keyboard) with real-time validation: integer > 0; Sell ≤ held quantity.
- Live estimated value: `qty × ltpPaise`, updates on qty change and LTP ticks.
- Confirm disabled until valid; executes at current LTP via `portfolioStore.applyOrder`, persists, dismisses.
- All screens update automatically via store subscriptions.

### Global UI

- System light/dark theme via `ThemeProvider`; navigation theme + status bar style.
- Paused banner on every screen.
- Loading/empty/error states with retry.
- No manual theme toggle.

---

## 12. Persistence

Keys:
- `stockportfolio.watchlist.v1`
- `stockportfolio.holdings.v1`

Rules:
- Watchlist defaults to `[]`.
- Holdings default to the bundled starting holdings **on first launch only**.
- Validate stored shapes; fall back to defaults if malformed.
- Hydrate before rendering the main app (`skipHydration: true` + `await rehydrate()`).
- Persist after every change; persistence failure must not block the UI.
- Clearing app data restores watchlist empty and the starting holdings.
- No order history persistence.

---

## 13. Project Structure (actual)

```
stock-portfolio/
├── App.tsx
├── agent.md
├── README.md
├── app.json
├── babel.config.js
├── index.ts
├── jest.config.js
├── jest.setup.ts
├── package.json
├── package-lock.json
├── tsconfig.json
├── demo.mp4 (gitignored)
├── ios/ (native project, gitignored)
├── assets/
│   ├── icon.png, favicon.png, splash-icon.png
│   └── android-icon-*.png
├── src/
│   ├── api/
│   │   ├── liquide.ts              # REST client, validation, paise conversion
│   │   └── __tests__/liquide.test.ts
│   ├── domain/
│   │   ├── types.ts                # Quote, Holding, Tick, OrderSide, MoneyPaise
│   │   ├── seed.ts                 # ALLOWED_SYMBOLS + createStartingHoldings
│   │   ├── money.ts                # paise conversion, Indian INR formatter
│   │   ├── calculations.ts         # holding P&L, day P&L, summary
│   │   ├── orders.ts               # validateOrder, executeOrder (pure)
│   │   └── __tests__/
│   │       ├── money.test.ts
│   │       ├── calculations.test.ts
│   │       └── orders.test.ts
│   ├── feed/
│   │   ├── types.ts                # PriceFeed interface
│   │   ├── simulator.ts            # createTickSimulator() factory (closure, no class)
│   │   └── __tests__/simulator.test.ts
│   ├── store/
│   │   ├── marketStore.ts          # quotes, lastSeq, lastTickAt, feed status, applyTick/applyBaseline, hooks
│   │   ├── portfolioStore.ts       # holdings, applyOrder, persistence, useHoldings/useHolding
│   │   ├── watchlistStore.ts       # symbols, add/remove, persistence, useWatchlist
│   │   └── storage.ts              # safeStorage + withLegacyFormat normaliser
│   ├── theme/
│   │   ├── ThemeProvider.tsx       # system light/dark
│   │   ├── themes.ts               # color/surface/token definitions
│   │   └── types.ts
│   ├── navigation/
│   │   └── RootNavigator.tsx       # bottom tabs + native stack + modal
│   ├── bootstrap/
│   │   └── MarketBootstrap.tsx     # hydrate → REST baseline → connect simulator
│   ├── screens/
│   │   ├── PortfolioScreen.tsx
│   │   ├── WatchlistScreen.tsx
│   │   ├── StockDetailScreen.tsx
│   │   ├── AddSymbolSheet.tsx
│   │   ├── Portfolio/components/HoldingRow.tsx
│   │   ├── Portfolio/components/SummaryCard.tsx
│   │   ├── WatchlistScreen.tsx (inline rows)
│   │   ├── StockDetail/components/PriceChart.tsx
│   │   ├── StockDetail/components/PositionCard.tsx
│   │   └── StockDetail/components/StatGrid.tsx
│   ├── components/
│   │   ├── BuySellSheet.tsx
│   │   ├── PausedBanner.tsx
│   │   ├── ErrorView.tsx
│   │   ├── LoadingView.tsx
│   │   ├── EmptyView.tsx
│   │   └── shared/ui/              # Button, SegmentedControl, NumericInput, ModalSheet, ListRow, StatItem, Chip, Divider
│   └── shared/
│       └── utils/
│           ├── format.ts           # fmtINR, fmtPct
│           └── validation.ts
└── node_modules/ (gitignored)
```

---

## 14. Build Milestones (completed)

1. Scaffold — Expo TypeScript app, dependencies, strict TS, git init.
2. Domain layer — types, seed, paise money helpers, Indian formatter, P&L/summary/watchlist calculations, order validation/execution.
3. Domain tests — money, calculations, orders.
4. Market store — per-symbol listeners, partial merge, sequence guard, hooks, feed status.
5. API + simulator — REST client with validation/timeout, tick simulator with injectable RNG/clock.
6. App shell — theme provider, navigation, tabs, modals, paused banner, loading/error/empty views.
7. Portfolio — Summary card, holdings rows, sort, filter, pull-to-refresh.
8. Watchlist — Add sheet, swipe delete, AsyncStorage persistence.
9. Stock detail — live stats, position card, SVG tick chart.
10. Buy/sell — Sheet, validation, live estimate, execution, persistence.
11. QA + README + recording — profiler check, README, screen recording.

---

## 15. Testing

### Configuration
- `jest-expo` preset, Jest 30.
- `@testing-library/react-native` v14+.
- `jest.setup.ts` for AsyncStorage, gesture-handler, Reanimated mocks.
- `transformIgnorePatterns` for Expo/RN/navigation/SVG/gesture-handler/Reanimated/AsyncStorage.

### Test files
| File | Coverage |
|------|----------|
| `money.test.ts` | Paise conversion, Indian grouping, negative/zero values |
| `calculations.test.ts` | Holding P&L, day P&L, summary, unpriced exclusion, percentages |
| `orders.test.ts` | Weighted average, partial sell, sell-all removal, oversell, non-integer, missing price |
| `simulator.test.ts` | ~20 ticks/s, partial fields, stale ticks, 5-second silence, resume |
| `liquide.test.ts` | REST client validation |

### Commands
```bash
npm test
npm run test:watch
npm run test:ci     # jest --ci --coverage
npm run typecheck   # tsc --noEmit
```

Coverage target: `src/domain` at 100%; `src/store` and `src/feed` high; UI has no blanket coverage target.

---

## 16. QA Checklist

- App launches on iPhone 17 simulator (Expo Go).
- Initial API load shows loading, then data.
- API failure shows error + Retry; Retry recovers.
- Pull-to-refresh updates prices; failure keeps stale data + banner.
- Rows update live at ~20 ticks/s total.
- Scrolling remains smooth under ticks.
- Profiler shows only affected rows re-rendering.
- Late/out-of-order ticks are ignored.
- Partial ticks do not erase unchanged fields.
- 5-second silence triggers “Prices paused”; resumes correctly.
- `OLDCO` shows `—` and is excluded from Summary with a caption.
- Summary totals equal the sum of displayed row values.
- Sort by name/value/P&L works; filter works.
- Buy updates quantity and weighted average.
- Sell rejects overselling and updates quantity.
- Sell-all removes the row.
- Trading `OLDCO` is disabled.
- Watchlist add/remove works and survives restart.
- Holdings survive restart.
- Light and dark themes follow the system.
- INR formatting uses lakh/crore grouping.
- Empty states for portfolio and watchlist.
- Buy/sell estimated value uses the live price.

### Profiler verification
1. Open React DevTools Profiler; start recording; scroll Portfolio while ticks flow.
2. Verify only the ticked symbol's `HoldingRow` commits; `FlatList`/other rows/PortfolioScreen do not commit; `SummaryCard` commits at ~250 ms cadence; sort container commits at ~1 s cadence (not during drag).

---

## 17. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| CocoaPods/Ruby blocks dev build | Use Expo Go for development; install modern Ruby/CocoaPods later; SwiftPM preview as fallback |
| Selector returns new object each tick | Select raw state refs only |
| `Map` mutated in place → no re-render | Always `new Map(prev)` |
| Stale-tick guard lost | Keep `lastSeq` and its no-price advance |
| `applyBaseline` resets ordering | Use `max(previousSeq, incoming.seq)` |
| Persistence hydration race | `skipHydration: true` + `await rehydrate()` before render |
| Malformed stored data | `merge` + fallback parsers |
| Legacy raw-array storage wiped | `withLegacyFormat` normaliser |
| Storage rejection blocks boot | `safeStorage` resolves to `null` / no-op |
| Status timer leak | `stopStatusPolling()` on unmount, error, background |
| Simulator coupled to Zustand | Keep store-agnostic; only `MarketBootstrap` calls `applyTick` |

---

## 18. Definition of Done

- All three screens and the buy/sell sheet work end to end.
- Prices tick smoothly at ~20 ticks/s without list-wide re-renders.
- P&L, averages, day changes, and Summary are correct and reconcile.
- `OLDCO` is displayed and excluded per policy.
- Late and partial ticks behave correctly.
- Loading, empty, error/retry, and paused states exist on every screen.
- Light/dark mode and Indian formatting work.
- Watchlist and holdings persist across restart.
- Domain/store/feed tests pass.
- README and screen recording are ready.

---

## 19. README Requirements (covered)

The `README.md` at repo root covers:
1. How to install and run (Expo Go and dev build).
2. Tested platform: iOS Simulator, iPhone 17, Expo SDK 58, RN 0.88.1.
3. State and re-render approach, and why (Zustand stores + per-symbol selectors).
4. Money rounding and how Summary reconciles with rows (integer paise; totals = sum of rows).
5. How Summary handles the unpriced `OLDCO` holding.
6. Simulator/feed behaviour and how to replace it with a real socket.
7. What was skipped and what would be done next (stretch goals).
8. Rough time spent (~10 hours).
9. Test commands and what they cover.
