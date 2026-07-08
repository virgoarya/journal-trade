"use client";

import { type PipelineLog } from "@/services/ai-trading.service";
import { ScrollText, Signal, ShoppingCart, AlertTriangle, Activity } from "lucide-react";

interface PipelineLogsProps {
  logs: PipelineLog[];
  isLoading?: boolean;
}

const LOG_ICONS: Record<
  string,
  { icon: React.ElementType; color: string }
> = {
  INFO: { icon: ScrollText, color: "text-gray-400" },
  SIGNAL: { icon: Signal, color: "text-blue-400" },
  TRADE: { icon: ShoppingCart, color: "text-green-400" },
  ERROR: { icon: AlertTriangle, color: "text-red-400" },
  TRAILING: { icon: Activity, color: "text-yellow-400" },
};

export function PipelineLogs({ logs, isLoading }: PipelineLogsProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <ScrollText className="w-4 h-4 text-gray-400" />
          Pipeline Activity
        </h3>
        <span className="text-xs text-gray-500">{logs.length} entries</span>
      </div>

      {/* Logs */}
      <div className="max-h-64 overflow-y-auto">
        {isLoading ? (
          <div className="px-4 py-8 text-center text-gray-500 text-sm">
            Loading logs...
          </div>
        ) : logs.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500 text-sm">
            No activity yet. Start the pipeline to see logs.
          </div>
        ) : (
          <div className="divide-y divide-gray-800/50">
            {[...logs].reverse().map((log, i) => {
              const meta = LOG_ICONS[log.type] || LOG_ICONS.INFO;
              const Icon = meta.icon;

              return (
                <div key={i} className="px-4 py-2 hover:bg-gray-800/30 transition">
                  <div className="flex items-start gap-2">
                    <Icon className={`w-3.5 h-3.5 mt-0.5 ${meta.color} shrink-0`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-300">{log.message}</p>
                      <p className="text-[10px] text-gray-600 mt-0.5">
                        {new Date(log.time).toLocaleDateString("en-GB") + " " + new Date(log.time).toLocaleTimeString([], { hour12: false })}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Color legend */}
      <div className="px-4 py-2 border-t border-gray-800 flex gap-3">
        {Object.entries(LOG_ICONS).map(([type, meta]) => {
          const Icon = meta.icon;
          return (
            <span key={type} className="flex items-center gap-1 text-[10px] text-gray-600">
              <Icon className={`w-3 h-3 ${meta.color}`} />
              {type}
            </span>
          );
        })}
      </div>
    </div>
  );
}
