import { useEffect, useState } from 'react';
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { toPaise } from '../domain/money';
import type { FeedStatus, Quote, Tick } from '../domain/types';

/** Summary and other aggregates refresh at most this often. */
export const SUMMARY_INTERVAL_MS = 250;
/** Sort order changes at most this often so live prices do not make rows jump. */
export const SORT_INTERVAL_MS = 1000;

const PAUSED_AFTER_MS = 1500;
const STALE_AFTER_MS = 10_000;
const STATUS_POLL_MS = 500;

function isPositiveFinite(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value > 0;
}

function isNonNegativeFinite(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value >= 0;
}

/**
 * Derives a user-facing status from tick silence. A 5-second simulator gap is
 * "paused"; a much longer gap is "stale", so the UI can distinguish a known
 * feed gap from a broken connection.
 */
function computeFeedStatus(
  lastTickAt: number,
  now: number,
  startedAt: number,
): FeedStatus {
  const age = lastTickAt === 0 ? Number.POSITIVE_INFINITY : now - lastTickAt;
  if (age < PAUSED_AFTER_MS) {
    return 'live';
  }
  if (now - startedAt < PAUSED_AFTER_MS) {
    return 'connecting';
  }
  return age < STALE_AFTER_MS ? 'paused' : 'stale';
}

export interface MarketState {
  /**
   * Current quote per symbol; the single renderable price state.
   *
   * Replaced with a new `Map` on every accepted tick. Untouched `Quote` objects
   * keep their identity, so their selectors compare equal and those rows do not
   * re-render. A `Map` (not a `Record`) keeps `calculateSummary` /
   * `sortHoldings` signatures unchanged.
   */
  quotes: ReadonlyMap<string, Quote>;

  /**
   * Per-symbol high-water mark of accepted tick sequences.
   *
   * The stale-tick guard: a tick with `seq <= lastSeq[symbol]` is ignored.
   * Advanced even for ticks with no usable `ltp`, so replaying that sequence
   * later cannot resurrect an older price. Not persisted; no component selects
   * it.
   */
  lastSeq: Record<string, number>;

  /**
   * Timestamp (ms) of the last successful tick.
   *
   * Sole input to `computeFeedStatus`, which drives
   * connecting → live → paused → stale. Not updated by `applyBaseline`: a REST
   * snapshot is not a live tick.
   */
  lastTickAt: number;

  /**
   * Renderable feed health, polled every 500 ms. Only changes on a real
   * transition, so the paused banner does not re-render twice per second.
   */
  status: FeedStatus;

  /**
   * Single write path for live data: validate → per-symbol sequence guard →
   * partial merge → rupee→paise → replace one quote + bump `lastTickAt`.
   *
   * Returns false for stale or unusable ticks.
   */
  applyTick: (tick: Tick) => boolean;

  /**
   * Single write path for REST snapshots (startup, pull-to-refresh). Merges
   * quotes without resetting the sequence guard:
   * `seq = max(lastSeq[symbol] ?? -1, incoming.seq)`.
   */
  applyBaseline: (baseline: readonly Quote[]) => void;

  /**
   * Starts the 500 ms status poller, sets the connecting grace window, and is
   * idempotent (repeat calls do not stack timers).
   */
  startStatusPolling: () => void;

  /**
   * Clears the status timer and resets status to `'connecting'`. Called on
   * unmount, bootstrap error, and when the app backgrounds.
   */
  stopStatusPolling: () => void;
}

