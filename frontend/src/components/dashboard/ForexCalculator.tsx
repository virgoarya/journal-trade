"use client";

import { useState, useEffect, useMemo } from "react";
import { Calculator, Info, RefreshCw, DollarSign, Percent, Settings2 } from "lucide-react";

interface ForexCalculatorProps {
  initialBalance?: number;
  defaultRisk?: number;
}

interface AssetPair {
  name: string;
  pipValue: number;
  type: 'forex' | 'commodity' | 'index' | 'custom';
  description: string;
}

const COMMON_PAIRS: AssetPair[] = [
  { name: "EUR/USD", pipValue: 10, type: "forex", description: "1 Lot / 1 Pip (0.0001) = $10" },
  { name: "GBP/USD", pipValue: 10, type: "forex", description: "1 Lot / 1 Pip (0.0001) = $10" },
  { name: "AUD/USD", pipValue: 10, type: "forex", description: "1 Lot / 1 Pip (0.0001) = $10" },
  { name: "USD/JPY", pipValue: 6.7, type: "forex", description: "Approx. $6.7 per Pip (0.01) at 150.00" },
  { name: "XAU/USD (Gold)", pipValue: 10, type: "commodity", description: "1 Lot / 1 Pip (0.10) = $10" },
  { name: "US30 / NAS100", pipValue: 1, type: "index", description: "1 Lot / 1 Point (1.00) = $1" },
  { name: "Custom", pipValue: 10, type: "custom", description: "Enter manual pip value" },
];

