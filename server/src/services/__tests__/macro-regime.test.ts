import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { macroRegimeService } from '../macro-regime.service';
import * as fredApiHelper from '../../utils/fred-api.helper';

vi.mock('axios');
vi.mock('../../utils/fred-api.helper', () => ({
  fredYoY: vi.fn(),
}));

// Helper: build a Yahoo Finance chart response
function makeYahooResponse(length: number) {
  const timestamps = Array.from({ length }, (_, i) => 1700000000 + i * 86400);
  const closes = Array.from({ length }, (_, i) => 100 + i * 0.5);
  return {
    data: {
      chart: {
        result: [
          {
            timestamp: timestamps,
            indicators: { quote: [{ close: closes }] },
          },
        ],
      },
    },
  };
}

describe('macroRegimeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return fallback Transition snapshot when Yahoo Finance fails', async () => {
    vi.mocked(axios.get).mockRejectedValue(new Error('Network error'));
    vi.mocked(fredApiHelper.fredYoY).mockResolvedValue(2.5);

    const snapshot = await macroRegimeService.forceRefresh();

    expect(snapshot).toBeDefined();
    expect(snapshot.quadrant).toBe('Transition');
    expect(snapshot.source).toBe('CACHE');
    expect(snapshot.growth.status).toBe('NEUTRAL');
    expect(snapshot.confidence.label).toBe('LOW');
  });

  it('should return valid snapshot with expected structure when data is sufficient', async () => {
    vi.mocked(axios.get).mockResolvedValue(makeYahooResponse(60));
    vi.mocked(fredApiHelper.fredYoY).mockResolvedValue(3.2);

    const snapshot = await macroRegimeService.forceRefresh();

    expect(snapshot.growth).toMatchObject({
      current: expect.any(Number),
      ema10: expect.any(Number),
      ema50: expect.any(Number),
      status: expect.stringMatching(/^(ACCELERATING|DECELERATING|TURNING|NEUTRAL)$/),
    });
    expect(snapshot.inflation).toBeDefined();
    expect(snapshot.liquidity).toBeDefined();
    expect(snapshot.position).toMatchObject({
      x: expect.any(Number),
      y: expect.any(Number),
    });
    expect(snapshot.history.length).toBeGreaterThan(0);
  });

  it('snapshot should have fetchedAt as valid ISO string', async () => {
    vi.mocked(axios.get).mockResolvedValue(makeYahooResponse(60));
    vi.mocked(fredApiHelper.fredYoY).mockResolvedValue(2.5);

    const snapshot = await macroRegimeService.forceRefresh();

    expect(new Date(snapshot.fetchedAt).toISOString()).toBe(snapshot.fetchedAt);
  });
});
