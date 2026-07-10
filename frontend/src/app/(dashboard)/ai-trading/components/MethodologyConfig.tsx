"use client";

import { type MethodologyName, type MethodologyWeights, METHODOLOGY_LABELS, METHODOLOGY_COLORS } from "../types";
import { Brain } from "lucide-react";

interface MethodologyConfigProps {
  activeMethodologies: MethodologyName[];
  methodologyWeights: MethodologyWeights;
  onToggleMethodology: (method: MethodologyName) => void;
  onUpdateWeight: (method: MethodologyName, weight: number) => void;
  showConfig: boolean;
  onToggleConfig: () => void;
}

const ALL_METHODOLOGIES: MethodologyName[] = [
  "smc", "ict", "msnr", "crt", "quarterly", "lit", "rsiEngulf"
];

const MethodologyToggle = ({ method, active, weight, onToggle, onWeightChange }: {
  method: MethodologyName;
  active: boolean;
  weight: number;
  onToggle: () => void;
  onWeightChange: (weight: number) => void;
}) => (
  <div className="flex items-center gap-2 py-1">
    <input
      type="checkbox"
      checked={active}
      onChange={onToggle}
      className="rounded bg-gray-800 border-gray-600"
      style={{ accentColor: METHODOLOGY_COLORS[method] }}
    />
    <div
      className="w-2 h-2 rounded-full flex-shrink-0"
      style={{ backgroundColor: METHODOLOGY_COLORS[method] }}
    />
    <span className="flex-1 text-xs text-gray-300">
      {METHODOLOGY_LABELS[method]}
    </span>
    <input
      type="text"
      inputMode="decimal"
      value={weight}
      onChange={(e) => onWeightChange(parseFloat(e.target.value) || 0)}
      min={0}
      max={2}
      disabled={!active}
      className="w-14 px-1 py-0.5 bg-gray-800 border border-gray-700 rounded text-[10px] text-white text-right disabled:opacity-40"
    />
  </div>
);

export function MethodologyConfig({
  activeMethodologies,
  methodologyWeights,
  onToggleMethodology,
  onUpdateWeight,
  showConfig,
  onToggleConfig,
}: MethodologyConfigProps) {
  const activeCount = activeMethodologies.length;

  return (
    <div>
      <button
        onClick={onToggleConfig}
        className={`px-2 py-1 rounded text-xs font-medium transition flex items-center gap-1 ${
          showConfig
            ? "bg-accent-gold text-black font-semibold"
            : "bg-gray-800 text-gray-400 hover:text-white"
        }`}
      >
        <Brain className="w-3 h-3" />
        {activeCount}/7
      </button>

      {showConfig && (
        <div className="bg-gray-950 border border-gray-800 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-300">Active Methodologies</span>
            <div className="flex gap-1">
              <button
                onClick={() => ALL_METHODOLOGIES.forEach(m => onToggleMethodology(m))}
                className="text-[10px] text-gray-500 hover:text-white px-1.5 py-0.5 rounded bg-gray-800"
              >
                All
              </button>
              <button
                onClick={() => ALL_METHODOLOGIES.forEach(m => onToggleMethodology(m))}
                className="text-[10px] text-gray-500 hover:text-white px-1.5 py-0.5 rounded bg-gray-800"
              >
                None
              </button>
            </div>
          </div>

          {ALL_METHODOLOGIES.map((method) => (
            <MethodologyToggle
              key={method}
              method={method}
              active={activeMethodologies.includes(method)}
              weight={methodologyWeights[method]}
              onToggle={() => onToggleMethodology(method)}
              onWeightChange={(weight) => onUpdateWeight(method, weight)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
