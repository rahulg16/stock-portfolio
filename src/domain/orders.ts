import type {
  Holding,
  MoneyPaise,
  OrderSide,
  OrderValidation,
} from './types';

/**
 * Validates an order against the current holding and live price availability.
 * A missing price blocks trading completely: an order may never fill at a
 * guessed or stale-free price.
 */
export function validateOrder(
  holding: Holding | undefined,
  side: OrderSide,
  qty: number,
  hasPrice: boolean,
): OrderValidation {
  if (!hasPrice) {
    return { valid: false, error: 'Trading is disabled because there is no live price.' };
  }
  if (!Number.isFinite(qty) || !Number.isInteger(qty) || qty <= 0) {
    return { valid: false, error: 'Enter a whole number greater than zero.' };
  }
  if (side === 'SELL') {
    if (!holding || holding.qty <= 0) {
      return { valid: false, error: 'You do not hold this stock.' };
    }
    if (qty > holding.qty) {
      return {
        valid: false,
        error: `You can sell at most ${holding.qty} share${holding.qty === 1 ? '' : 's'}.`,
      };
    }
  }
  return { valid: true, error: null };
}

/**
 * Applies a fill to a holdings array without mutating the input.
 *
 * Buys update quantity and use a weighted average (rounded to the nearest paise).
 * Sells leave the average price untouched; selling the entire position removes
 * the row. Invalid input is a programmer error and throws.
 */
export function executeOrder(
  holdings: readonly Holding[],
  symbol: string,
  side: OrderSide,
  qty: number,
  fillPricePaise: MoneyPaise,
): Holding[] {
  if (!Number.isSafeInteger(qty) || qty <= 0) {
    throw new Error(`Order quantity must be a positive integer, received ${qty}`);
  }
  if (!Number.isSafeInteger(fillPricePaise) || fillPricePaise <= 0) {
    throw new Error(`Fill price must be positive integer paise, received ${fillPricePaise}`);
  }

  const index = holdings.findIndex((holding) => holding.symbol === symbol);

  if (side === 'BUY') {
    if (index === -1) {
      return [...holdings, { symbol, qty, avgPricePaise: fillPricePaise }];
    }

    const existing = holdings[index];
    if (!existing) {
      throw new Error(`Holding lookup failed for ${symbol}`);
    }
    const newQty = existing.qty + qty;
    const newAvgPricePaise = Math.round(
      (existing.qty * existing.avgPricePaise + qty * fillPricePaise) / newQty,
    );

    return holdings.map((holding, holdingIndex) =>
      holdingIndex === index
        ? { ...holding, qty: newQty, avgPricePaise: newAvgPricePaise }
        : holding,
    );
  }

  if (index === -1) {
    throw new Error(`Cannot sell ${symbol}: no holding exists`);
  }

  const existing = holdings[index];
  if (!existing) {
    throw new Error(`Holding lookup failed for ${symbol}`);
  }
  if (qty > existing.qty) {
    throw new Error(`Cannot sell ${qty} ${symbol}: only ${existing.qty} held`);
  }
  if (qty === existing.qty) {
    return holdings.filter((_, holdingIndex) => holdingIndex !== index);
  }

  return holdings.map((holding, holdingIndex) =>
    holdingIndex === index ? { ...holding, qty: existing.qty - qty } : holding,
  );
}

/** Estimated order value at a given live price. Returns null when price is missing. */
export function estimateOrderValuePaise(
  qty: number,
  pricePaise: MoneyPaise | null,
): MoneyPaise | null {
  if (pricePaise === null || !Number.isInteger(qty) || qty <= 0) {
    return null;
  }
  return qty * pricePaise;
}
