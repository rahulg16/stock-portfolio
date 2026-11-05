import type { Holding, Quote } from '../types';
import {
  calculateDayChange,
  calculateHolding,
  calculatePercentChange,
  calculateSummary,
  filterHoldings,
  sortHoldings,
} from '../calculations';

function makeQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    symbol: 'RELIANCE',
    ltpPaise: 150000,
    openPaise: 145000,
    prevClosePaise: 148000,
    highPaise: 151000,
    lowPaise: 144000,
    volume: 1000,
    seq: 1,
    updatedAt: 0,
    ...overrides,
  };
}

function makeQuoteMap(quotes: readonly Quote[]): ReadonlyMap<string, Quote> {
  return new Map(quotes.map((quote) => [quote.symbol, quote]));
}

const reliance: Holding = { symbol: 'RELIANCE', qty: 10, avgPricePaise: 100000 };
const oldco: Holding = { symbol: 'OLDCO', qty: 30, avgPricePaise: 41250 };

describe('calculatePercentChange', () => {
  it('calculates percentage change from a positive base', () => {
    expect(calculatePercentChange(150000, 100000)).toBe(50);
    expect(calculatePercentChange(90000, 100000)).toBe(-10);
  });

  it('returns null when the base is missing or zero', () => {
    expect(calculatePercentChange(150000, null)).toBeNull();
    expect(calculatePercentChange(150000, 0)).toBeNull();
  });
});

describe('calculateHolding', () => {
  it('calculates invested, current value, P&L and day change in integer paise', () => {
    const metrics = calculateHolding(reliance, makeQuote());

    expect(metrics.hasPrice).toBe(true);
    expect(metrics.lastPricePaise).toBe(150000);
    expect(metrics.investedPaise).toBe(1_000_000);
    expect(metrics.currentValuePaise).toBe(1_500_000);
    expect(metrics.pnlPaise).toBe(500_000);
    expect(metrics.pnlPct).toBeCloseTo(50, 10);
    expect(metrics.dayPnlPaise).toBe(20_000);
    expect(metrics.dayPct).toBeCloseTo(1.35135135, 6);
  });

  it('keeps invested value but reports no price when the quote is missing', () => {
    const metrics = calculateHolding(oldco, undefined);

    expect(metrics.hasPrice).toBe(false);
    expect(metrics.lastPricePaise).toBeNull();
    expect(metrics.investedPaise).toBe(1_237_500);
    expect(metrics.currentValuePaise).toBeNull();
    expect(metrics.pnlPaise).toBeNull();
    expect(metrics.pnlPct).toBeNull();
    expect(metrics.dayPnlPaise).toBeNull();
    expect(metrics.dayPct).toBeNull();
  });

  it('calculates P&L but not day change when prevClose is missing', () => {
    const metrics = calculateHolding(
      reliance,
      makeQuote({ prevClosePaise: null }),
    );

    expect(metrics.pnlPaise).toBe(500_000);
    expect(metrics.dayPnlPaise).toBeNull();
    expect(metrics.dayPct).toBeNull();
  });

  it('returns a null P&L percentage when the average price is zero', () => {
    const metrics = calculateHolding(
      { ...reliance, avgPricePaise: 0 },
      makeQuote(),
    );

    expect(metrics.pnlPct).toBeNull();
  });
});

