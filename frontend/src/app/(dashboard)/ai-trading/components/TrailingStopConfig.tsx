"use client";

interface TrailingStopConfigProps {
  enabled: boolean;
  activationATR: number;
  trailATR: number;
  onToggle: (enabled: boolean) => void;
  onActivationATRChange: (value: number) => void;
  onTrailATRChange: (value: number) => void;
}

export function TrailingStopConfig({
  enabled,
  activationATR,
  trailATR,
  onToggle,
  onActivationATRChange,
  onTrailATRChange,
}: TrailingStopConfigProps) {
  return (
    <div>
      <label className="flex items-center gap-2 text-xs text-gray-400 mb-1.5">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
          className="rounded bg-gray-800 border-gray-600"
        />
        Trailing Stop
      </label>
      {enabled && (
        <div className="grid grid-cols-2 gap-2 mt-2">
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">
              Activation (ATR)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={activationATR}
              onChange={(e) => onActivationATRChange(parseFloat(e.target.value) || 0)}
              className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">
              Trail Distance (ATR)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={trailATR}
              onChange={(e) => onTrailATRChange(parseFloat(e.target.value) || 0)}
              className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}
