/**
 * Core domain types.
 *
 * Money is always represented as integer paise (1 rupee = 100 paise) so that
 * portfolio maths never accumulates floating-point error. Values are converted
 * from the API/simulator rupee values exactly once, at the market-store boundary.
 */

export type MoneyPaise = number;

export interface Quote {
  symbol: string;
  ltpPaise: MoneyPaise;
  openPaise: MoneyPaise | null;
  prevClosePaise: MoneyPaise | null;
  highPaise: MoneyPaise | null;
  lowPaise: MoneyPaise | null;
  volume: number | null;
  /** Monotonic per-symbol sequence. Ticks with a lower/equal seq are stale. */
  seq: number;
  updatedAt: number;
}

export interface Holding {
  symbol: string;
  /** Whole shares, > 0. */
  qty: number;
  avgPricePaise: MoneyPaise;
}

/**
 * A partial price update. Absent fields must not overwrite existing quote data.
 * Values are rupees, matching the shape a real socket client would deliver.
 */
export interface Tick {
  symbol: string;
  seq: number;
  ltp?: number;
  high?: number;
  low?: number;
  volume?: number;
}

export type OrderSide = 'BUY' | 'SELL';

export type FeedStatus = 'connecting' | 'live' | 'paused' | 'stale';

export type HoldingSortKey = 'name' | 'value' | 'pnl';

/** Derived, display-ready metrics for one holding at the current quote. */
export interface HoldingMetrics {
  symbol: string;
  hasPrice: boolean;
  lastPricePaise: MoneyPaise | null;
  investedPaise: MoneyPaise;
  currentValuePaise: MoneyPaise | null;
  pnlPaise: MoneyPaise | null;
  pnlPct: number | null;
  dayPnlPaise: MoneyPaise | null;
  dayPct: number | null;
}

/** Portfolio totals. Unpriced holdings are excluded from every money field. */
export interface PortfolioSummary {
  currentValuePaise: MoneyPaise;
  investedPaise: MoneyPaise;
  pnlPaise: MoneyPaise;
  pnlPct: number | null;
  dayPnlPaise: MoneyPaise | null;
  dayPct: number | null;
  pricedCount: number;
  unpricedSymbols: readonly string[];
  missingPrevCloseSymbols: readonly string[];
}

/** Day change for a single quote. Both fields are null when prevClose is unavailable. */
export interface DayChange {
  changePaise: MoneyPaise | null;
  changePct: number | null;
}

/** Result of client-side order validation. */
export interface OrderValidation {
  valid: boolean;
  error: string | null;
}