describe('calculateSummary', () => {
  it('sums only priced holdings and reports the unpriced OLDCO', () => {
    const summary = calculateSummary(
      [reliance, oldco],
      makeQuoteMap([makeQuote()]),
    );

    expect(summary.currentValuePaise).toBe(1_500_000);
    expect(summary.investedPaise).toBe(1_000_000);
    expect(summary.pnlPaise).toBe(500_000);
    expect(summary.pnlPct).toBeCloseTo(50, 10);
    expect(summary.dayPnlPaise).toBe(20_000);
    expect(summary.dayPct).toBeCloseTo(1.35135135, 6);
    expect(summary.pricedCount).toBe(1);
    expect(summary.unpricedSymbols).toEqual(['OLDCO']);
    expect(summary.missingPrevCloseSymbols).toEqual([]);
  });

  it('reconciles exactly with the sum of per-row current values', () => {
    const holdings: Holding[] = [
      reliance,
      { symbol: 'TCS', qty: 3, avgPricePaise: 200000 },
      oldco,
    ];
    const quotes = makeQuoteMap([
      makeQuote(),
      makeQuote({ symbol: 'TCS', ltpPaise: 250000, prevClosePaise: 240000 }),
    ]);

    const summary = calculateSummary(holdings, quotes);
    const rowTotal = holdings.reduce((total, holding) => {
      const metrics = calculateHolding(holding, quotes.get(holding.symbol));
      return total + (metrics.currentValuePaise ?? 0);
    }, 0);

    expect(summary.currentValuePaise).toBe(rowTotal);
    expect(summary.investedPaise).toBe(
      10 * 100000 + 3 * 200000,
    );
    expect(summary.pnlPaise).toBe(rowTotal - summary.investedPaise);
  });

  it('excludes priced holdings without prevClose from day P&L only', () => {
    const summary = calculateSummary(
      [reliance],
      makeQuoteMap([makeQuote({ prevClosePaise: null })]),
    );

    expect(summary.currentValuePaise).toBe(1_500_000);
    expect(summary.pnlPaise).toBe(500_000);
    expect(summary.dayPnlPaise).toBeNull();
    expect(summary.dayPct).toBeNull();
    expect(summary.missingPrevCloseSymbols).toEqual(['RELIANCE']);
  });

  it('returns zero money totals and null percentages when everything is unpriced', () => {
    const summary = calculateSummary([oldco], new Map());

    expect(summary.currentValuePaise).toBe(0);
    expect(summary.investedPaise).toBe(0);
    expect(summary.pnlPaise).toBe(0);
    expect(summary.pnlPct).toBeNull();
    expect(summary.dayPnlPaise).toBeNull();
    expect(summary.dayPct).toBeNull();
    expect(summary.pricedCount).toBe(0);
    expect(summary.unpricedSymbols).toEqual(['OLDCO']);
  });
});

describe('calculateDayChange', () => {
  it('calculates the change in paise and percent', () => {
    const change = calculateDayChange(makeQuote());

    expect(change.changePaise).toBe(2000);
    expect(change.changePct).toBeCloseTo(1.35135135, 6);
  });

  it('returns nulls when the quote or prevClose is missing', () => {
    expect(calculateDayChange(undefined)).toEqual({
      changePaise: null,
      changePct: null,
    });
    expect(
      calculateDayChange(makeQuote({ prevClosePaise: null })),
    ).toEqual({ changePaise: null, changePct: null });
  });
});

describe('sortHoldings', () => {
  const holdings: Holding[] = [
    { symbol: 'TCS', qty: 1, avgPricePaise: 100000 },
    { symbol: 'RELIANCE', qty: 10, avgPricePaise: 100000 },
    { symbol: 'OLDCO', qty: 5, avgPricePaise: 100000 },
    { symbol: 'INFY', qty: 20, avgPricePaise: 100000 },
  ];
  const quotes = makeQuoteMap([
    makeQuote(),
    makeQuote({ symbol: 'TCS', ltpPaise: 300000, prevClosePaise: 290000 }),
    makeQuote({ symbol: 'INFY', ltpPaise: 50000, prevClosePaise: 60000 }),
  ]);

  it('sorts by name', () => {
    expect(sortHoldings(holdings, quotes, 'name').map((h) => h.symbol)).toEqual([
      'INFY',
      'OLDCO',
      'RELIANCE',
      'TCS',
    ]);
  });

  it('sorts by value descending with unpriced holdings last', () => {
    expect(
      sortHoldings(holdings, quotes, 'value').map((h) => h.symbol),
    ).toEqual(['RELIANCE', 'INFY', 'TCS', 'OLDCO']);
  });

  it('sorts by P&L descending with unpriced holdings last', () => {
    expect(sortHoldings(holdings, quotes, 'pnl').map((h) => h.symbol)).toEqual([
      'RELIANCE',
      'TCS',
      'INFY',
      'OLDCO',
    ]);
  });

  it('does not mutate the input array', () => {
    const original = holdings.map((holding) => holding.symbol);
    sortHoldings(holdings, quotes, 'value');
    expect(holdings.map((holding) => holding.symbol)).toEqual(original);
  });
});

describe('filterHoldings', () => {
  const holdings: Holding[] = [
    reliance,
    { symbol: 'TCS', qty: 1, avgPricePaise: 100000 },
    oldco,
  ];

  it('matches symbols case-insensitively and trims whitespace', () => {
    expect(
      filterHoldings(holdings, '  rel ').map((holding) => holding.symbol),
    ).toEqual(['RELIANCE']);
  });

  it('returns everything for an empty query', () => {
    const filtered = filterHoldings(holdings, '   ');
    expect(filtered.map((holding) => holding.symbol)).toEqual([
      'RELIANCE',
      'TCS',
      'OLDCO',
    ]);
    expect(filtered).not.toBe(holdings);
  });

  it('returns an empty list when nothing matches', () => {
    expect(filterHoldings(holdings, 'ZZZ')).toEqual([]);
  });
});
