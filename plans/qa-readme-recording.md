# Milestone 11 — QA + README + Recording

**Dependencies:** All screens and sheets complete, all stores/tests passing, app bundles.

---

## 1. QA Checklist (from PLAN.md §15)

Run on **iPhone 17 simulator** with Expo Go.

| Area | Checks |
|------|--------|
| **Launch** | App launches, loading → data |
| **API failure** | Error + Retry recovers |
| **Pull-to-refresh** | Updates prices; failure keeps stale data + banner |
| **Live ticks** | ~20 ticks/s total, rows update |
| **Scroll performance** | Smooth under ticks |
| **Profiler** | Only affected rows re-render |
| **Stale ticks** | Late/out-of-order ignored |
| **Partial ticks** | Unchanged fields preserved |
| **5 s silence** | "Prices paused" → resumes |
| **OLDCO** | Shows `—`, excluded from Summary, caption shown |
| **Summary reconciliation** | Totals = sum of row values at rest |
| **Sort** | Name / Value / P&L work |
| **Filter** | Case-insensitive symbol filter works |
| **Buy** | Updates qty, weighted avg, persists |
| **Sell** | Rejects oversell, updates qty |
| **Sell-all** | Removes row |
| **OLDCO trading** | Disabled (no quote) |
| **Watchlist** | Add/remove persists across restart |
| **Holdings** | Persist across restart |
| **Themes** | Light/dark follow system |
| **INR formatting** | Lakh/crore grouping |
| **Empty states** | Portfolio empty, Watchlist empty |
| **Buy/Sell estimate** | Uses live price |

---

## 2. Profiler Verification

1. Open React DevTools Profiler
2. Start recording
3. Scroll Portfolio while ticks flow
4. Stop; verify:
   - Only ticked symbol's `HoldingRow` commits
   - `FlatList` / `PortfolioScreen` / other rows **do not** commit
   - `SummaryCard` commits at ~250 ms cadence
   - Sort container commits at ~1 s cadence (not during drag)

---

## 3. README.md

Create/update `README.md` at repo root with:

1. **Install & Run**
   - Expo Go: `npm install && npx expo start --go` → press `i` for iPhone 17
   - Dev build (optional): `brew install watchman cocoapods && npx expo run:ios`
2. **Tested Platform**
   - iOS Simulator, iPhone 17, Expo SDK 58, RN 0.88.1
3. **State & Re-render Approach**
   - Custom external stores + `useSyncExternalStore`
   - Per-symbol subscriptions → O(1) row updates
   - Coalesced aggregates (250 ms / 1 s)
   - Why not Redux/Zustand: no middleware overhead, explicit control
4. **Money Rounding & Summary Reconciliation**
   - All money = integer paise
   - Summary = sum of per-row paise → exact match at rest
   - Percentages computed from integers, rounded only for display
5. **Unpriced OLDCO Handling**
   - Excluded from all money totals
   - Shows `—` for LTP/P&L
   - Caption: "Excludes 1 unpriced holding (OLDCO)."
   - Trading disabled
6. **Simulator / Feed**
   - `TickSimulator` implements `PriceFeed` interface
   - 20 ticks/s, partial fields, 2% stale, 5 s pauses
   - Replaceable: implement `PriceFeed` for real socket
7. **Skipped / Next Steps**
   - Price-cell flash on change
   - Reconnect with backoff + catch-up fetch
   - Limit orders
   - Orders history screen
   - Simulator controls / dev menu
8. **Time Spent**
   - Rough estimate (fill in)
9. **Test Commands**
   ```bash
   npm run typecheck   # tsc --noEmit
   npm test            # jest --runInBand
   npm run test:ci     # jest --ci --coverage
   ```

---

## 4. Screen Recording

```bash
xcrun simctl io booted recordVideo --codec=h264 demo.mp4
# Ctrl+C to stop
```

**Capture (1–2 min):**
1. Cold launch → loading → Portfolio with data
2. Live ticks: watch Current Value + row LTPs change
3. Scroll Portfolio (smooth)
4. Sort: Name → Value → P&L
5. Filter: type "RELI" → only RELIANCE
6. Pull-to-refresh → banner, prices update
7. Tap RELIANCE → Stock Detail
8. Detail: hero, stats, position card, sparkline updating
9. Tap Buy/Sell → sheet, enter qty, estimated value live
10. Confirm buy → dismiss → Portfolio updated
11. Sell-all RELIANCE → row removed
12. Watchlist tab: add symbol, swipe delete
13. Toggle system dark/light (Settings → Appearance) → app adapts
14. Background app → foreground → ticks resume, banner clears

---

## 5. Git / Repo Hygiene

- `.gitignore` excludes: `node_modules`, `ios/`, `android/`, `.expo`, `coverage`, `*.hbc`, `.export-check`, `demo.mp4`
- No secrets, no generated binaries
- Incremental commits (already done)
- Tag or note final commit for submission

---

## Acceptance Criteria

- [ ] All QA checklist items pass
- [ ] Profiler shows correct re-render isolation
- [ ] README.md complete with all 9 sections
- [ ] `demo.mp4` recorded (1–2 min, covers flows above)
- [ ] Repo clean, ready to share