import type { HttpRequestInit, HttpResponse } from '../types';
import {
  LIQUIDE_OHLC_URL,
  fetchQuotes,
} from '../liquide';

function jsonResponse(payload: unknown, status = 201): HttpResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

const successPayload = {
  status: 'success',
  code: 200,
  count: 2,
  message: {
    data: [
      {
        symbol: 'RELIANCE',
        ltp: 1314,
        open: 1324,
        prevClose: 1311,
        high: 1325,
        low: 1303.7,
        volume: 15293551,
      },
      {
        symbol: 'TCS',
        ltp: 2501.1,
        open: 2479,
        prevClose: null,
        high: 2521.8,
        low: 2475,
        volume: 4561764.6,
      },
    ],
  },
};

describe('fetchQuotes', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    jest.spyOn(global, 'fetch').mockClear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('posts the symbols and converts rupee fields to integer paise', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => successPayload,
    });
    global.fetch = mockFetch;

    const quotes = await fetchQuotes(['RELIANCE', 'TCS', 'RELIANCE']);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] ?? [];
    expect(url).toBe(LIQUIDE_OHLC_URL);
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({ 'content-type': 'application/json' });
    expect(JSON.parse(init?.body ?? '{}')).toEqual({
      symbols: ['RELIANCE', 'TCS'],
    });

    expect(quotes).toHaveLength(2);
    expect(quotes[0]).toEqual({
      symbol: 'RELIANCE',
      ltpPaise: 131400,
      openPaise: 132400,
      prevClosePaise: 131100,
      highPaise: 132500,
      lowPaise: 130370,
      volume: 15293551,
      seq: 0,
      updatedAt: expect.any(Number),
    });
  });

  it('omits unknown symbols and rows without a usable ltp', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        message: {
          data: [
            { symbol: 'OLDCO', ltp: 412.5 },
            { symbol: 'TCS', ltp: 0 },
            { symbol: 'INFY', ltp: 1800 },
            { symbol: 'RELIANCE', ltp: 1314 },
          ],
        },
      }),
    });

    const quotes = await fetchQuotes(['RELIANCE', 'INFY', 'TCS']);

    expect(quotes.map((quote) => quote.symbol)).toEqual(['INFY', 'RELIANCE']);
  });

  it('deduplicates repeated rows and keeps optional fields null', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        message: {
          data: [
            { symbol: 'TCS', ltp: 100.5, open: null, prevClose: undefined },
            { symbol: 'TCS', ltp: 999 },
          ],
        },
      }),
    });

    const quotes = await fetchQuotes(['TCS']);

    expect(quotes).toEqual([
      {
        symbol: 'TCS',
        ltpPaise: 10050,
        openPaise: null,
        prevClosePaise: null,
        highPaise: null,
        lowPaise: null,
        volume: null,
        seq: 0,
        updatedAt: expect.any(Number),
      },
    ]);
  });

  it('does not call the network for an empty symbol list', async () => {
    await expect(fetchQuotes([])).resolves.toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects non-2xx responses with the status code', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    await expect(fetchQuotes(['TCS'])).rejects.toThrow(
      'Price service returned HTTP 500. Please try again.',
    );
  });

  it('rejects malformed envelopes and malformed JSON', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ status: 'success' }),
    });

    await expect(fetchQuotes(['TCS'])).rejects.toThrow('did not include market data');

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => {
        throw new Error('bad json');
      },
    });

    await expect(fetchQuotes(['TCS'])).rejects.toThrow('malformed JSON');
  });

  it('aborts and reports a timeout', async () => {
    jest.useFakeTimers();
    try {
      global.fetch = jest.fn().mockImplementation(
        () => new Promise((_resolve, reject) => {
          setTimeout(() => {
            const error = new Error('Aborted');
            error.name = 'AbortError';
            reject(error);
          }, 10);
        }),
      );

      const request = fetchQuotes(['TCS']);
      const assertion = expect(request).rejects.toThrow(/timed out|Aborted/);
      jest.advanceTimersByTime(25);
      await assertion;
    } finally {
      jest.useRealTimers();
    }
  });
});