export function ForexCalculator({ initialBalance = 10000, defaultRisk = 1 }: ForexCalculatorProps) {
  const [balance, setBalance] = useState(initialBalance);
  const [riskMode, setRiskMode] = useState<'percent' | 'cash'>('percent');
  const [riskValue, setRiskValue] = useState(defaultRisk);
  const [stopLoss, setStopLoss] = useState(15);
  const [selectedPair, setSelectedPair] = useState<AssetPair>(COMMON_PAIRS[0]);
  const [customPipValue, setCustomPipValue] = useState(10);
  
  const [lotSize, setLotSize] = useState(0);
  const [riskAmount, setRiskAmount] = useState(0);

  // Sync balance when prop changes (e.g. dashboard refresh)
  useEffect(() => {
    if (initialBalance > 0 && balance === 10000) { // Only auto-set if it's the default placeholder
       setBalance(initialBalance);
    }
  }, [initialBalance]);

  const activePipValue = useMemo(() => {
    return selectedPair.type === 'custom' ? customPipValue : selectedPair.pipValue;
  }, [selectedPair, customPipValue]);

  useEffect(() => {
    let cashRisk = 0;
    if (riskMode === 'percent') {
      cashRisk = (balance * riskValue) / 100;
    } else {
      cashRisk = riskValue;
    }

    const size = cashRisk / (stopLoss * activePipValue);
    
    setRiskAmount(cashRisk);
    setLotSize(isNaN(size) || !isFinite(size) ? 0 : size);
  }, [balance, riskMode, riskValue, stopLoss, activePipValue]);

  const handleSyncBalance = () => {
    setBalance(initialBalance);
    if (riskMode === 'percent') setRiskValue(defaultRisk);
  };

  return (
    <div className="glass p-4 sm:p-5 h-full flex flex-col justify-between border border-white/5 hover:border-accent-gold/20 transition-all duration-300 shadow-2xl relative overflow-hidden group">
      {/* Decorative background element */}
      <div className="absolute -right-8 -top-8 w-24 h-24 bg-accent-gold/5 rounded-full blur-3xl group-hover:bg-accent-gold/10 transition-all duration-500"></div>
      
      <div className="flex justify-between items-center mb-5 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-accent-gold/10 rounded-lg border border-accent-gold/20">
            <Calculator className="w-4 h-4 text-accent-gold shadow-[0_0_8px_rgba(212,175,55,0.4)]" />
          </div>
          <h4 className="font-semibold text-xs sm:text-sm text-text-primary uppercase tracking-[0.2em] drop-shadow-sm">Position Calculator</h4>
        </div>
        <button 
          onClick={handleSyncBalance}
          title="Sync with account data"
          className="p-1.5 hover:bg-white/5 rounded-lg transition-all active:scale-95 group/btn"
        >
          <RefreshCw className="w-3.5 h-3.5 text-text-muted group-hover/btn:text-accent-gold transition-colors duration-300" />
        </button>
      </div>

      <div className="space-y-4 relative z-10">
        {/* Account Balance */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="text-[9px] uppercase tracking-widest text-text-muted font-bold">Account Balance</label>
            <span className="text-[10px] font-mono text-text-muted/50 font-medium">USD</span>
          </div>
          <div className="relative">
             <input 
              type="number"
              value={balance}
              onChange={(e) => setBalance(Number(e.target.value))}
              className="w-full bg-bg-void/40 border border-white/5 rounded-xl px-4 py-2 text-sm font-mono text-accent-gold focus:outline-none focus:border-accent-gold/40 focus:ring-1 focus:ring-accent-gold/20 transition-all shadow-inner"
            />
            <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-accent-gold/30" />
          </div>
        </div>

        {/* Risk Configuration */}
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-12 space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[9px] uppercase tracking-widest text-text-muted font-bold">Risk Exposure</label>
              <div className="flex p-0.5 bg-bg-void/60 rounded-lg border border-white/5 shadow-inner">
                 <button 
                  onClick={() => { setRiskMode('percent'); if (riskMode === 'cash') setRiskValue(defaultRisk); }}
                  className={`p-1 rounded-md transition-all ${riskMode === 'percent' ? 'bg-accent-gold text-bg-void shadow-lg scale-105' : 'text-text-muted hover:text-text-primary'}`}
                 >
                   <Percent className="w-3 h-3" />
                 </button>
                 <button 
                  onClick={() => { setRiskMode('cash'); if (riskMode === 'percent') setRiskValue((balance * riskValue) / 100); }}
                  className={`p-1 rounded-md transition-all ${riskMode === 'cash' ? 'bg-accent-gold text-bg-void shadow-lg scale-105' : 'text-text-muted hover:text-text-primary'}`}
                 >
                   <DollarSign className="w-3 h-3" />
                 </button>
              </div>
            </div>
            <div className="relative">
               <input 
                type="number"
                step={riskMode === 'percent' ? "0.1" : "1"}
                value={riskValue}
                onChange={(e) => setRiskValue(Number(e.target.value))}
                className="w-full bg-bg-void/40 border border-white/5 rounded-xl px-4 py-2 text-sm font-mono text-text-primary focus:outline-none focus:border-accent-gold/40 focus:ring-1 focus:ring-accent-gold/20 transition-all shadow-inner"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-text-muted font-bold uppercase">
                {riskMode === 'percent' ? '%' : 'USD'}
              </span>
            </div>
          </div>
        </div>

        {/* SL and SL Selection */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[9px] uppercase tracking-widest text-text-muted font-bold">Stop Loss</label>
            <div className="relative">
               <input 
                type="number"
                value={stopLoss}
                onChange={(e) => setStopLoss(Number(e.target.value))}
                className="w-full bg-bg-void/40 border border-white/5 rounded-xl px-4 py-2 text-sm font-mono text-text-primary focus:outline-none focus:border-accent-gold/40 transition-all shadow-inner"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-text-muted font-bold uppercase">Pips</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[9px] uppercase tracking-widest text-text-muted font-bold">Asset Class</label>
            <div className="relative">
              <select 
                value={selectedPair.name}
                onChange={(e) => {
                  const pair = COMMON_PAIRS.find(p => p.name === e.target.value);
                  if (pair) setSelectedPair(pair);
                }}
                className="w-full bg-bg-void/40 border border-white/5 rounded-xl px-3 py-2 text-xs font-mono text-text-primary focus:outline-none focus:border-accent-gold/40 transition-all appearance-none cursor-pointer shadow-inner pr-8"
              >
                {COMMON_PAIRS.map(p => (
                  <option key={p.name} value={p.name} className="bg-bg-void text-text-primary">{p.name}</option>
                ))}
              </select>
              <Settings2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Custom Pip Value Input */}
        {selectedPair.type === 'custom' && (
           <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-300">
             <label className="text-[9px] uppercase tracking-widest text-accent-gold font-bold">Manual Pip Value ($ per 1 Lot per 1 Pip)</label>
             <input 
              type="number"
              step="0.1"
              value={customPipValue}
              onChange={(e) => setCustomPipValue(Number(e.target.value))}
              className="w-full bg-accent-gold/5 border border-accent-gold/20 rounded-xl px-4 py-2 text-sm font-mono text-accent-gold focus:outline-none focus:border-accent-gold/40 transition-all shadow-inner"
            />
           </div>
        )}
      </div>

      {/* Result Display Section */}
      <div className="mt-6 pt-5 border-t border-dashed border-white/10 space-y-4 relative z-10">
        <div className="flex justify-between items-end bg-gradient-to-r from-accent-gold/[0.03] to-transparent p-4 rounded-2xl border border-white/[0.02]">
          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-[0.25em] text-text-muted font-black block">Recommended Size</span>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-2xl sm:text-3xl font-black text-accent-gold tracking-tight drop-shadow-[0_0_15px_rgba(212,175,55,0.3)] tabular-nums">
                {lotSize.toFixed(2)}
              </span>
              <span className="text-[11px] text-accent-gold/60 font-mono font-black uppercase tracking-widest">Lots</span>
            </div>
          </div>
          <div className="text-right pb-1">
            <span className="text-[9px] uppercase tracking-[0.2em] text-text-muted font-bold block mb-1">Total Risk</span>
            <span className="font-mono text-sm sm:text-lg font-bold text-data-loss tracking-tight tabular-nums border-b border-data-loss/20">
              -${Math.abs(riskAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
        
        {/* Transparency / Math Breakdown */}
        <div className="bg-white/[0.01] rounded-xl p-3 flex flex-col gap-2.5 border border-white/5">
          <div className="flex items-start gap-3">
            <Info className="w-3.5 h-3.5 text-accent-gold/60 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="text-[9px] text-text-secondary leading-tight uppercase tracking-widest font-bold">
                {selectedPair.description}
              </p>
              <p className="text-[9px] text-text-muted/60 leading-tight font-medium">
                Formula: <span className="font-mono">Risk / (SL × PipValue)</span> = <span className="font-mono text-accent-gold/50">{riskAmount.toFixed(0)} / ({stopLoss} × {activePipValue})</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
