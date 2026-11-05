import type { FeedStatus } from '../domain/types';
import { MarketStore, marketStore } from '../store/marketStore';

export const PAUSED_AFTER_MS = 1500;
export const STALE_AFTER_MS = 10_000;
export const STATUS_POLL_MS = 500;

export interface FeedStatusThresholds {
  pausedAfterMs?: number;
  staleAfterMs?: number;
}

/**
 * Derives a user-facing status from tick silence. A 5-second simulator gap is
 * "paused"; a much longer gap is "stale", so the UI can distinguish a known
 * feed gap from a broken connection.
 */
export function computeFeedStatus(
  lastTickAt: number,
  now: number,
  startedAt: number,
  thresholds: FeedStatusThresholds = {},
): FeedStatus {
  const pausedAfterMs = thresholds.pausedAfterMs ?? PAUSED_AFTER_MS;
  const staleAfterMs = thresholds.staleAfterMs ?? STALE_AFTER_MS;
  const age = lastTickAt === 0 ? Number.POSITIVE_INFINITY : now - lastTickAt;
  const sinceStart = now - startedAt;

  if (age < pausedAfterMs) {
    return 'live';
  }
  if (sinceStart < pausedAfterMs) {
    return 'connecting';
  }
  return age < staleAfterMs ? 'paused' : 'stale';
}

type Listener = () => void;

/**
 * Polls silence rather than ticks, and only notifies when the status actually
 * transitions. That keeps the banner out of the 20 ticks/second render path.
 */
export class FeedStatusStore {
  private status: FeedStatus = 'connecting';
  private listeners = new Set<Listener>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private startedAt = 0;
  private readonly store: MarketStore;
  private readonly now: () => number;
  private readonly thresholds: FeedStatusThresholds;
  private readonly pollMs: number;

  constructor(
    store: MarketStore = marketStore,
    options: FeedStatusThresholds & {
      now?: () => number;
      pollMs?: number;
    } = {},
  ) {
    this.store = store;
    this.now = options.now ?? Date.now;
    this.thresholds = options;
    this.pollMs = options.pollMs ?? STATUS_POLL_MS;
  }

  getStatus(): FeedStatus {
    return this.status;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  start(): void {
    if (this.timer !== null) {
      return;
    }
    this.startedAt = this.now();
    this.setStatus('connecting');
    this.evaluate();
    this.timer = setInterval(() => this.evaluate(), this.pollMs);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.setStatus('connecting');
  }

  /** Exposed for tests and for an immediate refresh after a manual reconnect. */
  evaluate(): void {
    this.setStatus(
      computeFeedStatus(
        this.store.getLastTickAt(),
        this.now(),
        this.startedAt,
        this.thresholds,
      ),
    );
  }

  private setStatus(next: FeedStatus): void {
    if (next === this.status) {
      return;
    }
    this.status = next;
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const feedStatusStore = new FeedStatusStore();
