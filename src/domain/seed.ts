import type { Holding } from './types';

/** The only symbols the test API recognises. */
export const ALLOWED_SYMBOLS: readonly string[] = [
  'RELIANCE',
  'TCS',
  'HDFCBANK',
  'INFY',
  'ICICIBANK',
  'SBIN',
  'BHARTIARTL',
  'ITC',
  'LT',
  'HINDUNILVR',
  'KOTAKBANK',
  'AXISBANK',
  'BAJFINANCE',
  'MARUTI',
  'SUNPHARMA',
  'TITAN',
  'ASIANPAINT',
  'ULTRACEMCO',
  'WIPRO',
  'NTPC',
  'POWERGRID',
  'ONGC',
  'TATASTEEL',
  'ADANIENT',
  'HCLTECH',
] as const;

export const ALLOWED_SYMBOL_SET: ReadonlySet<string> = new Set(ALLOWED_SYMBOLS);

/**
 * Starting holdings, bundled with the app and used only on first launch.
 * `OLDCO` is deliberately not one of ALLOWED_SYMBOLS: the API will never
 * return it, which exercises the missing-price path.
 */
const STARTING_HOLDINGS: readonly Holding[] = [
  { symbol: 'RELIANCE', qty: 25, avgPricePaise: 131959 },
  { symbol: 'TCS', qty: 40, avgPricePaise: 258971 },
  { symbol: 'HDFCBANK', qty: 10, avgPricePaise: 75586 },
  { symbol: 'INFY', qty: 10, avgPricePaise: 111470 },
  { symbol: 'ICICIBANK', qty: 5, avgPricePaise: 156604 },
  { symbol: 'SBIN', qty: 15, avgPricePaise: 80062 },
  { symbol: 'BHARTIARTL', qty: 40, avgPricePaise: 189080 },
  { symbol: 'ITC', qty: 15, avgPricePaise: 22574 },
  { symbol: 'LT', qty: 40, avgPricePaise: 325032 },
  { symbol: 'HINDUNILVR', qty: 100, avgPricePaise: 160515 },
  { symbol: 'KOTAKBANK', qty: 15, avgPricePaise: 47457 },
  { symbol: 'AXISBANK', qty: 100, avgPricePaise: 137855 },
  { symbol: 'BAJFINANCE', qty: 100, avgPricePaise: 95152 },
  { symbol: 'MARUTI', qty: 5, avgPricePaise: 1301725 },
  { symbol: 'SUNPHARMA', qty: 5, avgPricePaise: 178428 },
  { symbol: 'TITAN', qty: 12, avgPricePaise: 406193 },
  { symbol: 'ASIANPAINT', qty: 12, avgPricePaise: 231635 },
  { symbol: 'ULTRACEMCO', qty: 100, avgPricePaise: 1018127 },
  { symbol: 'WIPRO', qty: 12, avgPricePaise: 16936 },
  { symbol: 'NTPC', qty: 100, avgPricePaise: 32600 },
  { symbol: 'OLDCO', qty: 30, avgPricePaise: 41250 },
] as const;

/** Returns a fresh copy so callers can never mutate the bundle. */
export function createStartingHoldings(): Holding[] {
  return STARTING_HOLDINGS.map((holding) => ({ ...holding }));
}
