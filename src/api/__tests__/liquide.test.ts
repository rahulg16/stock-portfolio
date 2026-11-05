import type { HttpRequestInit, HttpResponse } from '../types';
import {
  DEFAULT_TIMEOUT_MS,
  LIQUIDE_OHLC_URL,
  fetchQuotes,
  parseOhlcResponse,
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
  it('posts the symbols and converts rupee fields to integer paise', async () => {
    const fetchImpl = jest.fn(
      async (_url: string, _init: HttpRequestInit): Promise<HttpResponse> =>
        jsonResponse(successPayload),
    );

    const quotes = await fetchQuotes(['RELIANCE', 'TCS', 'RELIANCE'], {
      fetchImpl,
      now: () => 1234,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe(LIQUIDE_OHLC_URL);
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({ 'content-type': 'application/json' });
    expect(JSON.parse(init?.body ?? '{}')).toEqual({
      symbols: ['RELIANCE', 'TCS'],
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);

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
      updatedAt: 1234,
    });
  });

  it('omits unknown symbols and rows without a usable ltp', async () => {
    const fetchImpl = jest.fn(
      async (): Promise<HttpResponse> =>
        jsonResponse({
          message: {
            data: [
              { symbol: 'OLDCO', ltp: 412.5 },
              { symbol: 'TCS', ltp: 0 },
              { symbol: 'INFY', ltp: 1800 },
              { symbol: 'RELIANCE', ltp: 1314 },
            ],
          },
        }),
    );

    const quotes = await fetchQuotes(['RELIANCE', 'INFY', 'TCS'], {
      fetchImpl,
    });

    expect(quotes.map((quote) => quote.symbol)).toEqual(['INFY', 'RELIANCE']);
  });

  it('deduplicates repeated rows and keeps optional fields null', async () => {
    const quotes = parseOhlcResponse(
      {
        message: {
          data: [
            { symbol: 'TCS', ltp: 100.5, open: null, prevClose: undefined },
            { symbol: 'TCS', ltp: 999 },
          ],
        },
      },
      ['TCS'],
      () => 0,
    );

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
        updatedAt: 0,
      },
    ]);
  });

  it('does not call the network for an empty symbol list', async () => {
    const fetchImpl = jest.fn(
      async (): Promise<HttpResponse> => jsonResponse(successPayload),
    );

    await expect(fetchQuotes([], { fetchImpl })).resolves.toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects non-2xx responses with the status code', async () => {
    const fetchImpl = jest.fn(
      async (): Promise<HttpResponse> => jsonResponse({}, 500),
    );

    await expect(fetchQuotes(['TCS'], { fetchImpl })).rejects.toThrow(
      'Price service returned HTTP 500. Please try again.',
    );
  });

  it('rejects malformed envelopes and malformed JSON', async () => {
    await expect(
      fetchQuotes(['TCS'], {
        fetchImpl: jest.fn(async () => jsonResponse({ status: 'success' })),
      }),
    ).rejects.toThrow('did not include market data');

    await expect(
      fetchQuotes(['TCS'], {
        fetchImpl: jest.fn(async () => ({
          ok: true,
          status: 201,
          json: async () => {
            throw new Error('bad json');
          },
        })),
      }),
    ).rejects.toThrow('malformed JSON');
  });

  it('aborts and reports a timeout', async () => {
    jest.useFakeTimers();
    try {
      const fetchImpl = jest.fn(
        (_url: string, init: HttpRequestInit): Promise<HttpResponse> =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => {
              const error = new Error('Aborted');
              error.name = 'AbortError';
              reject(error);
            });
          }),
      );

      const request = fetchQuotes(['TCS'], { fetchImpl, timeoutMs: 25 });
      const assertion = expect(request).rejects.toThrow(/timed out/);
      jest.advanceTimersByTime(25);
      await assertion;
    } finally {
      jest.useRealTimers();
    }
  });

  it('uses a 10 second default timeout', () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(10_000);
  });
});
