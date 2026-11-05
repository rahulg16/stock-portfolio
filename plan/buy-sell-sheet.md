# Milestone 10 — Buy / Sell Sheet

**Dependencies:** Stock Detail complete, `portfolioStore` + `executeOrder` + persistence exist, `marketStore` + `useQuote` exist, theme + modal navigation ready (`react-native-screens` + stack).

---

## Screen: Buy/Sell Sheet

Modal sheet presented from Stock Detail. Handles order validation, live estimate, execution, persistence, and dismissal.

---

## Features

### 1. Presentation
- Bottom sheet modal (not full-screen)
- Grabber handle, drag-to-dismiss enabled
- Title: "Buy RELIANCE" / "Sell RELIANCE"
- Pre-filled with symbol from navigation params

### 2. Buy / Sell Segmented Control
- Two segments: **Buy** | **Sell**
- Default: Buy (or Sell if already holding max? — always Buy default)
- Switching resets quantity input

### 3. Quantity Input
- Numeric keyboard (`keyboardType="numeric"`)
- Label: "Quantity"
- Placeholder: "Enter quantity"
- Validation (real-time, shows inline error):
  - Integer > 0
  - If **Sell**: ≤ held quantity (show available: "Available: 25")
  - If **Buy**: no upper bound (but validate integer)
- Clear button (×) inside input

### 4. Live Estimated Value
- Shows: `Estimated: ₹X,XX,XXX.XX` (or `—` if no quote)
- Computed: `qty × ltpPaise` (integer paise → formatted)
- Updates live as:
  - User types quantity (debounced 150 ms)
  - LTP ticks arrive (via `useQuote`)
- Green text (not gain/loss — just accent)

### 5. Validation Summary
- Confirm button disabled until all valid:
  - Quantity valid (per above)
  - Quote exists (`useQuote` not undefined)
- Inline error text under quantity when invalid:
  - "Enter a valid quantity"
  - "Cannot sell more than you hold (max 25)"
  - "No live price available"

### 6. Confirm Action
On press:
1. Read latest quote from `marketStore.getQuote(symbol)` (synchronous)
2. `fillPricePaise = quote.ltpPaise`
3. Call `portfolioStore.applyOrder(symbol, side, qty, fillPricePaise)`
   - This executes order, updates holdings, persists to AsyncStorage
4. Dismiss sheet
5. All screens (Portfolio, Detail, Watchlist) update automatically via store subscriptions

### 7. Error Handling
- If quote missing at confirm time (race): show inline error "Price unavailable, try again", keep sheet open
- If `applyOrder` throws (oversell, invalid qty): show inline error, keep sheet open
- Persistence failure: non-blocking toast/banner (don't block dismiss)

### 8. Accessibility
- Labels on all inputs
- Confirm button: `accessibilityLabel="Confirm buy 10 shares"`
- Estimated value: live region polite

---

## Components to Create / Extend

| File | Purpose |
|------|---------|
| `src/components/BuySellSheet.tsx` | Main sheet component |
| `src/components/QuantityInput.tsx` | Reusable numeric input with validation |
| `src/components/EstimatedValue.tsx` | Live estimate display |

---

## Tests

| File | Coverage |
|------|----------|
| `BuySellSheet.test.tsx` | Validation states, confirm flow, sell max, missing price |
| `orders.test.ts` | Already exists — verify weighted average, sell-all removal |

---

## Acceptance Criteria

- [ ] Sheet opens from Stock Detail with correct symbol
- [ ] Buy/Sell toggle works, resets quantity
- [ ] Quantity input: numeric keyboard, real-time validation
- [ ] Sell shows available quantity; rejects oversell
- [ ] Estimated value updates live on qty change + LTP ticks
- [ ] Confirm disabled until valid
- [ ] Confirm executes order at **current LTP**, persists, dismisses
- [ ] Portfolio updates: quantity, avg price (buy), current value, P&L
- [ ] Detail updates: position card, hero
- [ ] Watchlist row updates (LTP unchanged, but detail would reflect)
- [ ] Sell-all removes holding row from Portfolio
- [ ] OLDCO: sheet disabled (button disabled on Detail when no quote)
- [ ] Light/dark theme works
- [ ] Drag-to-dismiss works
- [ ] No memory leak on dismiss