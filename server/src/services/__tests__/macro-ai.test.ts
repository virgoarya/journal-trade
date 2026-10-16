import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { analyzeCotAsset } from '../macro-ai.service';

vi.mock('axios');

describe('macroAiService & analyzeCotAsset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should parse COT analysis JSON correctly when LLM returns valid structured text', async () => {
    const mockCotResponse = {
      momentum: "Smart Money menguasai shorts dengan COT Index 86.",
      warnings: "Divergence terdeteksi: SM short vs LS long.",
      conclusion: "Bias bearish dengan conviction TINGGI."
    };

    vi.mocked(axios.post).mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify(mockCotResponse)
            }
          }
        ]
      }
    });

    const mockData = {
      symbol: 'EURUSD',
      name: 'Euro FX',
      category: 'Currencies',
      commercialLong: 100000,
      commercialShort: 50000,
      nonCommercialLong: 60000,
      nonCommercialShort: 80000,
      retailLong: 20000,
      retailShort: 30000,
      sentiment: 'BULLISH',
      lastUpdate: '2026-03-20',
      cotIndexSM: 75,
      cotIndexLS: 30,
      wowDeltaSM: 5000,
      wowDeltaLS: -2000,
      dbs: 4,
      divergence: true
    };

    const result = await analyzeCotAsset(mockData);

    expect(result).toBeDefined();
    expect(result).toHaveProperty('momentum');
    expect(result).toHaveProperty('warnings');
    expect(result).toHaveProperty('conclusion');
  });

  it('should return null when LLM response is empty or invalid JSON', async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content: 'Invalid non-json response'
            }
          }
        ]
      }
    });

    const mockData = {
      symbol: 'EURUSD',
      name: 'Euro FX',
      category: 'Currencies',
      commercialLong: 100000,
      commercialShort: 50000,
      nonCommercialLong: 60000,
      nonCommercialShort: 80000,
      retailLong: 20000,
      retailShort: 30000,
      sentiment: 'BULLISH',
      lastUpdate: '2026-03-20'
    };

    const result = await analyzeCotAsset(mockData);

    expect(result).toBeNull();
  });
});
