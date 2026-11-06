import AsyncStorage from '@react-native-async-storage/async-storage';
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createStartingHoldings } from '../domain/seed';
import { executeOrder } from '../domain/orders';
import type { Holding, MoneyPaise, OrderSide } from '../domain/types';
import { safeStorage, withLegacyFormat, type StorageLike } from './storage';

export const HOLDINGS_STORAGE_KEY = 'stockportfolio.holdings.v1';

function parseHoldings(value: unknown): Holding[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const parsed: Holding[] = [];
  const seen = new Set<string>();

  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) {
      return null;
    }
    const record = entry as Record<string, unknown>;
    const { symbol, qty, avgPricePaise } = record;

    if (
      typeof symbol !== 'string' ||
      symbol.length === 0 ||
      typeof qty !== 'number' ||
      !Number.isSafeInteger(qty) ||
      qty <= 0 ||
      typeof avgPricePaise !== 'number' ||
      !Number.isSafeInteger(avgPricePaise) ||
      avgPricePaise < 0 ||
      seen.has(symbol)
    ) {
      return null;
    }

    seen.add(symbol);
    parsed.push({ symbol, qty, avgPricePaise });
  }

  return parsed;
}

export interface PortfolioState {
  holdings: Holding[];
  applyOrder: (
    symbol: string,
    side: OrderSide,
    qty: number,
    fillPricePaise: MoneyPaise,
  ) => void;
}

/**
 * Holdings, order execution and persistence.
 *
 * `holdings` is replaced only when a trade happens, so price ticks never
 * re-render portfolio rows. Persistence is declared through `persist`; the
 * `merge` validator keeps the bundled holdings when stored data is malformed.
 */
export function createPortfolioStore(storage: StorageLike = AsyncStorage) {
  return createStore<PortfolioState>()(
    persist(
      (set) => ({
        holdings: createStartingHoldings(),

        applyOrder: (symbol, side, qty, fillPricePaise) => {
          set((state) => ({
            holdings: executeOrder(
              state.holdings,
              symbol,
              side,
              qty,
              fillPricePaise,
            ),
          }));
        },
      }),
      {
        name: HOLDINGS_STORAGE_KEY,
        version: 1,
        storage: createJSONStorage(() =>
          withLegacyFormat(safeStorage(storage), (legacy) => ({
            holdings: legacy,
          })),
        ),
        skipHydration: true,
        partialize: (state) => ({ holdings: state.holdings }),
        merge: (persisted, current) => ({
          ...current,
          holdings:
            parseHoldings(
              (persisted as { holdings?: unknown } | undefined)?.holdings,
            ) ?? createStartingHoldings(),
        }),
      },
    ),
  );
}

export const portfolioStore = createPortfolioStore();

export const useHoldings = (): readonly Holding[] =>
  useStore(portfolioStore, (state) => state.holdings);

export const useHolding = (symbol: string): Holding | undefined =>
  useStore(portfolioStore, (state) =>
    state.holdings.find((holding) => holding.symbol === symbol),
  );
