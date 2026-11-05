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

### Custom External Stores + `useSyncExternalStore`

Instead of Redux/Zustand, we use plain TypeScript classes as external stores with `useSyncExternalStore` for React 18+ concurrent compatibility:

```
MarketStore (quotes, per-symbol listeners)
    ├─ useQuote(symbol) → only that symbol's row re-renders
    ├─ useMarketVersion(250ms) → SummaryCard coalesced
    └─ useMarketVersion(1s)   → Sort order (frozen during scroll)

PortfolioStore (holdings, persistence)
WatchlistStore (symbols, persistence)
FeedStatusStore (paused/live/stale banner)
```

### Why not Redux/Zustand?

- **No middleware overhead** — ticks flow directly store → component
- **Explicit per-symbol subscriptions** — `MarketStore.subscribeSymbol(symbol, listener)` gives O(1) updates
- **Coalesced aggregates** — Summary/sort throttle at 250ms/1s, not on every tick
- **Testable** — stores are pure classes, no provider wrapper needed in tests

### Performance Results

- **20 ticks/sec** across ~25 symbols
- **Only ticked row commits** — FlatList, other rows, PortfolioScreen stay committed-free
- **SummaryCard** commits at 250ms cadence
- **Sort** recomputes at 1s, frozen during active drag

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

`TickSimulator` implements the `PriceFeed` interface:

- **20 ticks/sec** globally (one symbol per 50ms)
- **Partial ticks** — only changed fields present (`ltp` always, `high`/`low`/`volume` occasionally)
- **2% stale ticks** — cached older tick emitted after newer one; store ignores via per-symbol `seq`
- **5s pauses every 60–90s** — drives "Prices paused" → "Prices live" banner
- **Injectable RNG/clock** — deterministic tests

**Replace with real socket:** Implement `PriceFeed` interface, swap in `MarketBootstrapProvider`.

## ⏭️ Skipped / Next Steps (Stretch Goals)

- Price-cell flash on change
- Reconnect with backoff + catch-up fetch
- Limit orders
- Orders history screen
- Simulator controls / dev menu

## ⏱️ Time Spent

~16 hours across milestones (scaffold → buy/sell sheet).

## 🧪 Test Commands

```bash
npm run typecheck   # tsc --noEmit (strict)
npm test            # jest --runInBand (88 tests)
npm run test:ci     # jest --ci --coverage
```

## 📁 Project Structure

```
src/
├── api/liquide.ts              # REST client, validation, paise conversion
├── domain/                     # Pure: money, calculations, orders, types, seed
├── feed/                       # TickSimulator, FeedStatusStore
├── store/                      # MarketStore, PortfolioStore, WatchlistStore, hooks
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