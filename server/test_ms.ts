import { marketStructureService } from "./src/services/strategies/market-structure.service";

const candles = [];
for (let i = 0; i < 2000; i++) {
    candles.push({
        time: i,
        open: 1.0 + Math.random() * 0.01,
        high: 1.01 + Math.random() * 0.01,
        low: 0.99 + Math.random() * 0.01,
        close: 1.0 + Math.random() * 0.01,
        tick_volume: 100
    });
}
console.time("analyze");
marketStructureService.analyzeMarketStructure(candles as any);
console.timeEnd("analyze");
