"use client";

import { useState, useEffect } from "react";
import { Calculator, Info, RefreshCw } from "lucide-react";

interface ForexCalculatorProps {
  initialBalance?: number;
  defaultRisk?: number;
}

const COMMON_PAIRS = [
  { name: "EUR/USD", pipValue: 10, type: "forex" },
  { name: "GBP/USD", pipValue: 10, type: "forex" },
  { name: "AUD/USD", pipValue: 10, type: "forex" },
  { name: "NZD/USD", pipValue: 10, type: "forex" },
  { name: "USD/JPY", pipValue: 9.1, type: "forex" }, // Approximate
  { name: "USD/CAD", pipValue: 7.4, type: "forex" }, // Approximate
  { name: "USD/CHF", pipValue: 11.2, type: "forex" }, // Approximate
  { name: "XAU/USD (Gold)", pipValue: 100, type: "commodity" }, // 1 point = $100 for 1 lot
];

export function ForexCalculator({ initialBalance = 10000, defaultRisk = 1 }: ForexCalculatorProps) {
  const [balance, setBalance] = useState(initialBalance);
  const [riskPercent, setRiskPercent] = useState(defaultRisk);
  const [stopLoss, setStopLoss] = useState(20);
  const [selectedPair, setSelectedPair] = useState(COMMON_PAIRS[0]);
  const [lotSize, setLotSize] = useState(0);
  const [riskAmount, setRiskAmount] = useState(0);

  useEffect(() => {
    // Calculation: (Balance * Risk%) / (StopLoss * PipValue)
    const risk$ = (balance * riskPercent) / 100;
    const size = risk$ / (stopLoss * selectedPair.pipValue);
    
    setRiskAmount(risk$);
    setLotSize(isNaN(size) || !isFinite(size) ? 0 : size);
  }, [balance, riskPercent, stopLoss, selectedPair]);

  const handleSyncBalance = () => {
    setBalance(initialBalance);
  };

  return (
    <div className="glass p-4 h-full flex flex-col justify-between border border-white/5 hover:border-accent-gold/20 transition-all duration-300">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-accent-gold" />
          <h4 className="font-semibold text-xs sm:text-sm text-text-primary uppercase tracking-[0.2em]">Position Calculator</h4>
        </div>
        <button 
          onClick={handleSyncBalance}
          title="Sync with account balance"
          className="p-1 hover:bg-white/5 rounded-full transition-colors group"
        >
          <RefreshCw className="w-3.5 h-3.5 text-text-muted group-hover:text-accent-gold transition-colors" />
        </button>
      </div>

      <div className="space-y-3">
        {/* Account Balance */}
        <div>
          <label className="text-[9px] uppercase tracking-widest text-text-muted mb-1 block font-bold">Account Balance ($)</label>
          <input 
            type="number"
            value={balance}
            onChange={(e) => setBalance(Number(e.target.value))}
            className="w-full bg-bg-void/50 border border-white/5 rounded-lg px-3 py-1.5 text-xs font-mono text-accent-gold focus:outline-none focus:border-accent-gold/40 transition-all"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Risk % */}
          <div>
            <label className="text-[9px] uppercase tracking-widest text-text-muted mb-1 block font-bold">Risk (%)</label>
            <input 
              type="number"
              step="0.1"
              value={riskPercent}
              onChange={(e) => setRiskPercent(Number(e.target.value))}
              className="w-full bg-bg-void/50 border border-white/5 rounded-lg px-3 py-1.5 text-xs font-mono text-text-primary focus:outline-none focus:border-accent-gold/40 transition-all"
            />
          </div>
          {/* Stop Loss Pips */}
          <div>
            <label className="text-[9px] uppercase tracking-widest text-text-muted mb-1 block font-bold">Stop Loss (Pips)</label>
            <input 
              type="number"
              value={stopLoss}
              onChange={(e) => setStopLoss(Number(e.target.value))}
              className="w-full bg-bg-void/50 border border-white/5 rounded-lg px-3 py-1.5 text-xs font-mono text-text-primary focus:outline-none focus:border-accent-gold/40 transition-all"
            />
          </div>
        </div>

        {/* Pair Selector */}
        <div>
          <label className="text-[9px] uppercase tracking-widest text-text-muted mb-1 block font-bold">Currency Pair</label>
          <select 
            value={selectedPair.name}
            onChange={(e) => {
              const pair = COMMON_PAIRS.find(p => p.name === e.target.value);
              if (pair) setSelectedPair(pair);
            }}
            className="w-full bg-bg-void/50 border border-white/5 rounded-lg px-3 py-1.5 text-xs font-mono text-text-primary focus:outline-none focus:border-accent-gold/40 transition-all appearance-none cursor-pointer"
          >
            {COMMON_PAIRS.map(p => (
              <option key={p.name} value={p.name} className="bg-bg-void text-text-primary">{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Result Display */}
      <div className="mt-5 pt-4 border-t border-white/5 space-y-3">
        <div className="flex justify-between items-end">
          <div className="space-y-0.5">
            <span className="text-[9px] uppercase tracking-[0.2em] text-text-muted font-bold block">Recommended Size</span>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-xl sm:text-2xl font-black text-accent-gold tracking-tight">{lotSize.toFixed(2)}</span>
              <span className="text-[10px] text-accent-gold/60 font-mono font-bold uppercase">Lots</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[9px] uppercase tracking-[0.2em] text-text-muted font-bold block">Total Risk</span>
            <span className="font-mono text-sm sm:text-base font-bold text-data-loss tracking-tight">-${Math.abs(riskAmount).toFixed(2)}</span>
          </div>
        </div>
        
        <div className="bg-accent-gold/5 rounded-lg p-2 flex items-start gap-2 border border-accent-gold/10">
          <Info className="w-3 h-3 text-accent-gold mt-0.5 flex-shrink-0" />
          <p className="text-[8px] text-accent-gold/70 leading-relaxed uppercase tracking-widest">
            Fixed value: 1 Lot / 1 Pip = ${selectedPair.pipValue.toFixed(1)}. Always double check with your broker.
          </p>
        </div>
      </div>
    </div>
  );
}
