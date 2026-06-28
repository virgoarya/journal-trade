import { macroAiService } from './src/services/macro-ai.service';

const state = {
  assets: [{ ticker: 'SPY', name: 'SPDR', change: 1.5 }],
  calculatedRegime: 'Goldilocks',
  liquidityStatus: 'Draining',
  context: {
    confidence: { label: 'HIGH', score: 95 },
    growth: { roc5d: 1.2 },
    inflation: { roc5d: -0.5 },
    liquidity: { riskState: 'Stressed' }
  }
};

macroAiService.analyzeRegime(state.assets, state.calculatedRegime, state.liquidityStatus, state.context).then(console.log).catch(console.error);