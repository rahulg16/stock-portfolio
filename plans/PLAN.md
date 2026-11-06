# Stock Portfolio — Final Implementation Plan

**Status:** Ready to build — core scope only  
**Project root:** `/Users/rahulgangadharan/Desktop/projects/react-native-projects/stock-portfolio`  
**Brief:** `stock-portfolio/plans/BRIEF.md`  
**Date:** 2026-11-05

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

## 2. Final decisions

| Decision | Choice |
|---|---|
| Framework | Expo SDK 58, React Native 0.88.1, React 19.3 |
| Language | TypeScript, strict mode |
| Package manager | npm |
| Test platform | iOS Simulator — iPhone 17 |
| Navigation | React Navigation: bottom tabs + native stack + modal |
| High-frequency state | Custom external stores + `useSyncExternalStore` |
| App state | Plain external stores; no Zustand/Redux |
| List | FlatList with memoised rows |
| Chart | `react-native-svg` custom sparkline; no chart library |
| Persistence | AsyncStorage for watchlist + holdings |
| Swipe delete | `react-native-gesture-handler` + Reanimated |
| Tests | Jest 30, `jest-expo`, React Native Testing Library |
| E2E | Out of scope |
| Theme | System light/dark only; no manual toggle |
| Watchlist seed | Empty |
| Aggregate cadence | Summary 250 ms; value/P&L sort order 1 s |
| Unpriced holding policy | Exclude `OLDCO` from money totals; show it with `—`; display an exclusion note |
| Trading an unpriced symbol | Disabled |
| Sell-all behaviour | Remove the holding row |
| Git | Local repo, incremental commits (not squashed) |
| App name | Stock Portfolio |
| Bundle ID | `com.rahulgangadharan.stockportfolio` |

### Core only — stretch goals explicitly excluded

- Price-cell flash on change
- Reconnect with backoff + catch-up fetch
- Limit orders
- Orders history screen
- Simulator controls / dev menu

---

## 3. Stack and dependencies

### Runtime

- `expo`
- `react`, `react-native`
- `@react-navigation/native`
- `@react-navigation/native-stack`
- `@react-navigation/bottom-tabs`
- `react-native-screens`
- `react-native-safe-area-context`
- `@react-native-async-storage/async-storage`
- `react-native-svg`
- `react-native-gesture-handler`
- `react-native-reanimated`
- `expo-status-bar`

### Development

- `typescript`
- `jest` (v30)
- `jest-expo`
- `@types/jest`
- `@testing-library/react-native` (v14+)
- `eslint` / Expo lint config

### Commands

```bash
# Scaffold
npx create-expo-app@latest <temp-dir> --template blank-typescript --no-agents-md

# Add native-compatible packages
npx expo install react-native-screens react-native-safe-area-context \
  @react-native-async-storage/async-storage react-native-svg \
  react-native-gesture-handler react-native-reanimated

# Add JS-only navigation packages
npm install @react-navigation/native @react-navigation/native-stack \
  @react-navigation/bottom-tabs

# Tests
npx expo install jest-expo jest @types/jest --dev
npx expo install @testing-library/react-native --dev

# Validate versions
npx expo install --check
```

---

## 4. Architecture

```text
Liquide REST API
      │
      │ one-time seed + pull-to-refresh
      ▼
  MarketStore ◄──────── ticks ──────── TickSimulator
      │                                   (PriceFeed interface)
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
 FeedStatusStore ──► paused banner
```

### Layer responsibilities

| Layer | Responsibility |
|---|---|
| `api/liquide.ts` | REST fetch, response validation, paise conversion |
| `feed/` | `PriceFeed` interface, simulator, paused status |
| `store/marketStore.ts` | Quotes, sequence guard, partial merge, per-symbol listeners |
| `store/portfolioStore.ts` | Holdings, buy/sell execution, persistence |
| `store/watchlistStore.ts` | Watchlist symbols, persistence |
| `domain/` | Pure money, P&L, summary, order and formatting logic |
| `screens/` | Screen composition and user interaction |
| `components/` | Rows, summary card, chart, sheets, banners, states |

