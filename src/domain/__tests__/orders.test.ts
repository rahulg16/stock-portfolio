import type { Holding } from '../types';
import {
  estimateOrderValuePaise,
  executeOrder,
  validateOrder,
} from '../orders';

const holding: Holding = {
  symbol: 'RELIANCE',
  qty: 10,
  avgPricePaise: 100000,
};

describe('validateOrder', () => {
  it('accepts a valid buy without an existing position', () => {
    expect(validateOrder(undefined, 'BUY', 5, true)).toEqual({
      valid: true,
      error: null,
    });
  });

  it('accepts a sell up to the held quantity', () => {
    expect(validateOrder(holding, 'SELL', 10, true).valid).toBe(true);
    expect(validateOrder(holding, 'SELL', 1, true).valid).toBe(true);
  });

  it('rejects non-positive and fractional quantities', () => {
    expect(validateOrder(holding, 'BUY', 0, true).valid).toBe(false);
    expect(validateOrder(holding, 'BUY', -1, true).valid).toBe(false);
    expect(validateOrder(holding, 'BUY', 1.5, true).valid).toBe(false);
    expect(validateOrder(holding, 'BUY', Number.NaN, true).valid).toBe(false);
  });

  it('rejects an order when no live price exists', () => {
    expect(validateOrder(holding, 'BUY', 1, false)).toEqual({
      valid: false,
      error: 'Trading is disabled because there is no live price.',
    });
  });

  it('rejects selling more than held, or selling with no position', () => {
    expect(validateOrder(holding, 'SELL', 11, true).valid).toBe(false);
    expect(validateOrder(undefined, 'SELL', 1, true).valid).toBe(false);
  });
});

describe('executeOrder', () => {
  it('adds a new position on first buy', () => {
    const result = executeOrder([], 'INFY', 'BUY', 15, 150000);

    expect(result).toEqual([
      { symbol: 'INFY', qty: 15, avgPricePaise: 150000 },
    ]);
  });

  it('updates quantity and weighted average on an existing buy', () => {
    const result = executeOrder([holding], 'RELIANCE', 'BUY', 10, 200000);

    expect(result[0]).toEqual({
      symbol: 'RELIANCE',
      qty: 20,
      avgPricePaise: 150000,
    });
  });

  it('rounds the weighted average to the nearest paise', () => {
    const result = executeOrder(
      [{ symbol: 'TCS', qty: 3, avgPricePaise: 10001 }],
      'TCS',
      'BUY',
      1,
      10002,
    );

    expect(result[0]?.avgPricePaise).toBe(10001);
  });

  it('keeps the average price unchanged on a partial sell', () => {
    const result = executeOrder([holding], 'RELIANCE', 'SELL', 4, 150000);

    expect(result[0]).toEqual({
      symbol: 'RELIANCE',
      qty: 6,
      avgPricePaise: 100000,
    });
  });

  it('removes the holding when the full quantity is sold', () => {
    const result = executeOrder([holding], 'RELIANCE', 'SELL', 10, 150000);

    expect(result).toEqual([]);
  });

  it('does not mutate the input array or its entries', () => {
    const input = [holding];
    const result = executeOrder(input, 'RELIANCE', 'BUY', 1, 120000);

    expect(input[0]).toEqual(holding);
    expect(result).not.toBe(input);
  });

  it('throws for overselling or selling a missing position', () => {
    expect(() =>
      executeOrder([holding], 'RELIANCE', 'SELL', 11, 150000),
    ).toThrow();
    expect(() => executeOrder([], 'RELIANCE', 'SELL', 1, 150000)).toThrow();
  });

  it('throws for invalid quantities or fill prices', () => {
    expect(() => executeOrder([], 'INFY', 'BUY', 0, 150000)).toThrow();
    expect(() => executeOrder([], 'INFY', 'BUY', 1.5, 150000)).toThrow();
    expect(() => executeOrder([], 'INFY', 'BUY', 1, 0)).toThrow();
    expect(() => executeOrder([], 'INFY', 'BUY', 1, 150000.5)).toThrow();
  });
});

describe('estimateOrderValuePaise', () => {
  it('multiplies quantity by the live price', () => {
    expect(estimateOrderValuePaise(5, 150000)).toBe(750000);
  });

  it('returns null for missing prices or invalid quantities', () => {
    expect(estimateOrderValuePaise(5, null)).toBeNull();
    expect(estimateOrderValuePaise(0, 150000)).toBeNull();
    expect(estimateOrderValuePaise(1.5, 150000)).toBeNull();
  });
});
