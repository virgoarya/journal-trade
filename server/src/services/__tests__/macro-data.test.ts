import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { macroDataService } from '../macro-data.service';

vi.mock('axios');

describe('macroDataService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch quotes from Yahoo Finance', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        chart: {
          result: [
            {
              meta: {
                regularMarketPrice: 150.5,
                previousClose: 149.0,
              },
            },
          ],
        },
      },
    });

    const result = await macroDataService.getQuotes(['AAPL']);

    expect(result).toBeDefined();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      symbol: 'AAPL',
      price: 150.5,
      change: 1.5,
      changePercent: expect.any(Number),
    });
  });

  it('should return null price when Yahoo Finance fails and MT5 is not connected', async () => {
    vi.mocked(axios.get).mockRejectedValue(new Error('Network error'));

    const result = await macroDataService.getQuotes(['FAIL_SYM']);

    expect(result.data[0]).toMatchObject({
      symbol: 'FAIL_SYM',
      price: null,
    });
  });
});
