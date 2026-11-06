import { toPaise } from '../domain/money';
import type { Quote } from '../domain/types';

export const LIQUIDE_OHLC_URL = 'https://api.v2.liquide.life/api/markets/ohlc';

export async function fetchQuotes(symbols: readonly string[]): Promise<Quote[]> {
  const uniqueSymbols = [...new Set(symbols)].filter((symbol) => symbol.length > 0);
  if (uniqueSymbols.length === 0) return [];

  const response = await fetch(LIQUIDE_OHLC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ symbols: uniqueSymbols }),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const json = await response.json();
  if (!json?.message?.data) throw new Error('Invalid response');

  const currentTimestamp = Date.now();
  const requestedSymbols = new Set(uniqueSymbols);

  return json.message.data
    .filter((row: any) => requestedSymbols.has(row.symbol) && typeof row.ltp === 'number')
    .map((row: any) => ({
      symbol: row.symbol,
      ltpPaise: toPaise(row.ltp),
      openPaise: row.open ? toPaise(row.open) : null,
      prevClosePaise: row.prevClose ? toPaise(row.prevClose) : null,
      highPaise: row.high ? toPaise(row.high) : null,
      lowPaise: row.low ? toPaise(row.low) : null,
      volume: typeof row.volume === 'number' ? Math.round(row.volume) : null,
      seq: 0,
      updatedAt: currentTimestamp,
    }));
}