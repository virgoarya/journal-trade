"use client";

interface RiskSettingsProps {
  maxPositions: number;
  riskPerTrade: number;
  maxDailyRisk: number;
  onMaxPositionsChange: (value: number) => void;
  onRiskPerTradeChange: (value: number) => void;
  onMaxDailyRiskChange: (value: number) => void;
}

export function RiskSettings({
  maxPositions,
  riskPerTrade,
  maxDailyRisk,
  onMaxPositionsChange,
  onRiskPerTradeChange,
  onMaxDailyRiskChange,
}: RiskSettingsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-xs text-gray-400 mb-1">
          Max Positions
        </label>
        <input
          type="text"
          inputMode="numeric"
          value={maxPositions}
          onChange={(e) => onMaxPositionsChange(parseInt(e.target.value) || 1)}
          className="w-full px-2.5 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-white"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">
          Risk / Trade (%)
        </label>
        <input
          type="text"
          inputMode="decimal"
          value={riskPerTrade}
          onChange={(e) => onRiskPerTradeChange(parseFloat(e.target.value) || 0)}
          className="w-full px-2.5 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-white"
        />
      </div>
      <div className="col-span-2">
        <label className="block text-xs text-gray-400 mb-1">
          Max Daily Risk (%)
        </label>
        <input
          type="text"
          inputMode="decimal"
          value={maxDailyRisk}
          onChange={(e) => onMaxDailyRiskChange(parseFloat(e.target.value) || 0)}
          className="w-full px-2.5 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-white"
        />
      </div>
    </div>
  );
}
