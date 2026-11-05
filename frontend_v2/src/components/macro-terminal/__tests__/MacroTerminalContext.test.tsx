import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';
import { MacroTerminalProvider, useMacroTerminal } from '../MacroTerminalContext';

let externalSetRegimeData: any = null;

vi.mock('@/hooks/useDataFetching', () => ({
  useDataFetching: () => {
    const [assets, setAssets] = React.useState([] as any[]);
    const [liquidity, setLiquidity] = React.useState(null);
    const [regimeData, setRegimeData] = React.useState<any>(null);
    const [nextEvent, setNextEvent] = React.useState(null);
    const [geoRisk, setGeoRisk] = React.useState({ overallScore: 0, topDriver: '', scores: {}, fetchedAt: null });
    const [dataStatus, setDataStatus] = React.useState({} as any);
    const [lastUpdated, setLastUpdated] = React.useState(null);
    const [isFallback, setIsFallback] = React.useState(false);
    const fetchSnapshot = vi.fn();
    externalSetRegimeData = setRegimeData;
    return {
      assets, setAssets, liquidity, setLiquidity, regimeData, setRegimeData,
      nextEvent, setNextEvent, geoRisk, setGeoRisk, dataStatus, setDataStatus,
      lastUpdated, setLastUpdated, isFallback, setIsFallback, fetchSnapshot,
    };
  },
}));

vi.mock('@/hooks/useWebSocket', () => ({
  useWebSocket: () => ({ status: 'connected' }),
}));

const mockAnalyzeRegime = vi.fn().mockResolvedValue(undefined);

vi.mock('@/hooks/useRegimeAnalysis', () => ({
  useRegimeAnalysis: () => ({
    isAnalyzing: false,
    reasoning: null,
    setReasoning: vi.fn(),
    analyzeRegime: mockAnalyzeRegime,
    analyzeNexus: vi.fn().mockResolvedValue(undefined),
  }),
}));

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ success: true, data: {} }),
});

function TestConsumer() {
  const { systemAlert, currentRegime, lastRegime } = useMacroTerminal();
  return (
    <div>
      <span data-testid="alert">{systemAlert || ''}</span>
      <span data-testid="curr">{currentRegime || ''}</span>
      <span data-testid="last">{lastRegime || ''}</span>
    </div>
  );
}

describe('MacroTerminalContext integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    externalSetRegimeData = null;
  });

  it('should expose currentRegime and trigger systemAlert on regime shift', async () => {
    render(
      <MacroTerminalProvider>
        <TestConsumer />
      </MacroTerminalProvider>,
    );

    // Initial regime: Goldilocks
    act(() => {
      externalSetRegimeData?.({
        quadrant: 'Goldilocks',
        growth: {}, inflation: {}, liquidity: {}, confidence: {},
      });
    });

    expect(document.querySelector('[data-testid="curr"]')?.textContent).toBe('Goldilocks');
    expect(document.querySelector('[data-testid="alert"]')?.textContent).toBe('');

    // Shift to Reflation
    await act(async () => {
      externalSetRegimeData?.({
        quadrant: 'Reflation',
        growth: {}, inflation: {}, liquidity: {}, confidence: {},
      });
    });

    const alertText = document.querySelector('[data-testid="alert"]')?.textContent ?? '';
    expect(alertText).toContain('MACRO REGIME SHIFT DETECTED');
    expect(alertText).toContain('GOLDILOCKS');
    expect(alertText).toContain('REFLATION');
    expect(document.querySelector('[data-testid="last"]')?.textContent).toBe('Goldilocks');
    expect(document.querySelector('[data-testid="curr"]')?.textContent).toBe('Reflation');
    expect(mockAnalyzeRegime).toHaveBeenCalled();
  });

  it('should throw error when useMacroTerminal used outside provider', () => {
    const ConsumerOutside = () => {
      useMacroTerminal();
      return null;
    };
    // Suppress React error boundary noise in test output
    const consoleError = console.error;
    console.error = vi.fn();
    expect(() => render(<ConsumerOutside />)).toThrow(
      'useMacroTerminal must be used within a MacroTerminalProvider',
    );
    console.error = consoleError;
  });
});
