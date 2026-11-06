import AsyncStorage from '@react-native-async-storage/async-storage';
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ALLOWED_SYMBOL_SET } from '../domain/seed';
import { safeStorage, withLegacyFormat, type StorageLike } from './storage';

export const WATCHLIST_STORAGE_KEY = 'stockportfolio.watchlist.v1';

function parseWatchlist(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const symbols: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (
      typeof entry === 'string' &&
      ALLOWED_SYMBOL_SET.has(entry) &&
      !seen.has(entry)
    ) {
      seen.add(entry);
      symbols.push(entry);
    }
  }
  return symbols;
}

export interface WatchlistState {
  symbols: string[];
  add: (symbol: string) => boolean;
  remove: (symbol: string) => void;
}

/**
 * Persisted watchlist symbols. Prices are not stored here; rows read live
 * quotes from `marketStore`.
 */
export function createWatchlistStore(storage: StorageLike = AsyncStorage) {
  return createStore<WatchlistState>()(
    persist(
      (set, get) => ({
        symbols: [],

        add: (symbol) => {
          const { symbols } = get();
          if (!ALLOWED_SYMBOL_SET.has(symbol) || symbols.includes(symbol)) {
            return false;
          }
          set({ symbols: [...symbols, symbol] });
          return true;
        },

        remove: (symbol) => {
          const { symbols } = get();
          if (!symbols.includes(symbol)) {
            return;
          }
          set({ symbols: symbols.filter((existing) => existing !== symbol) });
        },
      }),
      {
        name: WATCHLIST_STORAGE_KEY,
        version: 1,
        storage: createJSONStorage(() =>
          withLegacyFormat(safeStorage(storage), (legacy) => ({
            symbols: legacy,
          })),
        ),
        skipHydration: true,
        partialize: (state) => ({ symbols: state.symbols }),
        merge: (persisted, current) => ({
          ...current,
          symbols: parseWatchlist(
            (persisted as { symbols?: unknown } | undefined)?.symbols,
          ),
        }),
      },
    ),
  );
}

export const watchlistStore = createWatchlistStore();

export const useWatchlist = (): readonly string[] =>
  useStore(watchlistStore, (state) => state.symbols);
