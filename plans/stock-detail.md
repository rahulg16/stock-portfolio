# Milestone 9 — Stock Detail

**Dependencies:** Watchlist complete, navigation stack ready, `marketStore` + `portfolioStore` + hooks exist, theme + paused banner exist, `react-native-svg` installed.

---

## Screen: Stock Detail

Pushed from Portfolio row tap or Watchlist row tap. Full-screen detail with live data, position card (if held), SVG sparkline, Buy/Sell action.

---

## Features

### 1. Header
- Back button (native stack)
- Title: symbol (e.g., "RELIANCE")
- Paused banner (global, below header)

### 2. Hero: Large LTP + Day Change
- LTP: large, bold, tabular-nums, `—` if no quote
- Day change: `+₹X.XX (+Y.YY%)` or `-₹X.XX (-Y.YY%)` or `—` if no prevClose
- Green for gain, red for loss, muted for `—`

### 3. Stats Grid (2×3 or 3×2)
| Field | Source | Missing → |
|-------|--------|-----------|
| Open | `quote.openPaise` | `—` |
| High | `quote.highPaise` | `—` |
| Low | `quote.lowPaise` | `—` |
| Prev Close | `quote.prevClosePaise` | `—` |
| Volume | `quote.volume` | `—` |
| Updated | `quote.updatedAt` (relative) | `—` |

- All live via `useQuote(symbol)`
- Formatted with Indian grouping, tabular-nums

### 4. Position Card (conditional)
**Show only if `portfolioStore.getHolding(symbol)` exists.**
- Quantity
- Average price
- Invested (qty × avg)
- Current value (qty × ltp) — live
- P&L ₹ + % — live, green/red
- Updates at 250 ms coalesced cadence (reuse `useSummary` logic or `useMarketVersion`)

### 5. SVG Sparkline
- **Component:** `PriceChart.tsx`
- Buffers up to **600 LTP points** since screen mounted
- X: time (even spacing), Y: price (auto-scale with padding)
- Line: theme accent; area: accentMuted with gradient
- No axes/labels (clean); tap/long-press not required
- Empty state: "No ticks yet" centred
- Cleanup on unmount (clear buffer)
- Performance: single `Path` element, `react-native-svg`, no re-render on every tick — buffer updates via ref, chart re-renders at 250 ms via `useMarketVersion`

### 6. Buy / Sell Action
- Full-width button at bottom (safe-area inset)
- Label: "Buy / Sell" or "Trade"
- Disabled when `quote` is missing (`useQuote` returns undefined)
- Press → opens **Buy/Sell Sheet** (milestone 10) with symbol pre-filled

### 7. States
- Loading: while initial quote not yet received (skeleton for hero + stats)
- Error: quote never arrives (non-blocking banner with Retry → refetch single symbol? or pull-to-refresh on Portfolio)
- Paused: global banner

---

## Components to Create / Extend

| File | Purpose |
|------|---------|
| `src/screens/StockDetailScreen.tsx` | Main screen composition |
| `src/components/PriceChart.tsx` | SVG sparkline with 600-pt buffer |
| `src/components/StatGrid.tsx` | Reusable 2×3 grid (optional) |
| `src/components/PositionCard.tsx` | Conditional position summary |

---

## Tests

| File | Coverage |
|------|----------|
| `PriceChart.test.tsx` | Buffer cap, empty state, render without crash |
| `StockDetailScreen.test.tsx` | Hero/quote/position conditional render |

---

## Acceptance Criteria

- [ ] Navigates from Portfolio row tap and Watchlist row tap
- [ ] Hero shows live LTP + day change with correct colours
- [ ] Stats grid shows all 6 fields live, `—` when missing
- [ ] Position card appears only when held; shows live current value + P&L
- [ ] SVG sparkline renders, updates at 250 ms, caps at 600 points
- [ ] Empty sparkline shows "No ticks yet"
- [ ] Buy/Sell button disabled when no quote; enabled when quote exists
- [ ] Buy/Sell button opens sheet (milestone 10)
- [ ] Light/dark theme works (chart colours adapt)
- [ ] Paused banner shows/hides correctly
- [ ] No memory leak on unmount (buffer cleared)