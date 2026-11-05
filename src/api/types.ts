import type { Quote } from '../domain/types';

/**
 * Raw wire shape of one OHLC row. Every field is optional because the shared
 * API may omit or null values; the client validates before constructing a Quote.
 */
export interface LiquideOhlcRow {
  symbol?: string | null;
  ltp?: number | null;
  open?: number | null;
  prevClose?: number | null;
  high?: number | null;
  low?: number | null;
  volume?: number | null;
  timeStamp?: string | null;
  tsn?: number | null;
}

/** Documented envelope: `message.data` is the only field we consume. */
export interface LiquideOhlcEnvelope {
  status?: string;
  code?: number;
  count?: number;
  message?: {
    data?: LiquideOhlcRow[] | null;
  } | null;
}

/** Minimal request surface so tests can inject a fake fetch. */
export interface HttpRequestInit {
  method: 'POST';
  headers: Record<string, string>;
  body: string;
  signal?: AbortSignal;
}

export interface HttpResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export type FetchLike = (
  url: string,
  init: HttpRequestInit,
) => Promise<HttpResponse>;

export interface FetchQuotesOptions {
  /** Request timeout. Default 10_000 ms. */
  timeoutMs?: number;
  fetchImpl?: FetchLike;
  /** Injectable clock for deterministic `updatedAt` values in tests. */
  now?: () => number;
}

export type FetchQuotes = (
  symbols: readonly string[],
  options?: FetchQuotesOptions,
) => Promise<Quote[]>;
