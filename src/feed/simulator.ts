import { fromPaise } from '../domain/money';
import type { Quote, Tick } from '../domain/types';
import type { PriceFeed, TickHandler, TickSimulatorOptions } from './types';

interface SymbolState {
  ltpPaise: number;
  highPaise: number | null;
  lowPaise: number | null;
  volume: number;
  seq: number;
  /** Recent emitted ticks, used to replay an occasional stale update. */
  history: Tick[];
}

const DEFAULT_INTERVAL_MS = 50;
const DEFAULT_STALE_RATE = 0.02;
const DEFAULT_PAUSE_DURATION_MS = 5000;
const MAX_HISTORY = 50;

/**
 * A socket-shaped fake feed.
 *
 * It emits one partial tick every 50 ms (≈20/s across all symbols), replays an
 * occasional older tick, and goes silent for 5 seconds every 60–90 seconds.
 * The app consumes only the PriceFeed interface, so replacing this with a real
 * socket requires no UI changes.
 */
export class TickSimulator implements PriceFeed {
  private readonly states = new Map<string, SymbolState>();
  private readonly handlers = new Set<TickHandler>();
  private readonly intervalMs: number;
  private readonly staleRate: number;
  private readonly pauseDurationMs: number;
  private readonly pauseInterval: (() => number) | null;
  private readonly rng: () => number;

  private interval: ReturnType<typeof setInterval> | null = null;
  private nextPauseTimer: ReturnType<typeof setTimeout> | null = null;
  private resumeTimer: ReturnType<typeof setTimeout> | null = null;
  private paused = false;

  constructor(options: TickSimulatorOptions) {
    this.intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
    this.staleRate = options.staleRate ?? DEFAULT_STALE_RATE;
    this.pauseDurationMs = options.pauseDurationMs ?? DEFAULT_PAUSE_DURATION_MS;
    this.pauseInterval =
      typeof options.pauseIntervalMs === 'function'
        ? options.pauseIntervalMs
        : options.pauseIntervalMs !== undefined
          ? () => options.pauseIntervalMs as number
          : null;
    this.rng = options.rng ?? Math.random;

    for (const quote of options.baseline) {
      this.states.set(quote.symbol, {
        ltpPaise: quote.ltpPaise,
        highPaise: quote.highPaise,
        lowPaise: quote.lowPaise,
        volume: quote.volume ?? 0,
        seq: quote.seq,
        history: [],
      });
    }
  }

  connect(): void {
    if (this.interval !== null) {
      return;
    }
    this.paused = false;
    this.interval = setInterval(this.emitTick, this.intervalMs);
    this.schedulePause();
  }

  disconnect(): void {
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (this.nextPauseTimer !== null) {
      clearTimeout(this.nextPauseTimer);
      this.nextPauseTimer = null;
    }
    if (this.resumeTimer !== null) {
      clearTimeout(this.resumeTimer);
      this.resumeTimer = null;
    }
    this.paused = false;
  }

  onTick(handler: TickHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  /**
   * Refreshes the simulator's running state from a REST snapshot. Used after
   * pull-to-refresh so newly returned symbols start ticking too.
   */
  updateBaseline(quotes: readonly Quote[]): void {
    for (const quote of quotes) {
      const existing = this.states.get(quote.symbol);
      if (existing) {
        existing.ltpPaise = quote.ltpPaise;
        existing.highPaise = quote.highPaise ?? existing.highPaise;
        existing.lowPaise = quote.lowPaise ?? existing.lowPaise;
        existing.volume = quote.volume ?? existing.volume;
        existing.seq = Math.max(existing.seq, quote.seq);
      } else {
        this.states.set(quote.symbol, {
          ltpPaise: quote.ltpPaise,
          highPaise: quote.highPaise,
          lowPaise: quote.lowPaise,
          volume: quote.volume ?? 0,
          seq: quote.seq,
          history: [],
        });
      }
    }
  }

  private readonly emitTick = (): void => {
    if (this.paused) {
      return;
    }
    const symbols = Array.from(this.states.keys());
    if (symbols.length === 0) {
      return;
    }

    const symbol = symbols[Math.min(symbols.length - 1, Math.floor(this.rng() * symbols.length))];
    const state = symbol ? this.states.get(symbol) : undefined;
    if (!state || !symbol) {
      return;
    }

    const movement = (this.rng() * 2 - 1) * 0.002;
    const nextLtpPaise = Math.max(1, Math.round(state.ltpPaise * (1 + movement)));

    state.seq += 1;
    const tick: Tick = {
      symbol,
      seq: state.seq,
      ltp: fromPaise(nextLtpPaise),
    };

    if (state.highPaise === null || nextLtpPaise > state.highPaise) {
      state.highPaise = nextLtpPaise;
      tick.high = fromPaise(nextLtpPaise);
    }
    if (state.lowPaise === null || nextLtpPaise < state.lowPaise) {
      state.lowPaise = nextLtpPaise;
      tick.low = fromPaise(nextLtpPaise);
    }

    // Volume only occasionally changes, which keeps most ticks genuinely partial.
    if (this.rng() < 0.3) {
      state.volume += 1 + Math.floor(this.rng() * 5000);
      tick.volume = state.volume;
    }

    state.ltpPaise = nextLtpPaise;
    state.history.push(tick);
    if (state.history.length > MAX_HISTORY) {
      state.history.shift();
    }

    this.emit(tick);

    // A stale tick is a previously cached update emitted after a newer one. The
    // store's per-symbol seq guard is what must discard it.
    if (this.staleRate > 0 && state.history.length > 1 && this.rng() < this.staleRate) {
      const staleIndex = Math.min(
        state.history.length - 2,
        Math.floor(this.rng() * (state.history.length - 1)),
      );
      const stale = state.history[staleIndex];
      if (stale) {
        this.emit(stale);
      }
    }
  };

  private emit(tick: Tick): void {
    for (const handler of this.handlers) {
      handler(tick);
    }
  }

  private schedulePause(): void {
    const delay = this.pauseInterval
      ? this.pauseInterval()
      : 60_000 + this.rng() * 30_000;

    this.nextPauseTimer = setTimeout(() => {
      this.nextPauseTimer = null;
      this.paused = true;
      this.resumeTimer = setTimeout(() => {
        this.resumeTimer = null;
        this.paused = false;
        if (this.interval !== null) {
          this.schedulePause();
        }
      }, this.pauseDurationMs);
    }, delay);
  }
}

export function createTickSimulator(options: TickSimulatorOptions): TickSimulator {
  return new TickSimulator(options);
}