The UI never imports the simulator directly — only the `PriceFeed` interface.

---

## 5. Domain model and money rules

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
  ltp?: number;                // rupees, per brief; converted at store boundary
  high?: number;
  low?: number;
  volume?: number;
}

type OrderSide = 'BUY' | 'SELL';
```

### Seed data

**Allowed symbols (25):**

```text
RELIANCE, TCS, HDFCBANK, INFY, ICICIBANK, SBIN, BHARTIARTL, ITC, LT,
HINDUNILVR, KOTAKBANK, AXISBANK, BAJFINANCE, MARUTI, SUNPHARMA, TITAN,
ASIANPAINT, ULTRACEMCO, WIPRO, NTPC, POWERGRID, ONGC, TATASTEEL,
ADANIENT, HCLTECH
```

**Starting holdings (bundled, first launch only):**

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

`OLDCO` is deliberately not in the API symbol list; it exercises the missing-price path.

### Money rules

All money is stored and calculated as **integer paise**.

```text
investedPaise    = qty * avgPricePaise
currentValuePaise = qty * ltpPaise
pnlPaise          = currentValuePaise - investedPaise
pnlPct            = pnlPaise / investedPaise * 100
dayPnlPaise       = qty * (ltpPaise - prevClosePaise)
dayPct            = (ltpPaise - prevClosePaise) / prevClosePaise * 100
```

Summary totals are sums of the **per-row integer paise values**, so the displayed totals reconcile exactly with the displayed rows at rest. Percentages are computed from those same integers and rounded only for display.

### Unpriced holdings (`OLDCO`)

`OLDCO` is deliberately absent from the API.

- Show `—` for last price, P&L ₹, and P&L %.
- Exclude it from current value, total invested, total P&L, total P&L %, today’s P&L, and today’s P&L %.
- Never treat it as zero.
- Display: **“Excludes 1 unpriced holding (OLDCO).”**
- Disable buy/sell for `OLDCO` because there is no last price to fill at.

If a holding has a price but no `prevClose`, it remains included in current value/P&L, but is excluded from day P&L with a visible note.

### Formatting

- Custom Indian grouping: `₹12,34,567.89`.
- Implemented as a pure function and unit-tested; not dependent on device locale data.
- P&L values show an explicit sign: `+₹1,234.56`, `-₹1,234.56`.
- Percentages: `+1.23%`, `-0.45%`, `—`.
- Use `fontVariant: ['tabular-nums']` on price/P&L text to prevent width jitter.

---

## 6. REST API

```http
POST https://api.v2.liquide.life/api/markets/ohlc
content-type: application/json

