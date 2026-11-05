import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { fetchQuotes } from '../api/liquide';
import { ALLOWED_SYMBOLS } from '../domain/seed';
import { feedStatusStore } from '../feed/feedStatus';
import { createTickSimulator, type TickSimulator } from '../feed/simulator';
import { marketStore } from '../store/marketStore';
import { portfolioStore } from '../store/portfolioStore';
import { watchlistStore } from '../store/watchlistStore';

export type BootstrapStatus = 'loading' | 'error' | 'ready';

export interface MarketBootstrapValue {
  status: BootstrapStatus;
  /** Blocking error shown when the initial fetch cannot produce a usable feed. */
  error: string | null;
  retry: () => void;
  /** Pull-to-refresh: refetch the baseline without stopping live ticks. */
  refresh: () => Promise<void>;
  refreshing: boolean;
  /** Non-blocking error shown above the list when a refresh fails. */
  refreshError: string | null;
}

const MarketBootstrapContext = createContext<MarketBootstrapValue | null>(null);

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return 'Something went wrong while loading prices. Please try again.';
}

/**
 * Startup sequence:
 *   hydrate local state -> fetch the REST baseline once -> seed MarketStore
 *   -> connect the feed -> render.
 *
 * The shared test API is never polled; it is only called here and on an explicit
 * pull-to-refresh.
 */
export function MarketBootstrapProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<BootstrapStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const simulatorRef = useRef<TickSimulator | null>(null);
  const simulatorUnsubscribeRef = useRef<(() => void) | null>(null);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);
  const refreshingRef = useRef(false);
  const statusRef = useRef<BootstrapStatus>('loading');

  statusRef.current = status;

  const bootstrap = useCallback(async (): Promise<void> => {
    const requestId = ++requestIdRef.current;
    setStatus('loading');
    setError(null);

    try {
      await Promise.all([portfolioStore.hydrate(), watchlistStore.hydrate()]);
      const quotes = await fetchQuotes(ALLOWED_SYMBOLS);

      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return;
      }
      if (quotes.length === 0) {
        throw new Error(
          'No prices were returned. The market feed may be unavailable.',
        );
      }

      marketStore.applyBaseline(quotes);
      feedStatusStore.start();

      const existing = simulatorRef.current;
      if (existing) {
        existing.updateBaseline(quotes);
        existing.connect();
      } else {
        const simulator = createTickSimulator({ baseline: quotes });
        simulatorRef.current = simulator;
        // The feed only emits ticks; this is the single place that feeds them
        // into the store, which then fans out per-symbol updates.
        simulatorUnsubscribeRef.current = simulator.onTick((tick) => {
          marketStore.applyTick(tick);
        });
        simulator.connect();
      }

      setStatus('ready');
    } catch (caught) {
      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return;
      }
      setError(toErrorMessage(caught));
      setStatus('error');
      feedStatusStore.stop();
    }
  }, []);

  const retry = useCallback((): void => {
    void bootstrap();
  }, [bootstrap]);

  const refresh = useCallback(async (): Promise<void> => {
    if (refreshingRef.current) {
      return;
    }
    refreshingRef.current = true;
    setRefreshing(true);
    setRefreshError(null);

    try {
      const quotes = await fetchQuotes(ALLOWED_SYMBOLS);
      if (!mountedRef.current) {
        return;
      }
      if (quotes.length === 0) {
        throw new Error(
          'No prices were returned. The market feed may be unavailable.',
        );
      }

      marketStore.applyBaseline(quotes);
      const simulator = simulatorRef.current;
      if (simulator) {
        simulator.updateBaseline(quotes);
        simulator.connect();
      }
      feedStatusStore.start();
    } catch (caught) {
      if (mountedRef.current) {
        setRefreshError(toErrorMessage(caught));
      }
    } finally {
      refreshingRef.current = false;
      if (mountedRef.current) {
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void bootstrap();

    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
      simulatorRef.current?.disconnect();
      simulatorUnsubscribeRef.current?.();
      simulatorUnsubscribeRef.current = null;
      simulatorRef.current = null;
      feedStatusStore.stop();
    };
  }, [bootstrap]);

  // Timers are throttled in the background, so stop the fake socket there and
  // reconnect when the app is active again.
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState === 'active') {
          if (statusRef.current === 'ready' && simulatorRef.current) {
            simulatorRef.current.connect();
            feedStatusStore.start();
          }
        } else {
          simulatorRef.current?.disconnect();
          feedStatusStore.stop();
        }
      },
    );

    return () => {
      subscription.remove();
    };
  }, []);

  const value = useMemo<MarketBootstrapValue>(
    () => ({
      status,
      error,
      retry,
      refresh,
      refreshing,
      refreshError,
    }),
    [status, error, retry, refresh, refreshing, refreshError],
  );

  return (
    <MarketBootstrapContext.Provider value={value}>
      {children}
    </MarketBootstrapContext.Provider>
  );
}

export function useMarketBootstrap(): MarketBootstrapValue {
  const value = useContext(MarketBootstrapContext);
  if (!value) {
    throw new Error('useMarketBootstrap must be used inside MarketBootstrapProvider');
  }
  return value;
}
