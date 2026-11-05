import type AsyncStorage from '@react-native-async-storage/async-storage';
import { HOLDINGS_STORAGE_KEY, PortfolioStore } from '../store/portfolioStore';

type Storage = Pick<typeof AsyncStorage, 'getItem' | 'setItem'>;

class MemoryStorage implements Storage {
  readonly data = new Map<string, string>();
  getItem = jest.fn(async (key: string): Promise<string | null> => {
    return this.data.get(key) ?? null;
  });
  setItem = jest.fn(async (key: string, value: string): Promise<void> => {
    this.data.set(key, value);
  });
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('PortfolioStore', () => {
  it('uses the bundled holdings when storage is empty', async () => {
    const storage = new MemoryStorage();
    const store = new PortfolioStore(storage);

    await store.hydrate();

    expect(store.getHoldings()).toHaveLength(21);
    expect(store.getHolding('OLDCO')).toEqual({
      symbol: 'OLDCO',
      qty: 30,
      avgPricePaise: 41250,
    });
  });

  it('hydrates persisted holdings instead of the bundle', async () => {
    const storage = new MemoryStorage();
    storage.data.set(
      HOLDINGS_STORAGE_KEY,
      JSON.stringify([{ symbol: 'TCS', qty: 2, avgPricePaise: 250000 }]),
    );
    const store = new PortfolioStore(storage);

    await store.hydrate();

    expect(store.getHoldings()).toEqual([
      { symbol: 'TCS', qty: 2, avgPricePaise: 250000 },
    ]);
  });

  it('preserves a deliberately empty portfolio across restarts', async () => {
    const storage = new MemoryStorage();
    storage.data.set(HOLDINGS_STORAGE_KEY, '[]');
    const store = new PortfolioStore(storage);

    await store.hydrate();

    expect(store.getHoldings()).toEqual([]);
  });

  it('falls back to the bundle when stored data is malformed', async () => {
    const storage = new MemoryStorage();
    storage.data.set(HOLDINGS_STORAGE_KEY, '{not-json');
    const store = new PortfolioStore(storage);

    await store.hydrate();

    expect(store.getHoldings()).toHaveLength(21);
  });

  it('falls back to the bundle when a stored holding is invalid', async () => {
    const storage = new MemoryStorage();
    storage.data.set(
      HOLDINGS_STORAGE_KEY,
      JSON.stringify([{ symbol: 'TCS', qty: 1.5, avgPricePaise: 250000 }]),
    );
    const store = new PortfolioStore(storage);

    await store.hydrate();

    expect(store.getHoldings()).toHaveLength(21);
  });

  it('applies a buy, notifies subscribers and persists', async () => {
    const storage = new MemoryStorage();
    const store = new PortfolioStore(storage);
    await store.hydrate();
    const listener = jest.fn();
    store.subscribe(listener);

    store.applyOrder('TCS', 'BUY', 10, 250000);

    expect(store.getHolding('TCS')).toMatchObject({ qty: 50 });
    expect(listener).toHaveBeenCalledTimes(1);

    await flush();
    const persisted = JSON.parse(storage.data.get(HOLDINGS_STORAGE_KEY) ?? '[]');
    expect(
      persisted.find((holding: { symbol: string }) => holding.symbol === 'TCS'),
    ).toMatchObject({ qty: 50 });
  });

  it('removes a holding when the entire quantity is sold', async () => {
    const storage = new MemoryStorage();
    const store = new PortfolioStore(storage);
    await store.hydrate();

    store.applyOrder('OLDCO', 'SELL', 30, 41250);

    expect(store.getHolding('OLDCO')).toBeUndefined();
    expect(store.getHoldings()).toHaveLength(20);

    await flush();
    expect(storage.data.get(HOLDINGS_STORAGE_KEY)).not.toContain('OLDCO');
  });
});
