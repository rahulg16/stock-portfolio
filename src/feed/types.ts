import type { Quote, Tick } from '../domain/types';

/** Receives one partial price update. */
export type TickHandler = (tick: Tick) => void;

/**
 * The only surface the app is allowed to depend on. The bundled simulator and a
 * real socket client both implement this, so swapping them requires no UI work.
 */
export interface PriceFeed {
  connect(): void;
  disconnect(): void;
  onTick(handler: TickHandler): () => void;
}

export interface TickSimulatorOptions {
  /** Current quotes used to seed the simulator; only priced symbols tick. */
  baseline: readonly Quote[];
  /** Global tick interval. Default 50 ms, i.e. ~20 ticks per second. */
  intervalMs?: number;
  /** Probability of re-emitting a cached, older tick. Default 0.02. */
  staleRate?: number;
  /** Time between simulated feed silences, or a sampler. Default 60–90 s. */
  pauseIntervalMs?: number | (() => number);
  /** Duration of each silence. Default 5000 ms. */
  pauseDurationMs?: number;
  /** Deterministic RNG hook for tests. Default Math.random. */
  rng?: () => number;
}
