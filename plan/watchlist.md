# Milestone 8 — Watchlist

**Dependencies:** Portfolio screen complete, navigation shell ready, `watchlistStore` + hooks exist, theme + paused banner exist.

---

## Screen: Watchlist

Bottom-tab sibling of Portfolio. Single screen with header, list, add sheet, swipe delete, persistence.

---

## Features

### 1. Header
- Title: "Watchlist"
- Trailing action: **+** button → opens **Add Symbol Sheet**
- Paused banner (global, reuses `PausedBanner`)

### 2. Add Symbol Sheet
- Modal sheet (bottom sheet, not full-screen modal)
- Shows all 25 `ALLOWED_SYMBOLS`
- Each row: symbol, current LTP (live via `useQuote`), day change
- Already-watched symbols: disabled, greyed out, checkmark
- Tap an available symbol → adds to watchlist, closes sheet
- Empty state if all 25 already watched (unlikely)

### 3. Watchlist Rows
- `FlatList` with `react-native-gesture-handler` swipe actions
- Row content (left to right):
  - Symbol (bold)
  - LTP (live, tabular-nums) — `—` if no quote
  - Day change ₹ + % (green/red, `—` if no prevClose)
- Tap row → push `StockDetailScreen` with symbol
- Swipe left → red **Delete** button → removes symbol, persists
- Row height fixed; `getItemLayout` for performance

### 4. Empty State
- "No symbols yet"
- "Add symbol" button → opens Add Symbol Sheet
- Reuses `EmptyView` component

### 5. Persistence
- Key: `stockportfolio.watchlist.v1`
- Value: `string[]` (symbols)
- Default: `[]`
- Hydrate in `MarketBootstrap` before render
- Persist after every add/remove (fire-and-forget; UI not blocked on failure)
- Validate shape on load; fall back to `[]` if malformed

### 6. Live Updates
- Each row subscribes via `useQuote(symbol)` → only that row re-renders on its tick
- No list-wide re-renders
- Sort order: manual (user order); drag-reorder not required

### 7. States
- Loading: while hydrating (spinner)
- Empty: no symbols
- Error: persistence read failure (fallback to empty, non-blocking banner)
- Paused: global banner (reused)

---

## Components to Create / Extend

| File | Purpose |
|------|---------|
| `src/screens/WatchlistScreen.tsx` | Main screen composition |
| `src/components/WatchlistRow.tsx` | Memoised row, swipe delete |
| `src/components/AddSymbolSheet.tsx` | Modal sheet with all 25 symbols |
| `src/store/watchlistStore.ts` | Already exists — verify persistence logic |

---

## Tests

| File | Coverage |
|------|----------|
| `watchlistStore.test.ts` | Hydrate, add, remove, persist, malformed fallback |
| `AddSymbolSheet.test.tsx` | Disable already-added, tap adds |

---

## Acceptance Criteria

- [ ] Watchlist tab appears in bottom navigation
- [ ] Add sheet shows all 25 symbols with live LTP
- [ ] Already-watched symbols are disabled
- [ ] Tap available symbol → added, sheet closes, row appears
- [ ] Swipe delete removes symbol, persists
- [ ] Tap row → navigates to Stock Detail
- [ ] Empty state shows "Add symbol" action
- [ ] Prices update live per row (no list re-render)
- [ ] Persisted across app restart
- [ ] Light/dark theme works
- [ ] Paused banner shows/hides correctly