import { fromPaise } from '../domain/money';
import type { Quote, Tick } from '../domain/types';
import type { PriceFeed, TickHandler, TickSimulatorOptions } from './types';

interface SymbolState {
  ltpPaise: number;
  highPaise: number | null;
  lowPaise: number | null;
  volume: number;
  seq: number;
  /** Last emitted tick, replayed occasionally to simulate a stale update. */
  lastTick: Tick | null;
}

const DEFAULT_INTERVAL_MS = 50;
const DEFAULT_STALE_RATE = 0.02;
const DEFAULT_PAUSE_DURATION_MS = 5000;

/**
 * A socket-shaped fake feed.
 *
 * It emits one partial tick every 50 ms (≈20/s across all symbols), replays an
 * occasional older tick, and goes silent for 5 seconds every 60–90 seconds.
 * The app consumes only the PriceFeed interface, so replacing this with a real
 * socket requires no UI changes.
 */
export interface TickSimulator extends PriceFeed {
  /** Refreshes the running state from a REST snapshot (pull-to-refresh). */
  updateBaseline(quotes: readonly Quote[]): void;
}

export function createTickSimulator(
  options: TickSimulatorOptions,
): TickSimulator {
  const states = new Map<string, SymbolState>();
  const handlers = new Set<TickHandler>();

  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const staleRate = options.staleRate ?? DEFAULT_STALE_RATE;
  const pauseDurationMs = options.pauseDurationMs ?? DEFAULT_PAUSE_DURATION_MS;
  const rng = options.rng ?? Math.random;

  let interval: ReturnType<typeof setInterval> | null = null;
  let pauseTimer: ReturnType<typeof setTimeout> | null = null;
  let paused = false;

  const seed = (quote: Quote): void => {
    states.set(quote.symbol, {
      ltpPaise: quote.ltpPaise,
      highPaise: quote.highPaise,
      lowPaise: quote.lowPaise,
      volume: quote.volume ?? 0,
      seq: quote.seq,
      lastTick: null,
    });
  };

  const pauseGap = (): number => {
    const configured = options.pauseIntervalMs;
    if (typeof configured === 'function') {
      return configured();
    }
    return configured ?? 60_000 + rng() * 30_000;
  };

  // The pause and the resume phases never overlap, so one timer is enough.
  const schedulePause = (): void => {
    pauseTimer = setTimeout(() => {
      paused = true;
      pauseTimer = setTimeout(() => {
        paused = false;
        pauseTimer = null;
        if (interval !== null) {
          schedulePause();
        }
      }, pauseDurationMs);
    }, pauseGap());
  };

  const emit = (tick: Tick): void => {
    for (const handler of handlers) {
      handler(tick);
    }
  };

  const emitTick = (): void => {
    if (paused) {
      return;
    }

    const symbols = Array.from(states.keys());
    if (symbols.length === 0) {
      return;
    }

    const symbol =
      symbols[Math.min(symbols.length - 1, Math.floor(rng() * symbols.length))];
    if (symbol === undefined) {
      return;
    }
    const state = states.get(symbol);
    if (!state) {
      return;
    }

    const movement = (rng() * 2 - 1) * 0.002;
    const nextLtpPaise = Math.max(1, Math.round(state.ltpPaise * (1 + movement)));

    state.seq += 1;
    const tick: Tick = { symbol, seq: state.seq, ltp: fromPaise(nextLtpPaise) };

    if (state.highPaise === null || nextLtpPaise > state.highPaise) {
      state.highPaise = nextLtpPaise;
      tick.high = fromPaise(nextLtpPaise);
    }
    if (state.lowPaise === null || nextLtpPaise < state.lowPaise) {
      state.lowPaise = nextLtpPaise;
      tick.low = fromPaise(nextLtpPaise);
    }
    // Volume only occasionally changes, which keeps most ticks genuinely partial.
    if (rng() < 0.3) {
      state.volume += 1 + Math.floor(rng() * 5000);
      tick.volume = state.volume;
    }

    const previous = state.lastTick;
    state.ltpPaise = nextLtpPaise;
    state.lastTick = tick;

    emit(tick);

    // A stale tick is a previously cached update emitted after a newer one. Its
    // seq is already behind, so the store's per-symbol guard must discard it.
    if (previous !== null && staleRate > 0 && rng() < staleRate) {
      emit(previous);
    }
  };

  for (const quote of options.baseline) {
    seed(quote);
  }

  return {
    connect: () => {
      if (interval !== null) {
        return;
      }
      paused = false;
      interval = setInterval(emitTick, intervalMs);
      schedulePause();
    },

    disconnect: () => {
      if (interval !== null) {
        clearInterval(interval);
      }
      interval = null;
      if (pauseTimer !== null) {
        clearTimeout(pauseTimer);
      }
      pauseTimer = null;
      paused = false;
    },

    onTick: (handler) => {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },

    updateBaseline: (quotes) => {
      for (const quote of quotes) {
        const existing = states.get(quote.symbol);
        if (!existing) {
          seed(quote);
          continue;
        }
        existing.ltpPaise = quote.ltpPaise;
        existing.highPaise = quote.highPaise ?? existing.highPaise;
        existing.lowPaise = quote.lowPaise ?? existing.lowPaise;
        existing.volume = quote.volume ?? existing.volume;
        existing.seq = Math.max(existing.seq, quote.seq);
      }
    },
  };
}
