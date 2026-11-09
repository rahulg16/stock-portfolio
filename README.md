# Stock Portfolio

A React Native stock portfolio app built with Expo SDK 58, demonstrating high-frequency live price updates (≈20 ticks/sec) with performant per-symbol re-render isolation.

## 📱 Screens

| Screen | Features |
|--------|----------|
| **Portfolio** (Home) | Summary card (current value, invested, total P&L, today's P&L), live holdings list, sort (Name/Value/P&L), symbol filter, pull-to-refresh |
| **Watchlist** | Add/remove symbols (25 NSE symbols), swipe-to-delete, AsyncStorage persistence, live LTP + day change |
| **Stock Detail** | Hero LTP + day change, stats grid (Open/High/Low/Prev Close/Volume/Updated), position card (if held), SVG sparkline (600 pts), Trade action |
| **Buy/Sell Sheet** | BUY/SELL segmented, quantity input with validation, live estimated value at current LTP, confirm → executes at live price, persists |

## 🚀 Install & Run

### Expo Go (recommended for development)

```bash
npm install
npx expo start --go
# Press 'i' to open in iPhone 17 simulator
```

### Development Build (for native performance profiling)

```bash
brew install watchman cocoapods
npx expo run:ios
# Then: npx expo start --dev-client
```

**Tested platform:** iOS Simulator, iPhone 17, Expo SDK 58, React Native 0.88.1, React 19.3

## 🧠 Architecture: State & Re-render Strategy

### Zustand Stores + Per-Symbol Selectors

State lives in three Zustand (v5) stores, each in a single readable file. Components subscribe through selector hooks, so a RELIANCE tick only re-renders RELIANCE consumers:

```
marketStore (quotes Map, per-symbol lastSeq, feed status)
    ├─ useQuote(symbol) → only that symbol's row re-renders
    ├─ useMarketVersion(250ms) → SummaryCard coalesced
    └─ useMarketVersion(1s)   → Sort order (frozen during scroll)

portfolioStore (holdings, persistence)
watchlistStore (symbols, persistence)
```

### Why Zustand?

- **O(1) per-symbol updates** — `useQuote(symbol)` selects one entry from the quotes `Map`; untouched `Quote` objects keep their identity, so other rows do not re-render
- **No provider wrapper** — vanilla Zustand stores can be driven directly in tests
- **Coalesced aggregates** — Summary/sort throttle at 250ms/1s, not on every tick
- **Small surface** — three focused stores plus a storage helper, with no hand-rolled subscription plumbing

### Performance Results

- **20 ticks/sec** across ~25 symbols
- **Only ticked row commits** — FlatList, other rows, PortfolioScreen stay committed-free
- **SummaryCard** commits at 250ms cadence
- **Sort** recomputes at 1s, frozen during active drag

## 🗃️ State Stores

| Store | Holds | Hooks |
|-------|-------|-------|
| `marketStore` | live quotes (`ReadonlyMap<string, Quote>`), per-symbol `lastSeq` stale-tick guard, `lastTickAt`, feed `status` | `useQuote`, `useFeedStatus`, `useMarketVersion` |
| `portfolioStore` | persisted holdings + `applyOrder` | `useHoldings`, `useHolding` |
| `watchlistStore` | persisted symbols + `add`/`remove` | `useWatchlist` |

`marketStore` exposes `applyTick`, `applyBaseline`, `startStatusPolling`, and `stopStatusPolling`, and exports `SUMMARY_INTERVAL_MS` (250 ms) and `SORT_INTERVAL_MS` (1000 ms). **Market data stays in memory** — only holdings and watchlist symbols are persisted. Feed status lives here too (polled every 500 ms, updating only on a real transition), so there is no separate feed-status store.

`portfolioStore` and `watchlistStore` use Zustand's `persist` middleware with AsyncStorage (`skipHydration: true`, `partialize`, and `merge` validators that fall back to defaults on malformed data). Bootstrap calls `portfolioStore.persist.rehydrate()` and `watchlistStore.persist.rehydrate()`. `src/store/storage.ts` wraps AsyncStorage best-effort and upgrades pre-migration bare-array values on read under the same storage keys. Hooks are co-located with their stores.

## 💰 Money Rounding & Summary Reconciliation

All money stored/calculated as **integer paise** (₹1 = 100 paise):

```typescript
investedPaise    = qty * avgPricePaise
currentValuePaise = qty * ltpPaise
pnlPaise          = currentValuePaise - investedPaise
pnlPct            = pnlPaise / investedPaise * 100
dayPnlPaise       = qty * (ltpPaise - prevClosePaise)
dayPct            = (ltpPaise - prevClosePaise) / prevClosePaise * 100
```

**Summary totals are sums of per-row integer paise** — the displayed total *exactly equals* the sum of displayed row values at rest. Percentages computed from integers, rounded only for display.

**Indian formatting:** `₹12,34,567.89` (lakh/crore grouping) via pure functions, not locale-dependent.

## 🚫 Unpriced `OLDCO` Handling

`OLDCO` is deliberately **not in the API symbol list** (25 allowed symbols):

- Shows `—` for LTP, P&L ₹, P&L %
- **Excluded** from current value, invested, total P&L, day P&L
- Never treated as zero
- Caption: *"Excludes 1 unpriced holding (OLDCO)."*
- Trading disabled (no quote → Buy/Sell button disabled)

If a holding has price but no `prevClose`, it's included in totals but excluded from day P&L with a visible note.

## 📡 Simulator / Feed

`createTickSimulator(options)` is a closure factory that returns a `PriceFeed`; `TickSimulator` is an interface extending `PriceFeed` with `updateBaseline`. `src/feed/types.ts` defines `PriceFeed`, the swap point for a real socket.

- **20 ticks/sec** globally (one symbol per 50ms)
- **Partial ticks** — only changed fields present (`ltp` always, `high`/`low`/`volume` occasionally)
- **2% stale ticks** — replays the immediately previous tick after a newer one; store ignores via per-symbol `seq`
- **5s pauses every 60–90s** — drives "Prices paused" → "Prices live" banner
- **Injectable RNG** — deterministic tests

**Replace with real socket:** Implement `PriceFeed` interface, swap in `MarketBootstrapProvider`.

## ⏭️ Skipped / Next Steps (Stretch Goals)

- Price-cell flash on change
- Reconnect with backoff + catch-up fetch
- Limit orders
- Orders history screen
- Simulator controls / dev menu

## ⏱️ Time Spent

~10 hours across milestones (scaffold → buy/sell sheet), based on 23 commits spanning Nov 5–6, 2026.

## 📹 Screen Recording

A 1–2 minute recording of the app running on the iPhone 17 simulator is available here:

[Watch the demo video](./demo.mp4)

The file is ~51 MB and is gitignored (see `.gitignore`), so it is not tracked in the repository. Play it locally to see the live ticks, Summary card, buy/sell flow, and paused/resume banner in action.

## 🧪 Test Commands

```bash
npm run typecheck   # tsc --noEmit (strict)
npm test            # jest (66 tests)
npm run test:ci     # jest --ci --coverage
```

## 📁 Project Structure

```
src/
├── api/liquide.ts              # REST client, validation, paise conversion
├── domain/                     # Pure: money, calculations, orders, types, seed
├── feed/                       # PriceFeed interface, tick simulator factory
├── store/                      # marketStore, portfolioStore, watchlistStore, storage
├── theme/                      # System light/dark ThemeProvider
├── shared/
│   ├── ui/                     # Button, SegmentedControl, NumericInput, ModalSheet, ListRow, StatItem, Chip, Divider
│   └── utils/                  # format (fmtINR, fmtPct...), validation
├── screens/
│   ├── PortfolioScreen.tsx
│   ├── Portfolio/components/   # HoldingRow, SummaryCard
│   ├── WatchlistScreen.tsx
│   ├── Watchlist/components/   # (ready)
│   ├── StockDetailScreen.tsx
│   ├── StockDetail/components/ # PriceChart, PositionCard, StatGrid
│   └── AddSymbolSheet.tsx
├── components/                 # App-wide: PausedBanner, ErrorView, LoadingView, EmptyView, BuySellSheet
└── navigation/RootNavigator.tsx
```

## 📄 License

MIT