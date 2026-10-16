import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { journalMacroBridgeService } from '../journal-macro-bridge.service';

vi.mock('axios');

describe('JournalMacroBridgeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return snapshot when macro regime API returns valid response', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        success: true,
        data: {
          quadrant: 'Goldilocks',
          liquidity: { riskState: 'HEALTHY' },
          vix: { value: 14.25 },
          yieldCurve: { spread10y2y: 0.45 },
        },
      },
    });

    const snapshot = await journalMacroBridgeService.captureSnapshot();

    expect(snapshot).toBeDefined();
    expect(snapshot?.regime).toBe('Goldilocks');
    expect(snapshot?.liquidityRisk).toBe('HEALTHY');
    expect(snapshot?.vix).toBe(14.25);
    expect(snapshot?.yieldCurveSpread).toBe(0.45);
    expect(snapshot?.capturedAt).toBeInstanceOf(Date);
  });

  it('should return null when API call fails or times out without throwing error', async () => {
    vi.mocked(axios.get).mockRejectedValue(new Error('Connection refused'));

    const snapshot = await journalMacroBridgeService.captureSnapshot();

    expect(snapshot).toBeNull();
  });

  it('should return null when success is false in response', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        success: false,
      },
    });

    const snapshot = await journalMacroBridgeService.captureSnapshot();

    expect(snapshot).toBeNull();
  });
});