{ "symbols": ["RELIANCE", "TCS", "..."] }
```

- No login.
- Success is HTTP 201; data is at `message.data`.
- Unknown symbols are silently omitted.
- Shared test server: fetch once at startup and only on pull-to-refresh. Never poll.
- Request all **25 symbols** in one call.
- Timeout: 10 seconds via `AbortController`.
- Validate the response shape before using it.
- Convert API rupee values to integer paise at the boundary.
- Missing symbol → no quote → UI shows `—`.

### Startup sequence

1. Hydrate watchlist and holdings from AsyncStorage.
2. Fetch all 25 symbols.
3. If the fetch fails or returns no usable quotes:
   - show a blocking error state with **Retry**;
   - do not invent prices;
   - do not start the simulator.
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

## 7. Tick simulator

### Interface

```ts
interface PriceFeed {
  connect(): void;
  disconnect(): void;
  onTick(handler: (tick: Tick) => void): () => void;
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
- About **2% of emitted ticks are stale** — a previously cached tick is emitted after a newer one. The store must ignore it by `seq`.
- Roughly once every **60–90 seconds**, emission stops for **5 seconds**, then resumes. This drives the paused indicator.
- Injectable RNG and clock make tests deterministic.

---

## 8. Market store and re-render strategy

### MarketStore

- `Map<symbol, Quote>`.
- `lastSeq: Map<symbol, number>`.
- Per-symbol listener sets.
- `applyTick(tick)`:
  1. Drop if `tick.seq <= lastSeq[symbol]`.
  2. Merge only present fields; convert rupee fields to paise.
  3. Replace only that symbol’s `Quote` object.
  4. Notify only that symbol’s listeners.
- `useQuote(symbol)` uses `useSyncExternalStore` and returns the stable quote object.

### Why this stays fast

- A RELIANCE tick re-renders only RELIANCE subscribers:
  - RELIANCE holding row
  - RELIANCE watchlist row (if present)
  - an open RELIANCE detail screen
- The Portfolio screen, list container, Summary, and other rows do **not** re-render on every tick.
- The list data (symbols and holdings metadata) changes only on trade, filter change, or sort tick.
- Rows are `React.memo`ised with stable keys and fixed height.
- FlatList uses `keyExtractor`, `getItemLayout`, and modest windowing settings.

### Aggregates

- Summary subscribes to a coalesced aggregate notification at **250 ms**.
- Value/P&L sort order recomputes at **1 s** and does not reorder during an active drag; it applies after the gesture settles.
- Sort/filter changes apply immediately.
- Chart buffers at most **600** points per detail screen.
- Feed status notifies only on paused/active transitions, not on every tick.

### Manual verification

Use React DevTools Profiler while ticking and scrolling:

- Only the ticked symbol’s row should commit.
- The list container and unrelated rows should stay committed-free.
- Summary and sort container may commit at their throttled cadence.

---

## 9. Screens

### Portfolio (home)

- Safe-area screen with header.
- Global paused banner.
- **Summary card**
  - Current value
  - Total invested
  - Total P&L (₹ and %)
  - Today’s P&L (₹ and %)
  - Caption for unpriced holdings
- **Controls**
  - Sort: Name / Value / P&L
  - Search input filtering by symbol, case-insensitive
- **Holdings list**
  - Symbol, quantity, average price, last price, P&L ₹ and %
  - Green gain, red loss
  - Tap row → Stock detail
- **Pull-to-refresh**
  - RefreshControl
  - Non-blocking refresh error banner
- **States**
  - Loading: spinner/skeleton while hydrating + initial API call
  - Empty: no holdings after selling everything
  - Error: initial API failure with Retry
  - Paused: global banner

### Watchlist

- Header with Add action.
- Rows: symbol, last price, day change ₹ and %.
- Tap row → Stock detail.
- Swipe left → remove.
- Add sheet: all 25 symbols, already-added entries disabled, tap to add.
- Persist symbol array in AsyncStorage.
- Empty state with “Add symbol”.
- Missing quote → `—`.
- Global paused banner.

### Stock detail

- Header with back navigation.
- Large last price and day change.
- Stats grid: open, high, low, previous close, volume — all live, `—` when missing.
- Position card when held: quantity, average price, invested, current value, P&L.
- SVG line chart of `ltp` ticks since the screen opened; empty state “No ticks yet”.
- Buy/Sell action; disabled when no price.
- Global paused banner.

### Buy/sell sheet

- Modal sheet from Stock detail.
- Buy/Sell segmented control.
- Quantity input (numeric keyboard).
- Live estimated value at the current `ltp`.
- Sell shows available quantity and rejects overselling.
- Validation:
  - integer
  - greater than zero
  - not more than held when selling
  - price must exist
- Confirm disabled until valid.
- On confirm:
  1. Read the latest quote.
  2. Execute the order.
  3. Update and persist holdings.
  4. Close the sheet.
  5. Detail, Portfolio rows, and Summary update from the same store.

### Global UI

- System light/dark theme.
- Theme provider for colors, surfaces, text, gain/loss, muted text.
- Navigation theme + status bar style.
- Paused banner on every screen.
- Loading/empty/error states with retry.
- No manual theme toggle.

---

## 10. Orders

Pure functions in `src/domain/orders.ts`.

```ts
validateOrder(holding, side, qty, hasPrice) => Result
executeOrder(holdings, symbol, side, qty, fillPricePaise) => Holdings
```

Rules:

- **Buy**
  - New position: `avgPricePaise = fillPricePaise`.
  - Existing position:
    ```text
    newAvg = round((oldQty * oldAvg + qty * fillPrice) / (oldQty + qty))
    ```
- **Sell**
  - Average price unchanged.
  - Quantity decreases.
- Selling the full quantity removes the holding.
- Buy/sell is disabled when the symbol has no quote.
- Orders are local only; no network call.
- Summary is derived from holdings + quotes, so it stays consistent automatically.
- No order history (stretch).

---

## 11. Persistence

Keys:

- `stockportfolio.watchlist.v1`
- `stockportfolio.holdings.v1`

Rules:

- Watchlist defaults to `[]`.
- Holdings default to the bundled starting holdings **on first launch only**.
- Validate stored shapes; fall back to defaults if malformed.
- Hydrate before rendering the main app.
- Persist after every change; persistence failure must not block the UI.
- Clearing app data restores watchlist empty and the starting holdings.
- No order history persistence.

---

## 12. Project structure

```text
stock-portfolio/
├── App.tsx
├── plans/
│   ├── BRIEF.md
│   └── PLAN.md
├── README.md
├── app.json
├── package.json
├── tsconfig.json
├── jest.setup.ts
├── src/
│   ├── api/
│   │   └── liquide.ts
│   ├── domain/
│   │   ├── types.ts
│   │   ├── seed.ts
│   │   ├── money.ts
│   │   ├── calculations.ts
│   │   ├── orders.ts
│   │   └── __tests__/
│   ├── feed/
│   │   ├── types.ts
│   │   ├── simulator.ts
│   │   └── feedStatus.ts
│   ├── store/
│   │   ├── marketStore.ts
│   │   ├── portfolioStore.ts
│   │   ├── watchlistStore.ts
│   │   └── hooks.ts
│   ├── theme/
│   │   ├── ThemeProvider.tsx
│   │   └── themes.ts
│   ├── navigation/
│   │   └── RootNavigator.tsx
│   ├── screens/
│   │   ├── PortfolioScreen.tsx
│   │   ├── WatchlistScreen.tsx
│   │   └── StockDetailScreen.tsx
│   ├── components/
│   │   ├── SummaryCard.tsx
│   │   ├── HoldingRow.tsx
│   │   ├── WatchlistRow.tsx
│   │   ├── AddSymbolSheet.tsx
│   │   ├── BuySellSheet.tsx
│   │   ├── PriceChart.tsx
│   │   ├── PausedBanner.tsx
│   │   ├── ErrorView.tsx
│   │   └── EmptyView.tsx
│   └── __tests__/
│       ├── marketStore.test.ts
│       └── simulator.test.ts
└── assets/ (default Expo assets)
```

---

## 13. Build milestones

Each milestone ends with a coherent commit.

1. **Scaffold**
   - Create Expo TypeScript app while preserving `BRIEF.md`.
   - Install dependencies.
   - Enable strict TypeScript.
   - `git init`.
   - Commit: `chore: scaffold Expo TypeScript app`.

2. **Domain layer**
   - Types, seed symbols/holdings, paise money helpers, Indian formatter.
   - P&L, summary, watchlist calculations.
   - Order validation and execution.
   - Commit: `feat: domain model and money calculations`.

3. **Domain tests**
   - `money.test.ts`, `calculations.test.ts`, `orders.test.ts`.
   - Commit: `test: cover money, P&L and order calculations`.

4. **Market store**
   - Per-symbol listeners, partial merge, sequence guard.
   - Hooks for `useQuote`, aggregate snapshot, feed status.
   - Commit: `feat: market store with per-symbol subscriptions`.

5. **API + simulator**
   - REST client with validation and timeout.
   - Tick simulator with injectable RNG/clock.
   - Store/simulator tests.
   - Commit: `feat: REST seed and tick simulator`.

6. **App shell**
   - Theme provider, navigation, tabs, modals.
   - Paused banner, loading/error/empty views.
   - Commit: `feat: app shell, theme and navigation`.

7. **Portfolio**
   - Summary card, holdings rows, sort, filter, pull-to-refresh.
   - Commit: `feat: portfolio screen`.

8. **Watchlist**
   - Add sheet, swipe delete, AsyncStorage persistence.
   - Commit: `feat: watchlist with persistence`.

9. **Stock detail**
   - Live stats, position card, SVG tick chart.
   - Commit: `feat: stock detail and tick chart`.

10. **Buy/sell**
    - Sheet, validation, live estimate, execution, persistence.
    - Commit: `feat: buy/sell sheet`.

11. **QA + README + recording**
    - Dark/light, states, error/retry, paused, profiler check.
    - README sections.
    - Screen recording.
    - Commit: `docs: README and submission notes`.

---

## 14. Testing

### Configuration

- `jest-expo` preset, Jest 30.
- `@testing-library/react-native` v14+.
- `jest.setup.ts` for AsyncStorage, gesture-handler, Reanimated mocks.
- `transformIgnorePatterns` for Expo/RN/navigation/SVG/gesture-handler/Reanimated/AsyncStorage.
- `tsconfig` includes `jest` types.

### Test files

| File | Coverage |
|---|---|
| `money.test.ts` | Paise conversion, Indian grouping, negative/zero values |
| `calculations.test.ts` | Holding P&L, day P&L, summary, unpriced exclusion, percentages |
| `orders.test.ts` | Weighted average, partial sell, sell-all removal, oversell, non-integer, missing price |
| `marketStore.test.ts` | Stale seq ignored, partial merge, per-symbol notification isolation |
| `simulator.test.ts` | ~20 ticks/s, partial fields, stale ticks, 5-second silence, resume |
| `useQuote.test.tsx` (optional) | Only the ticked symbol’s component re-renders |
| `BuySellSheet.test.tsx` (optional) | Validation and confirm behaviour |

### Commands

```bash
npm test
npm run test:watch
npm run test:ci        # jest --ci --coverage
npm run typecheck      # tsc --noEmit
```

### Coverage target

- `src/domain`: 100%.
- `src/store`, `src/feed`: high.
- UI: no blanket coverage target.

### Not covered by Jest

- Real scroll FPS.
- Native gesture rendering.
- Device memory/CPU.
- Real network.

These are verified on the simulator with React DevTools Profiler and manual QA.

---

## 15. QA checklist

- [ ] App launches on iPhone 17 simulator.
- [ ] Initial API load shows loading, then data.
- [ ] API failure shows error + Retry, and Retry recovers.
- [ ] Pull-to-refresh updates prices; failure keeps stale data + banner.
- [ ] Rows update live at ~20 ticks/s total.
- [ ] Scrolling remains smooth under ticks.
- [ ] Profiler shows only affected rows re-rendering.
- [ ] Late/out-of-order ticks are ignored.
- [ ] Partial ticks do not erase unchanged fields.
- [ ] 5-second silence triggers “Prices paused”, resumes correctly.
- [ ] `OLDCO` shows `—` and is excluded from Summary with a caption.
- [ ] Summary totals equal the sum of displayed row values.
- [ ] Sort by name/value/P&L works; filter works.
- [ ] Buy updates quantity and weighted average.
- [ ] Sell rejects overselling and updates quantity.
- [ ] Sell-all removes the row.
- [ ] Trading `OLDCO` is disabled.
- [ ] Watchlist add/remove works and survives restart.
- [ ] Holdings survive restart.
- [ ] Light and dark themes follow the system.
- [ ] INR formatting uses lakh/crore grouping.
- [ ] Empty states for portfolio and watchlist.
- [ ] Buy/sell estimated value uses the live price.
- [ ] Screen recording captured.

---

## 16. Environment and run commands

### Current machine

- Node 26.8.2
- npm 11.19.1
- Xcode 27.2
- iPhone 17 simulator available
- Homebrew available
- CocoaPods: not installed
- Watchman: not installed
- System Ruby 2.6.10 (too old for current CocoaPods)

### Expo Go path — no native build

```bash
npm install
npx expo start --go
# press i, or Shift+I to choose the iPhone 17 simulator
```

This is enough for development, manual QA, and the screen recording.

### Development build path

```bash
brew install watchman cocoapods
# Install a modern Ruby if CocoaPods requires it:
# brew install ruby
npx expo run:ios
```

Then:

```bash
npx expo start --dev-client
```

Use this for the final native smoke test and performance profiling. Expo 58 also offers a Swift Package Manager preview (`--swiftpm`) if CocoaPods remains problematic; treat it as a fallback, not the default.

### Test and typecheck

```bash
npm run typecheck
npm test
```

### Recording

```bash
xcrun simctl io booted recordVideo --codec=h264 demo.mp4
# Ctrl+C to stop
```

---

## 17. README requirements

The README must cover:

1. How to install and run the app (Expo Go and dev build).
2. Tested platform: iOS Simulator, iPhone 17.
3. State and re-render approach, and why it was chosen.
4. Money rounding and how Summary reconciles with rows.
5. How Summary handles the unpriced `OLDCO` holding.
6. Simulator/feed behaviour and how to replace it with a real socket.
7. What was skipped and what would be done next with another day.
8. Roughly how long was spent.
9. Test commands and what they cover.

---

## 18. Submission checklist

- [ ] Git repository with incremental commits, not squashed.
- [ ] README completed.
- [ ] 1–2 minute screen recording of the app running on the iPhone 17 simulator.
- [ ] `.gitignore` excludes `node_modules`, `ios/`, `android/`, `.expo`, `coverage`, and build artifacts.
- [ ] No secrets or generated binaries committed.
- [ ] Repository link ready to share.

---

## 19. Risks and mitigations

| Risk | Mitigation |
|---|---|
| CocoaPods/Ruby setup blocks the dev build | Use Expo Go for development; install modern Ruby/CocoaPods later; SwiftPM preview as fallback |
| Xcode 27.2 / RN 0.88.1 native incompatibility | Expo 58 pins RN 0.88.1; run a native build spike before relying on it; Expo Go remains a fallback |
| Reanimated/Babel configuration issues | Use `expo install`; keep UI tests minimal; swipe is the only animation dependency |
| Summary/sort throttling seen as “not live” | Rows update per tick; aggregates refresh at 250 ms/1 s; document the choice; totals reconcile exactly at rest |
| Shared API limits or outages | Fetch only at startup and on refresh; never poll; show error/retry |
| API symbols missing | Render `—`, exclude unpriced holdings from money totals, never fake a zero |
| Timer throttling when app backgrounds | Disconnect/reset on background; reconnect/reset feed status on foreground |
| Persistence corruption | Validate stored JSON; fall back to defaults |
| Chart memory growth | Cap at 600 points per detail screen |
| React 19 compatibility | Use RNTL v14+; do not use deprecated `react-test-renderer` |
| Sort rows jumping during live updates | Recompute at 1 s; suspend reorder during active dragging |

---

## 20. Definition of done

The core is complete when:

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