export function createMarketStore() {
  // Non-reactive lifecycle state: not renderable, so it stays out of Zustand.
  let timer: ReturnType<typeof setInterval> | null = null;
  let startedAt = 0;

  return createStore<MarketState>()((set, get) => {
    const evaluateStatus = () => {
      const next = computeFeedStatus(get().lastTickAt, Date.now(), startedAt);
      if (next !== get().status) {
        set({ status: next });
      }
    };

    return {
      quotes: new Map<string, Quote>(),
      lastSeq: {},
      lastTickAt: 0,
      status: 'connecting',

      applyTick: (tick) => {
        if (!tick.symbol || !Number.isInteger(tick.seq) || tick.seq <= 0) {
          return false;
        }

        const { quotes, lastSeq } = get();
        if (tick.seq <= (lastSeq[tick.symbol] ?? 0)) {
          return false;
        }

        const previous = quotes.get(tick.symbol);
        const ltpPaise = isPositiveFinite(tick.ltp)
          ? toPaise(tick.ltp)
          : previous?.ltpPaise;

        if (ltpPaise === undefined) {
          // Advance the guard even without a price, so a replay cannot
          // resurrect an older quote later.
          set({ lastSeq: { ...lastSeq, [tick.symbol]: tick.seq } });
          return false;
        }

        const quote: Quote = {
          symbol: tick.symbol,
          ltpPaise,
          openPaise: previous?.openPaise ?? null,
          prevClosePaise: previous?.prevClosePaise ?? null,
          highPaise: isPositiveFinite(tick.high)
            ? toPaise(tick.high)
            : (previous?.highPaise ?? null),
          lowPaise: isPositiveFinite(tick.low)
            ? toPaise(tick.low)
            : (previous?.lowPaise ?? null),
          volume: isNonNegativeFinite(tick.volume)
            ? Math.round(tick.volume)
            : (previous?.volume ?? null),
          seq: tick.seq,
          updatedAt: Date.now(),
        };

        const nextQuotes = new Map(quotes);
        nextQuotes.set(tick.symbol, quote);

        set({
          quotes: nextQuotes,
          lastSeq: { ...lastSeq, [tick.symbol]: tick.seq },
          lastTickAt: quote.updatedAt,
        });
        return true;
      },

      applyBaseline: (baseline) => {
        const { quotes, lastSeq } = get();
        const nextQuotes = new Map(quotes);
        const nextSeq = { ...lastSeq };

        for (const incoming of baseline) {
          const previousSeq = nextSeq[incoming.symbol];
          const incomingSeq = Number.isInteger(incoming.seq)
            ? incoming.seq
            : 0;
          const seq =
            previousSeq === undefined
              ? incomingSeq
              : Math.max(previousSeq, incomingSeq);

          nextSeq[incoming.symbol] = seq;
          nextQuotes.set(incoming.symbol, {
            ...incoming,
            seq,
            updatedAt: Date.now(),
          });
        }

        set({ quotes: nextQuotes, lastSeq: nextSeq });
      },

      startStatusPolling: () => {
        if (timer !== null) {
          return;
        }
        startedAt = Date.now();
        set({ status: 'connecting' });
        evaluateStatus();
        timer = setInterval(evaluateStatus, STATUS_POLL_MS);
      },

      stopStatusPolling: () => {
        if (timer !== null) {
          clearInterval(timer);
        }
        timer = null;
        set({ status: 'connecting' });
      },
    };
  });
}

export const marketStore = createMarketStore();

export const useQuote = (symbol: string): Quote | undefined =>
  useStore(marketStore, (state) => state.quotes.get(symbol));

export const useFeedStatus = (): FeedStatus =>
  useStore(marketStore, (state) => state.status);

/**
 * Coalesces the global 20/s tick stream into a version counter. Components that
 * depend on many symbols (summary, sort order) re-render at this cadence
 * instead of on every tick.
 */
export function useMarketVersion(intervalMs: number): number {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let lastBump = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const bump = (): void => {
      lastBump = Date.now();
      setVersion((current) => current + 1);
    };

    const unsubscribe = marketStore.subscribe(() => {
      const elapsed = Date.now() - lastBump;
      if (elapsed >= intervalMs) {
        bump();
        return;
      }
      if (timer === null) {
        timer = setTimeout(() => {
          timer = null;
          bump();
        }, intervalMs - elapsed);
      }
    });

    return () => {
      unsubscribe();
      if (timer !== null) {
        clearTimeout(timer);
      }
    };
  }, [intervalMs]);

  return version;
}
