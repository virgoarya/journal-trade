// src/lib/macro/__tests__/classifiers.test.ts
import {
  classifyMacroRegime,
  classifyOnRrpLiquidity,
  getRegimeTransitionAlert,
  MacroRegime,
  OnRrpStatus,
} from '../classifiers';

describe('classifyMacroRegime', () => {
  const baseInput = { growth: 0, inflation: 0, assetSignals: undefined };

  it('should return Goldilocks when growth high & inflation low', () => {
    const res = classifyMacroRegime({
      ...baseInput,
      growth: 0.5, // >0.15 (high)
      inflation: -0.2, // <-0.15 (low)
    });
    expect(res.regime).toBe('Goldilocks');
    expect(res.shortReason).toContain('Pertumbuhan di atas tren');
  });

  it('should return Reflation when growth high & inflation high', () => {
    const res = classifyMacroRegime({
      ...baseInput,
      growth: 0.5,
      inflation: 4,
    });
    expect(res.regime).toBe('Reflation');
  });

  it('should return Stagflation when growth low & inflation high', () => {
    const res = classifyMacroRegime({
      ...baseInput,
      growth: -0.1,
      inflation: 4,
    });
    expect(res.regime).toBe('Stagflation');
  });

  it('should return Deflation when growth low & inflation low', () => {
    const res = classifyMacroRegime({
      ...baseInput,
      growth: -0.5, // <-0.15 (low)
      inflation: -0.5, // <-0.15 (low)
    });
    expect(res.regime).toBe('Deflation');
  });
});

describe('classifyOnRrpLiquidity', () => {
  it('should be Neutral when |delta| < threshold', () => {
    const res = classifyOnRrpLiquidity({
      currentBalance: 2.1,
      deltaDaily: 0.01, // $10M
    });
    expect(res.status).toBe('Neutral');
    expect(res.shortReason).toContain('di bawah ambang signifikansi');
  });

  it('should be Draining when delta < -threshold', () => {
    const res = classifyOnRrpLiquidity({
      currentBalance: 1.8,
      deltaDaily: -0.1, // -$100M
    });
    expect(res.status).toBe('Draining');
    expect(res.shortReason).toContain('mengeluarkan likuiditas');
  });

  it('should be Refilling when delta > threshold', () => {
    const res = classifyOnRrpLiquidity({
      currentBalance: 1.8,
      deltaDaily: 0.2, // +$200M
    });
    expect(res.status).toBe('Refilling');
    expect(res.shortReason).toContain('menambahkan likuiditas');
  });
});

describe('getRegimeTransitionAlert', () => {
  it('returns null when no change', () => {
    const alert = getRegimeTransitionAlert('Reflation', 'Reflation');
    expect(alert).toBeNull();
  });

  it('returns alert object when regime changes', () => {
    const alert = getRegimeTransitionAlert('Reflation', 'Stagflation');
    expect(alert).not.toBeNull();
    expect(alert?.type).toBe('MACRO_REGIME_SHIFT');
    expect(alert?.from).toBe('Reflation');
    expect(alert?.to).toBe('Stagflation');
    expect(typeof alert?.timestamp).toBe('string');
  });
});