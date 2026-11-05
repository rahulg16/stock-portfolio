import { toPaise } from '../domain/money';
import type { Quote } from '../domain/types';
import type {
  FetchLike,
  FetchQuotesOptions,
  LiquideOhlcRow,
} from './types';

export const LIQUIDE_OHLC_URL =
  'https://api.v2.liquide.life/api/markets/ohlc';
export const DEFAULT_TIMEOUT_MS = 10_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Returns a finite positive rupee value, or null when the field is missing/invalid. */
function readPrice(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function readVolume(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : null;
}

function parseRow(
  value: unknown,
  requestedSymbols: ReadonlySet<string>,
  now: () => number,
): Quote | null {
  if (!isRecord(value)) {
    return null;
  }

  const row = value as LiquideOhlcRow;
  if (typeof row.symbol !== 'string' || !requestedSymbols.has(row.symbol)) {
    return null;
  }

  const ltp = readPrice(row.ltp);
  if (ltp === null) {
    return null;
  }

  const open = readPrice(row.open);
  const prevClose = readPrice(row.prevClose);
  const high = readPrice(row.high);
  const low = readPrice(row.low);
  const volume = readVolume(row.volume);

  return {
    symbol: row.symbol,
    ltpPaise: toPaise(ltp),
    openPaise: open === null ? null : toPaise(open),
    prevClosePaise: prevClose === null ? null : toPaise(prevClose),
    highPaise: high === null ? null : toPaise(high),
    lowPaise: low === null ? null : toPaise(low),
    volume,
    seq: 0,
    updatedAt: now(),
  };
}

/** Validates the documented envelope and converts each usable row to a Quote. */
export function parseOhlcResponse(
  payload: unknown,
  symbols: readonly string[],
  now: () => number = Date.now,
): Quote[] {
  if (!isRecord(payload)) {
    throw new Error('Price service returned an unexpected response.');
  }

  const message = payload.message;
  if (!isRecord(message) || !Array.isArray(message.data)) {
    throw new Error('Price service response did not include market data.');
  }

  const requested = new Set(symbols);
  const quotes: Quote[] = [];
  const seen = new Set<string>();

  for (const raw of message.data) {
    const quote = parseRow(raw, requested, now);
    if (!quote || seen.has(quote.symbol)) {
      continue;
    }
    seen.add(quote.symbol);
    quotes.push(quote);
  }

  return quotes;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.name === 'AbortError') {
    return 'Price request timed out. Please try again.';
  }
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return 'Could not reach the price service.';
}

/**
 * Fetches the REST baseline once. Callers must not poll this shared test server;
 * it is only used at startup and on explicit pull-to-refresh.
 */
export async function fetchQuotes(
  symbols: readonly string[],
  options: FetchQuotesOptions = {},
): Promise<Quote[]> {
  const uniqueSymbols = Array.from(new Set(symbols)).filter(
    (symbol) => symbol.length > 0,
  );
  if (uniqueSymbols.length === 0) {
    return [];
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const now = options.now ?? Date.now;
  const fetchImpl: FetchLike = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let response;
    try {
      response = await fetchImpl(LIQUIDE_OHLC_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ symbols: uniqueSymbols }),
        signal: controller.signal,
      });
    } catch (error) {
      throw new Error(errorMessage(error));
    }

    if (!response.ok) {
      throw new Error(
        `Price service returned HTTP ${response.status}. Please try again.`,
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new Error('Price service returned malformed JSON.');
    }

    return parseOhlcResponse(payload, uniqueSymbols, now);
  } finally {
    clearTimeout(timeout);
  }
}
