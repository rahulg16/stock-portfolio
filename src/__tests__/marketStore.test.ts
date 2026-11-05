import type { Quote } from '../domain/types';
import { MarketStore } from '../store/marketStore';

function makeQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    symbol: 'RELIANCE',
    ltpPaise: 100000,
    openPaise: 99000,
    prevClosePaise: 98000,
    highPaise: 101000,
    lowPaise: 97000,
    volume: 1000,
    seq: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe('MarketStore', () => {
  it('applies a partial tick without overwriting absent fields', () => {
    const store = new MarketStore();
    store.applyBaseline([makeQuote()]);

    const applied = store.applyTick({
      symbol: 'RELIANCE',
      seq: 1,
      ltp: 1100.25,
    });

    expect(applied).toBe(true);
    expect(store.getQuote('RELIANCE')).toMatchObject({
      ltpPaise: 110025,
      openPaise: 99000,
      prevClosePaise: 98000,
      highPaise: 101000,
      lowPaise: 97000,
      volume: 1000,
      seq: 1,
    });
  });

  it('converts rupee tick values to integer paise', () => {
    const store = new MarketStore();
    store.applyBaseline([makeQuote()]);

    store.applyTick({
      symbol: 'RELIANCE',
      seq: 1,
      ltp: 1314.56,
      high: 1320.1,
      low: 1300.05,
      volume: 15293551.6,
    });

    expect(store.getQuote('RELIANCE')).toMatchObject({
      ltpPaise: 131456,
      highPaise: 132010,
      lowPaise: 130005,
      volume: 15293552,
    });
  });

  it('ignores stale and duplicate sequence numbers per symbol', () => {
    const store = new MarketStore();
    store.applyBaseline([makeQuote()]);
    store.applyTick({ symbol: 'RELIANCE', seq: 5, ltp: 1100 });

    expect(store.applyTick({ symbol: 'RELIANCE', seq: 5, ltp: 1200 })).toBe(false);
    expect(store.applyTick({ symbol: 'RELIANCE', seq: 4, ltp: 1300 })).toBe(false);
    expect(store.getQuote('RELIANCE')?.ltpPaise).toBe(110000);
    expect(store.applyTick({ symbol: 'RELIANCE', seq: 6, ltp: 1300 })).toBe(true);
    expect(store.getQuote('RELIANCE')?.ltpPaise).toBe(130000);
  });

  it('notifies only the listeners for the ticked symbol', () => {
    const store = new MarketStore();
    store.applyBaseline([makeQuote(), makeQuote({ symbol: 'TCS' })]);

    const relianceListener = jest.fn();
    const tcsListener = jest.fn();
    const globalListener = jest.fn();
    store.subscribeSymbol('RELIANCE', relianceListener);
    store.subscribeSymbol('TCS', tcsListener);
    store.subscribe(globalListener);

    store.applyTick({ symbol: 'RELIANCE', seq: 1, ltp: 1100 });

    expect(relianceListener).toHaveBeenCalledTimes(1);
    expect(tcsListener).not.toHaveBeenCalled();
    expect(globalListener).toHaveBeenCalledTimes(1);
  });

  it('stops notifying after unsubscribe', () => {
    const store = new MarketStore();
    store.applyBaseline([makeQuote()]);
    const listener = jest.fn();
    const unsubscribe = store.subscribeSymbol('RELIANCE', listener);

    unsubscribe();
    store.applyTick({ symbol: 'RELIANCE', seq: 1, ltp: 1100 });

    expect(listener).not.toHaveBeenCalled();
  });

  it('merges a refreshed baseline without regressing the sequence guard', () => {
    const store = new MarketStore();
    store.applyBaseline([makeQuote()]);
    store.applyTick({ symbol: 'RELIANCE', seq: 5, ltp: 1100 });

    store.applyBaseline([makeQuote({ ltpPaise: 120000, seq: 0 })]);

    expect(store.getQuote('RELIANCE')?.ltpPaise).toBe(120000);
    expect(store.applyTick({ symbol: 'RELIANCE', seq: 5, ltp: 1300 })).toBe(false);
    expect(store.applyTick({ symbol: 'RELIANCE', seq: 6, ltp: 1300 })).toBe(true);
  });

  it('adds a quote for a symbol that was missing from the first fetch', () => {
    const store = new MarketStore();
    expect(store.getQuote('INFY')).toBeUndefined();

    store.applyBaseline([makeQuote({ symbol: 'INFY' })]);

    expect(store.getQuote('INFY')?.symbol).toBe('INFY');
  });

  it('drops ticks with no usable price for an unpriced symbol', () => {
    const store = new MarketStore();

    expect(store.applyTick({ symbol: 'OLDCO', seq: 1, volume: 10 })).toBe(false);
    expect(store.getQuote('OLDCO')).toBeUndefined();
    expect(store.getLastTickAt()).toBe(0);
  });

  it('records the time of the last applied tick', () => {
    const store = new MarketStore();
    store.applyBaseline([makeQuote()]);

    store.applyTick({ symbol: 'RELIANCE', seq: 1, ltp: 1100 });

    expect(store.getLastTickAt()).toBeGreaterThan(0);
  });
});
