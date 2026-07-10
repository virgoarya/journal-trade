"use client";

import { useState } from "react";
import { type PipelineLog } from "@/services/ai-trading.service";
import { SkeletonLoader } from "./SkeletonLoader";
import { EmptyState } from "./EmptyState";
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
  const [filterType, setFilterType] = useState("");
  const logTypes = ["INFO", "SIGNAL", "TRADE", "ERROR", "TRAILING", "CONFLUENCE"];

  const filteredLogs = filterType
    ? logs.filter(l => l.type === filterType)
    : logs;

  if (isLoading) {
    return <SkeletonLoader type="list" count={5} />;
  }

  if (logs.length === 0) {
    return (
      <EmptyState
        type="data"
        title="No Pipeline Logs"
        description="No pipeline activity logs available yet."
      />
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <ScrollText className="w-4 h-4 text-gray-400" />
          Pipeline Activity
        </h3>
        <span className="text-xs text-gray-500">{filteredLogs.length}/{logs.length} entries</span>
      </div>

      {/* Filter */}
      <div className="px-4 py-2 border-b border-gray-800/50 flex gap-1.5">
        {["", ...logTypes].map(type => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`px-2 py-0.5 text-[10px] rounded font-medium transition ${
              filterType === type
                ? "bg-accent-gold text-black"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            {type || "All"}
          </button>
        ))}
      </div>

      {/* Logs */}
      <div className="max-h-64 overflow-y-auto">
          <div className="divide-y divide-gray-800/50">
            {[...filteredLogs].reverse().map((log, i) => {
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
