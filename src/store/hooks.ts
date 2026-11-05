import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { calculateSummary } from '../domain/calculations';
import type {
  FeedStatus,
  Holding,
  PortfolioSummary,
  Quote,
} from '../domain/types';
import { feedStatusStore } from '../feed/feedStatus';
import { marketStore } from './marketStore';
import { portfolioStore } from './portfolioStore';
import { watchlistStore } from './watchlistStore';

/** Summary and other aggregates refresh at most this often. */
export const SUMMARY_INTERVAL_MS = 250;
/** Sort order changes at most this often so live prices do not make rows jump. */
export const SORT_INTERVAL_MS = 1000;

const subscribeHoldings = (listener: () => void): (() => void) =>
  portfolioStore.subscribe(listener);
const getHoldingsSnapshot = (): readonly Holding[] =>
  portfolioStore.getHoldings();

const subscribeWatchlist = (listener: () => void): (() => void) =>
  watchlistStore.subscribe(listener);
const getWatchlistSnapshot = (): readonly string[] =>
  watchlistStore.getSymbols();

const subscribeFeedStatus = (listener: () => void): (() => void) =>
  feedStatusStore.subscribe(listener);
const getFeedStatusSnapshot = (): FeedStatus => feedStatusStore.getStatus();

/**
 * Subscribes to one symbol only. A RELIANCE tick re-renders RELIANCE consumers
 * and nothing else, which is the core of the 20 ticks/second strategy.
 */
export function useQuote(symbol: string): Quote | undefined {
  const subscribe = useCallback(
    (listener: () => void) => marketStore.subscribeSymbol(symbol, listener),
    [symbol],
  );
  const getSnapshot = useCallback(
    () => marketStore.getQuote(symbol),
    [symbol],
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useHoldings(): readonly Holding[] {
  return useSyncExternalStore(
    subscribeHoldings,
    getHoldingsSnapshot,
    getHoldingsSnapshot,
  );
}

export function useWatchlist(): readonly string[] {
  return useSyncExternalStore(
    subscribeWatchlist,
    getWatchlistSnapshot,
    getWatchlistSnapshot,
  );
}

export function useFeedStatus(): FeedStatus {
  return useSyncExternalStore(
    subscribeFeedStatus,
    getFeedStatusSnapshot,
    getFeedStatusSnapshot,
  );
}

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

/** Portfolio totals derived from the same integer paise values rows display. */
export function useSummary(holdings: readonly Holding[]): PortfolioSummary {
  const version = useMarketVersion(SUMMARY_INTERVAL_MS);
  return useMemo(
    () => calculateSummary(holdings, marketStore.getQuotes()),
    [holdings, version],
  );
}
