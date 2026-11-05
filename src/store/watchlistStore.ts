import AsyncStorage from '@react-native-async-storage/async-storage';
import { ALLOWED_SYMBOL_SET } from '../domain/seed';

export const WATCHLIST_STORAGE_KEY = 'stockportfolio.watchlist.v1';

type Listener = () => void;

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

/**
 * Owns the persisted watchlist symbols. Prices are not stored here; rows read
 * live quotes from MarketStore.
 */
export class WatchlistStore {
  private symbols: string[] = [];
  private listeners = new Set<Listener>();
  private hydration: Promise<void> | null = null;
  private persistQueue: Promise<void> = Promise.resolve();
  private storage: Pick<typeof AsyncStorage, 'getItem' | 'setItem'>;

  constructor(storage: Pick<typeof AsyncStorage, 'getItem' | 'setItem'> = AsyncStorage) {
    this.storage = storage;
  }

  getSymbols(): readonly string[] {
    return this.symbols;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  hydrate(): Promise<void> {
    if (this.hydration) {
      return this.hydration;
    }

    this.hydration = (async () => {
      try {
        const raw = await this.storage.getItem(WATCHLIST_STORAGE_KEY);
        if (raw === null) {
          this.symbols = [];
          return;
        }
        let decoded: unknown;
        try {
          decoded = JSON.parse(raw);
        } catch {
          this.symbols = [];
          this.notify();
          return;
        }
        this.symbols = parseWatchlist(decoded);
        this.notify();
      } catch {
        this.symbols = [];
        this.notify();
      }
    })();

    return this.hydration;
  }

  /** Adds a symbol; returns false when it is invalid or already present. */
  add(symbol: string): boolean {
    if (!ALLOWED_SYMBOL_SET.has(symbol) || this.symbols.includes(symbol)) {
      return false;
    }
    this.symbols = [...this.symbols, symbol];
    this.notify();
    this.persist();
    return true;
  }

  remove(symbol: string): void {
    if (!this.symbols.includes(symbol)) {
      return;
    }
    this.symbols = this.symbols.filter((existing) => existing !== symbol);
    this.notify();
    this.persist();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private persist(): void {
    const payload = JSON.stringify(this.symbols);
    this.persistQueue = this.persistQueue
      .then(() => this.storage.setItem(WATCHLIST_STORAGE_KEY, payload))
      .catch(() => {
        // Best effort; in-memory state remains authoritative for the session.
      });
  }
}

export const watchlistStore = new WatchlistStore();
