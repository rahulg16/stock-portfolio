import type { Quote, Tick } from '../domain/types';
import { toPaise } from '../domain/money';

type Listener = () => void;

function isPositiveFinite(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value > 0;
}

function isNonNegativeFinite(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value >= 0;
}

/**
 * Holds live quotes and fans out changes per symbol.
 *
 * A tick for RELIANCE notifies only RELIANCE subscribers. Global subscribers
 * (aggregates, feed status) are notified separately and are expected to
 * coalesce their own updates.
 */
export class MarketStore {
  private quotes = new Map<string, Quote>();
  private lastSeq = new Map<string, number>();
  private symbolListeners = new Map<string, Set<Listener>>();
  private globalListeners = new Set<Listener>();
  private lastTickAt = 0;

  getQuote(symbol: string): Quote | undefined {
    return this.quotes.get(symbol);
  }

  getQuotes(): ReadonlyMap<string, Quote> {
    return this.quotes;
  }

  getLastTickAt(): number {
    return this.lastTickAt;
  }

  subscribeSymbol(symbol: string, listener: Listener): () => void {
    let listeners = this.symbolListeners.get(symbol);
    if (!listeners) {
      listeners = new Set();
      this.symbolListeners.set(symbol, listeners);
    }
    listeners.add(listener);
    return () => {
      listeners?.delete(listener);
    };
  }

  /** Subscribes to every symbol change; used by throttled aggregates only. */
  subscribe(listener: Listener): () => void {
    this.globalListeners.add(listener);
    return () => {
      this.globalListeners.delete(listener);
    };
  }

  /**
   * Applies a partial tick. Returns false for stale or unusable ticks.
   *
   * - Sequence guard is per symbol, not global.
   * - Only fields present on the tick overwrite the quote.
   * - Rupee values are converted to integer paise at this boundary.
   */
  applyTick(tick: Tick): boolean {
    if (!tick.symbol || !Number.isInteger(tick.seq) || tick.seq <= 0) {
      return false;
    }

    const previousSeq = this.lastSeq.get(tick.symbol) ?? 0;
    if (tick.seq <= previousSeq) {
      return false;
    }
    this.lastSeq.set(tick.symbol, tick.seq);

    const previous = this.quotes.get(tick.symbol);
    const ltpPaise = isPositiveFinite(tick.ltp)
      ? toPaise(tick.ltp)
      : previous?.ltpPaise;

    if (ltpPaise === undefined) {
      // Nothing to price yet. The sequence guard has still advanced so an
      // older tick for this symbol can never resurrect a price later.
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

    this.quotes.set(tick.symbol, quote);
    this.lastTickAt = quote.updatedAt;
    this.notifySymbol(tick.symbol);
    this.notifyGlobal();
    return true;
  }

  /**
   * Merges a REST snapshot (pull-to-refresh / startup) without resetting the
   * sequence guard, so in-flight ticks can still be ordered correctly.
   */
  applyBaseline(baseline: readonly Quote[]): void {
    const touched = new Set<string>();

    for (const incoming of baseline) {
      const previousSeq = this.lastSeq.get(incoming.symbol);
      const incomingSeq = Number.isInteger(incoming.seq) ? incoming.seq : 0;
      const seq = previousSeq === undefined ? incomingSeq : Math.max(previousSeq, incomingSeq);

      if (previousSeq === undefined) {
        this.lastSeq.set(incoming.symbol, seq);
      }

      this.quotes.set(incoming.symbol, {
        ...incoming,
        seq,
        updatedAt: Date.now(),
      });
      touched.add(incoming.symbol);
    }

    for (const symbol of touched) {
      this.notifySymbol(symbol);
    }
    if (touched.size > 0) {
      this.notifyGlobal();
    }
  }

  private notifySymbol(symbol: string): void {
    const listeners = this.symbolListeners.get(symbol);
    if (!listeners) return;
    for (const listener of listeners) {
      listener();
    }
  }

  private notifyGlobal(): void {
    for (const listener of this.globalListeners) {
      listener();
    }
  }
}

/** App-wide live market store. Tests instantiate MarketStore directly. */
export const marketStore = new MarketStore();
