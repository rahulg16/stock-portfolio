import type {
  DayChange,
  Holding,
  HoldingMetrics,
  HoldingSortKey,
  MoneyPaise,
  PortfolioSummary,
  Quote,
} from './types';

/** Percent change from `base` to `current`; null when undefined, not when zero movement. */
export function calculatePercentChange(
  currentPaise: MoneyPaise,
  basePaise: MoneyPaise | null,
): number | null {
  if (basePaise === null || basePaise <= 0) {
    return null;
  }
  return ((currentPaise - basePaise) / basePaise) * 100;
}

export function calculateHolding(
  holding: Holding,
  quote: Quote | undefined,
): HoldingMetrics {
  const investedPaise = holding.qty * holding.avgPricePaise;

  if (!quote) {
    return {
      symbol: holding.symbol,
      hasPrice: false,
      lastPricePaise: null,
      investedPaise,
      currentValuePaise: null,
      pnlPaise: null,
      pnlPct: null,
      dayPnlPaise: null,
      dayPct: null,
    };
  }

  const currentValuePaise = holding.qty * quote.ltpPaise;
  const pnlPaise = currentValuePaise - investedPaise;
  const pnlPct =
    investedPaise > 0 ? (pnlPaise / investedPaise) * 100 : null;

  let dayPnlPaise: MoneyPaise | null = null;
  let dayPct: number | null = null;
  if (quote.prevClosePaise !== null && quote.prevClosePaise > 0) {
    dayPnlPaise = holding.qty * (quote.ltpPaise - quote.prevClosePaise);
    dayPct =
      ((quote.ltpPaise - quote.prevClosePaise) / quote.prevClosePaise) * 100;
  }

  return {
    symbol: holding.symbol,
    hasPrice: true,
    lastPricePaise: quote.ltpPaise,
    investedPaise,
    currentValuePaise,
    pnlPaise,
    pnlPct,
    dayPnlPaise,
    dayPct,
  };
}

/**
 * Summary totals are sums of the same integer paise values each row displays.
 * Unpriced holdings are excluded from both current value and invested totals,
 * so a missing price is never silently treated as zero.
 */
export function calculateSummary(
  holdings: readonly Holding[],
  quotes: ReadonlyMap<string, Quote>,
): PortfolioSummary {
  let currentValuePaise = 0;
  let investedPaise = 0;
  let dayPnlPaise = 0;
  let dayBasePaise = 0;
  let dayCount = 0;
  let pricedCount = 0;
  const unpricedSymbols: string[] = [];
  const missingPrevCloseSymbols: string[] = [];

  for (const holding of holdings) {
    const quote = quotes.get(holding.symbol);
    if (!quote) {
      unpricedSymbols.push(holding.symbol);
      continue;
    }

    pricedCount += 1;
    currentValuePaise += holding.qty * quote.ltpPaise;
    investedPaise += holding.qty * holding.avgPricePaise;

    if (quote.prevClosePaise !== null && quote.prevClosePaise > 0) {
      dayPnlPaise += holding.qty * (quote.ltpPaise - quote.prevClosePaise);
      dayBasePaise += holding.qty * quote.prevClosePaise;
      dayCount += 1;
    } else {
      missingPrevCloseSymbols.push(holding.symbol);
    }
  }

  const pnlPaise = currentValuePaise - investedPaise;

  return {
    currentValuePaise,
    investedPaise,
    pnlPaise,
    pnlPct:
      investedPaise > 0 ? (pnlPaise / investedPaise) * 100 : null,
    dayPnlPaise: dayCount > 0 ? dayPnlPaise : null,
    dayPct: dayCount > 0 && dayBasePaise > 0 ? (dayPnlPaise / dayBasePaise) * 100 : null,
    pricedCount,
    unpricedSymbols,
    missingPrevCloseSymbols,
  };
}

/** Day change for a single quote, used by watchlist rows and stock detail. */
export function calculateDayChange(quote: Quote | undefined): DayChange {
  if (!quote || quote.prevClosePaise === null || quote.prevClosePaise <= 0) {
    return { changePaise: null, changePct: null };
  }
  return {
    changePaise: quote.ltpPaise - quote.prevClosePaise,
    changePct:
      ((quote.ltpPaise - quote.prevClosePaise) / quote.prevClosePaise) * 100,
  };
}

function compareSymbols(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Sorts holdings by name, current value (descending) or P&L (descending).
 * Unpriced holdings always sort last, then by symbol, so they cannot masquerade
 * as zero-valued positions.
 */
export function sortHoldings(
  holdings: readonly Holding[],
  quotes: ReadonlyMap<string, Quote>,
  sortKey: HoldingSortKey,
): Holding[] {
  const decorated = holdings.map((holding) => ({
    holding,
    metrics: calculateHolding(holding, quotes.get(holding.symbol)),
  }));

  decorated.sort((left, right) => {
    if (sortKey === 'name') {
      return compareSymbols(left.holding.symbol, right.holding.symbol);
    }

    const leftMetric =
      sortKey === 'value' ? left.metrics.currentValuePaise : left.metrics.pnlPaise;
    const rightMetric =
      sortKey === 'value' ? right.metrics.currentValuePaise : right.metrics.pnlPaise;

    if (leftMetric === null && rightMetric === null) {
      return compareSymbols(left.holding.symbol, right.holding.symbol);
    }
    if (leftMetric === null) return 1;
    if (rightMetric === null) return -1;
    if (rightMetric !== leftMetric) {
      return rightMetric - leftMetric;
    }
    return compareSymbols(left.holding.symbol, right.holding.symbol);
  });

  return decorated.map((entry) => entry.holding);
}

export function filterHoldings(
  holdings: readonly Holding[],
  query: string,
): Holding[] {
  const normalized = query.trim().toUpperCase();
  if (normalized.length === 0) {
    return holdings.slice();
  }
  return holdings.filter((holding) => holding.symbol.includes(normalized));
}
