"use client";

import { useState } from "react";
import { type SymbolInfo } from "../types";
import { Plus, X } from "lucide-react";

interface SymbolSelectorProps {
  symbols: string[];
  onAddSymbol: (symbol: string) => void;
  onRemoveSymbol: (symbol: string) => void;
  availableSymbols: SymbolInfo[];
  loadingSymbols: boolean;
}

export function SymbolSelector({
  symbols,
  onAddSymbol,
  onRemoveSymbol,
  availableSymbols,
  loadingSymbols,
}: SymbolSelectorProps) {
  const [symbolInput, setSymbolInput] = useState("");

  const handleAdd = () => {
    if (symbolInput.trim()) {
      onAddSymbol(symbolInput.toUpperCase().trim());
      setSymbolInput("");
    }
  };

  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1.5">Trading Pairs</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {symbols.map((sym) => (
          <span
            key={sym}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-accent-gold/10 text-accent-gold text-xs rounded-full"
          >
            {sym}
            <button
              onClick={() => onRemoveSymbol(sym)}
              className="hover:text-red-400 transition"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        <input
          type="text"
          value={symbolInput}
          onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Add symbol..."
          className="flex-1 px-2.5 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-white placeholder-gray-500 focus:border-accent-gold outline-none"
        />
        <button
          onClick={handleAdd}
          className="px-2.5 py-1.5 bg-gray-800 text-gray-300 rounded text-xs hover:text-white transition"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
      {availableSymbols.length > 0 && (
        <div className="mt-1 text-xs text-gray-500">
          {availableSymbols.length} symbols available on broker
        </div>
      )}
    </div>
  );
}
