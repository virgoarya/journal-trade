import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRegimeAnalysis } from '../useRegimeAnalysis';

global.fetch = vi.fn();

describe('useRegimeAnalysis hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useRegimeAnalysis());

    expect(result.current.isAnalyzing).toBe(false);
    expect(result.current.reasoning).toBeNull();
  });

  it('should handle successful analyzeRegime API response', async () => {
    const mockResponse = {
      success: true,
      reasoning: '  Market is in Goldilocks regime  ',
    };
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => useRegimeAnalysis());

    await act(async () => {
      await result.current.analyzeRegime({
        assets: [{ ticker: 'SPY', name: 'S&P 500', change: 0.5 }],
        regime: 'Goldilocks',
        liquidityStatus: 'Refilling',
        sentiment: 'Bullish',
        context: {},
      });
    });

    expect(result.current.isAnalyzing).toBe(false);
    expect(result.current.reasoning).toBe('Market is in Goldilocks regime');
    expect(global.fetch).toHaveBeenCalledWith('/api/v1/macro-ai/analyze-regime', expect.any(Object));
  });

  it('should handle API error in analyzeRegime', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: { get: () => 'text/plain' },
      text: async () => 'Internal Server Error',
    });

    const { result } = renderHook(() => useRegimeAnalysis());

    await act(async () => {
      await result.current.analyzeRegime({
        assets: [],
        regime: 'Reflation',
        liquidityStatus: 'Neutral',
        sentiment: 'Neutral',
        context: {},
      });
    });

    expect(result.current.isAnalyzing).toBe(false);
    expect(result.current.reasoning).toContain('Error API: Server error 500 (Reflation)');
  });

  it('should handle successful analyzeNexus API response', async () => {
    const mockResponse = {
      success: true,
      reasoning: 'Nexus inter-market analysis indicates low contagion risk',
    };
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => useRegimeAnalysis());

    await act(async () => {
      await result.current.analyzeNexus({
        nodesData: { spy: 1 },
        context: {},
      });
    });

    expect(result.current.isAnalyzing).toBe(false);
    expect(result.current.reasoning).toBe('Nexus inter-market analysis indicates low contagion risk');
  });

  it('should handle fetch exception in analyzeNexus', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useRegimeAnalysis());

    await act(async () => {
      await result.current.analyzeNexus({
        nodesData: {},
        context: {},
      });
    });

    expect(result.current.isAnalyzing).toBe(false);
    expect(result.current.reasoning).toBe('Terjadi kesalahan saat memanggil AI: Network error');
  });
});