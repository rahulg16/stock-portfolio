import type { FeedStatus } from '../../domain/types';
import { MarketStore } from '../../store/marketStore';
import {
  FeedStatusStore,
  computeFeedStatus,
} from '../feedStatus';

describe('computeFeedStatus', () => {
  it('reports live while ticks are recent', () => {
    expect(computeFeedStatus(1000, 2000, 0)).toBe('live');
  });

  it('reports connecting during the grace period after starting', () => {
    expect(computeFeedStatus(0, 1000, 0)).toBe('connecting');
    expect(computeFeedStatus(0, 20_000, 19_900)).toBe('connecting');
  });

  it('reports paused for a temporary silence', () => {
    expect(computeFeedStatus(1000, 3000, 0)).toBe('paused');
  });

  it('reports stale for a prolonged silence', () => {
    expect(computeFeedStatus(1000, 12_000, 0)).toBe('stale');
    expect(computeFeedStatus(0, 20_000, 0)).toBe('stale');
  });

  it('respects custom thresholds', () => {
    expect(
      computeFeedStatus(1000, 1500, 0, {
        pausedAfterMs: 400,
        staleAfterMs: 2000,
      }),
    ).toBe('paused');
  });
});

describe('FeedStatusStore', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('notifies only when the status transitions', () => {
    const store = new MarketStore();
    const statusStore = new FeedStatusStore(store, {
      pollMs: 500,
      pausedAfterMs: 1000,
      staleAfterMs: 5000,
    });
    const seen: FeedStatus[] = [];
    statusStore.subscribe(() => seen.push(statusStore.getStatus()));

    expect(statusStore.getStatus()).toBe('connecting');
    statusStore.start();
    expect(statusStore.getStatus()).toBe('connecting');

    store.applyTick({ symbol: 'TCS', seq: 1, ltp: 100 });
    jest.advanceTimersByTime(500);
    expect(statusStore.getStatus()).toBe('live');

    jest.advanceTimersByTime(2000);
    expect(statusStore.getStatus()).toBe('paused');

    jest.advanceTimersByTime(6000);
    expect(statusStore.getStatus()).toBe('stale');

    // No duplicate notifications for repeated polls in the same state.
    jest.advanceTimersByTime(1000);
    expect(seen).toEqual(['live', 'paused', 'stale']);

    statusStore.stop();
    expect(statusStore.getStatus()).toBe('connecting');
    expect(seen[seen.length - 1]).toBe('connecting');
  });
});
