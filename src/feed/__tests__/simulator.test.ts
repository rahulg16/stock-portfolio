import type { Quote, Tick } from '../../domain/types';
import { TickSimulator, createTickSimulator } from '../simulator';

function makeQuote(symbol: string, ltpPaise = 100000): Quote {
  return {
    symbol,
    ltpPaise,
    openPaise: 99000,
    prevClosePaise: 98000,
    highPaise: 101000,
    lowPaise: 97000,
    volume: 1000,
    seq: 0,
    updatedAt: 0,
  };
}

function collect(simulator: TickSimulator): Tick[] {
  const ticks: Tick[] = [];
  simulator.onTick((tick) => ticks.push(tick));
  return ticks;
}

describe('TickSimulator', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('emits about 20 ticks per second globally', () => {
    const simulator = createTickSimulator({
      baseline: [makeQuote('RELIANCE')],
      rng: () => 0.5,
    });
    const ticks = collect(simulator);

    simulator.connect();
    jest.advanceTimersByTime(1000);

    expect(ticks).toHaveLength(20);
    simulator.disconnect();
  });

  it('distributes ticks across the baseline symbols', () => {
    const simulator = createTickSimulator({
      baseline: [makeQuote('RELIANCE'), makeQuote('TCS')],
    });
    const ticks = collect(simulator);

    simulator.connect();
    jest.advanceTimersByTime(5000);
    simulator.disconnect();

    const symbols = new Set(ticks.map((tick) => tick.symbol));
    expect(symbols.has('RELIANCE')).toBe(true);
    expect(symbols.has('TCS')).toBe(true);
  });

  it('increments seq per symbol, not globally', () => {
    const simulator = createTickSimulator({
      baseline: [makeQuote('RELIANCE')],
      rng: () => 0.5,
    });
    const ticks = collect(simulator);

    simulator.connect();
    jest.advanceTimersByTime(250);

    expect(ticks.map((tick) => tick.seq)).toEqual([1, 2, 3, 4, 5]);
    simulator.disconnect();
  });

  it('emits partial ticks containing only changed fields', () => {
    const simulator = createTickSimulator({
      baseline: [makeQuote('RELIANCE')],
      rng: () => 0.5,
    });
    const ticks = collect(simulator);

    simulator.connect();
    jest.advanceTimersByTime(250);

    expect(ticks).toHaveLength(5);
    for (const tick of ticks) {
      expect(Object.keys(tick).sort()).toEqual(['ltp', 'seq', 'symbol']);
      expect(tick.ltp).toBe(1000);
    }
    simulator.disconnect();
  });

  it('replays an older tick after a newer one when stale injection triggers', () => {
    const simulator = createTickSimulator({
      baseline: [makeQuote('RELIANCE')],
      rng: () => 0.5,
      staleRate: 1,
    });
    const ticks = collect(simulator);

    simulator.connect();
    jest.advanceTimersByTime(150);

    const maxSeen = new Map<string, number>();
    let foundStale = false;
    for (const tick of ticks) {
      const previous = maxSeen.get(tick.symbol) ?? 0;
      if (tick.seq <= previous) {
        foundStale = true;
      }
      maxSeen.set(tick.symbol, Math.max(previous, tick.seq));
    }

    expect(foundStale).toBe(true);
    simulator.disconnect();
  });

  it('goes silent for the configured pause and then resumes', () => {
    const simulator = createTickSimulator({
      baseline: [makeQuote('RELIANCE')],
      rng: () => 0.5,
      pauseIntervalMs: 100,
      pauseDurationMs: 5000,
    });
    const ticks = collect(simulator);

    simulator.connect();
    jest.advanceTimersByTime(100);
    const beforePause = ticks.length;
    expect(beforePause).toBeGreaterThan(0);

    jest.advanceTimersByTime(4900);
    expect(ticks.length).toBe(beforePause);

    jest.advanceTimersByTime(300);
    expect(ticks.length).toBeGreaterThan(beforePause);

    simulator.disconnect();
  });

  it('stops emitting after disconnect', () => {
    const simulator = createTickSimulator({
      baseline: [makeQuote('RELIANCE')],
      rng: () => 0.5,
    });
    const ticks = collect(simulator);

    simulator.connect();
    jest.advanceTimersByTime(200);
    const count = ticks.length;
    simulator.disconnect();
    jest.advanceTimersByTime(1000);

    expect(ticks.length).toBe(count);
  });

  it('stops notifying unsubscribed handlers', () => {
    const simulator = createTickSimulator({
      baseline: [makeQuote('RELIANCE')],
      rng: () => 0.5,
    });
    const ticks: Tick[] = [];
    const unsubscribe = simulator.onTick((tick) => ticks.push(tick));

    simulator.connect();
    jest.advanceTimersByTime(100);
    unsubscribe();
    const count = ticks.length;
    jest.advanceTimersByTime(100);

    expect(ticks.length).toBe(count);
    simulator.disconnect();
  });

  it('starts ticking symbols added by a refreshed baseline', () => {
    const simulator = createTickSimulator({
      baseline: [makeQuote('TCS')],
      rng: () => 0.5,
    });
    const ticks = collect(simulator);

    simulator.connect();
    simulator.updateBaseline([makeQuote('TCS'), makeQuote('RELIANCE')]);
    jest.advanceTimersByTime(500);

    expect(ticks.some((tick) => tick.symbol === 'RELIANCE')).toBe(true);
    simulator.disconnect();
  });
});
