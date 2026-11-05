import AsyncStorage from '@react-native-async-storage/async-storage';
import { createStartingHoldings } from '../domain/seed';
import { executeOrder } from '../domain/orders';
import type { Holding, MoneyPaise, OrderSide } from '../domain/types';

export const HOLDINGS_STORAGE_KEY = 'stockportfolio.holdings.v1';

type Listener = () => void;

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

/**
 * Owns holdings, order execution and persistence. The store exposes a stable
 * array reference that only changes when holdings actually change, so row
 * components are not re-rendered by price ticks.
 */
export class PortfolioStore {
  private holdings: Holding[] = createStartingHoldings();
  private listeners = new Set<Listener>();
  private hydration: Promise<void> | null = null;
  private persistQueue: Promise<void> = Promise.resolve();
  private storage: Pick<typeof AsyncStorage, 'getItem' | 'setItem'>;

  constructor(storage: Pick<typeof AsyncStorage, 'getItem' | 'setItem'> = AsyncStorage) {
    this.storage = storage;
  }

  getHoldings(): readonly Holding[] {
    return this.holdings;
  }

  getHolding(symbol: string): Holding | undefined {
    return this.holdings.find((holding) => holding.symbol === symbol);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Loads persisted holdings. A missing key means first launch, so the bundled
   * starting holdings are kept. A malformed value falls back to the bundle.
   */
  hydrate(): Promise<void> {
    if (this.hydration) {
      return this.hydration;
    }

    this.hydration = (async () => {
      try {
        const raw = await this.storage.getItem(HOLDINGS_STORAGE_KEY);
        if (raw === null) {
          this.holdings = createStartingHoldings();
          return;
        }

        let decoded: unknown;
        try {
          decoded = JSON.parse(raw);
        } catch {
          this.holdings = createStartingHoldings();
          this.notify();
          return;
        }

        const parsed = parseHoldings(decoded);
        this.holdings = parsed ?? createStartingHoldings();
        this.notify();
      } catch {
        this.holdings = createStartingHoldings();
        this.notify();
      }
    })();

    return this.hydration;
  }

  /**
   * Executes a local fill against the latest holdings, notifies subscribers and
   * queues a persistence write. Persistence failures never block the UI.
   */
  applyOrder(
    symbol: string,
    side: OrderSide,
    qty: number,
    fillPricePaise: MoneyPaise,
  ): void {
    this.holdings = executeOrder(this.holdings, symbol, side, qty, fillPricePaise);
    this.notify();
    this.persist();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private persist(): void {
    const payload = JSON.stringify(this.holdings);
    this.persistQueue = this.persistQueue
      .then(() => this.storage.setItem(HOLDINGS_STORAGE_KEY, payload))
      .catch(() => {
        // Persistence is best effort; the in-memory state stays authoritative.
      });
  }
}

export const portfolioStore = new PortfolioStore();
