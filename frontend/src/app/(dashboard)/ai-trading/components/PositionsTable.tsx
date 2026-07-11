"use client";

import { useState } from "react";
import { type Position } from "@/services/ai-trading.service";
import { SkeletonLoader } from "./SkeletonLoader";
import { EmptyState } from "./EmptyState";
import {
  XCircle,
  Pencil,
  TrendingUp,
  TrendingDown,
  Loader2,
  Save,
  RefreshCw,
} from "lucide-react";

interface PositionsTableProps {
  positions: Position[];
  onClose: (ticket: number) => void;
  onModify: (ticket: number, sl?: number, tp?: number) => void;
  isLoading: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function PositionsTable({
  positions,
  onClose,
  onModify,
  isLoading,
  error,
  onRetry,
}: PositionsTableProps) {
  const formatPrice = (price?: number | null) => {
    if (!price) return "";
    if (price > 1000) return price.toFixed(2);
    if (price > 10) return price.toFixed(3);
    return price.toFixed(5);
  };

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editSL, setEditSL] = useState("");
  const [editTP, setEditTP] = useState("");
  const [closingId, setClosingId] = useState<number | null>(null);

  const startEdit = (pos: Position) => {
    setEditingId(pos.ticket);
    setEditSL(String(pos.sl || 0));
    setEditTP(String(pos.tp || 0));
  };

  const saveEdit = async (pos: Position) => {
    const parsedSL = editSL !== "" ? parseFloat(editSL) : 0;
    const parsedTP = editTP !== "" ? parseFloat(editTP) : 0;

    // Prevent calling API if values haven't changed (MT5 retcode 10025)
    if (parsedSL === (pos.sl || 0) && parsedTP === (pos.tp || 0)) {
      setEditingId(null);
      return;
    }

    await onModify(pos.ticket, parsedSL, parsedTP);
    setEditingId(null);
  };

  const [isClosingAll, setIsClosingAll] = useState(false);
  const handleCloseAll = async () => {
    if (!window.confirm("Are you sure you want to close ALL open positions?")) return;
    setIsClosingAll(true);
    // Execute sequentially to avoid overloading the bridge
    for (const pos of positions) {
      await onClose(pos.ticket);
    }
    setIsClosingAll(false);
  };

  const handleClose = async (ticket: number) => {
    setClosingId(ticket);
    await onClose(ticket);
    setClosingId(null);
  };

  if (isLoading) {
    return <SkeletonLoader type="table" count={5} />;
  }

  if (error) {
    return (
      <EmptyState
        type="error"
        title="Error Loading Positions"
        description={error}
        actionText="Retry"
        onAction={onRetry}
      />
    );
  }

  if (positions.length === 0) {
    return (
      <EmptyState
        type="positions"
        title="No Open Positions"
        description="You don't have any open positions at the moment."
      />
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 flex justify-between items-center">
        <h3 className="text-sm font-semibold text-white">
          Open Positions
          <span className="ml-2 text-gray-500 font-normal">
            ({positions.length})
          </span>
        </h3>
        {positions.length > 0 && (
          <button
            onClick={handleCloseAll}
            disabled={isClosingAll}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition text-xs font-medium disabled:opacity-50"
          >
            {isClosingAll ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <XCircle className="w-3.5 h-3.5" />
            )}
            Close All
          </button>
        )}
      </div>

      {error && (
        <div className="px-4 py-3 text-center text-sm text-red-400 bg-red-500/5 border-b border-red-500/10 flex items-center justify-center gap-2">
          <span>⚠ {error}</span>
          {onRetry && (
            <button onClick={onRetry} className="inline-flex items-center gap-1 px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-gray-300 transition text-xs">
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </button>
          )}
        </div>
      )}

      {positions.length === 0 && !error ? (
        <div className="px-4 py-8 text-center text-gray-500 text-sm">
          No open positions
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
                <th className="text-left px-2 py-2 font-medium">Symbol</th>
                <th className="text-left px-2 py-2 font-medium">Ticket</th>
                <th className="text-left px-2 py-2 font-medium">Time</th>
                <th className="text-left px-2 py-2 font-medium">Type</th>
                <th className="text-right px-2 py-2 font-medium">Volume</th>
                <th className="text-right px-2 py-2 font-medium">Price</th>
                <th className="text-right px-2 py-2 font-medium">S / L</th>
                <th className="text-right px-2 py-2 font-medium">T / P</th>
                <th className="text-right px-2 py-2 font-medium">Price</th>
                <th className="text-right px-2 py-2 font-medium">Swap</th>
                <th className="text-right px-2 py-2 font-medium">Profit</th>
                <th className="text-left px-2 py-2 font-medium">Comment</th>
                <th className="text-right px-2 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((pos) => (
                <tr
                  key={pos.ticket}
                  className="border-b border-gray-800/50 hover:bg-gray-800/30 transition"
                >
                  <td className="px-2 py-2.5 font-medium text-blue-400">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 border border-blue-500 rounded-sm flex items-center justify-center text-[6px]">↑</span>
                      {pos.symbol.toLowerCase()}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-gray-400 text-xs">
                    {pos.ticket}
                  </td>
                  <td className="px-2 py-2.5 text-gray-400 text-xs tabular-nums whitespace-nowrap">
                    {(() => {
                      const d = new Date(pos.time * 1000);
                      const pad = (n: number) => n.toString().padStart(2, "0");
                      return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
                    })()}
                  </td>
                  <td className="px-2 py-2.5 text-gray-300">
                    {pos.type.toLowerCase()}
                  </td>
                  <td className="px-2 py-2.5 text-right text-gray-300 tabular-nums">
                    {pos.volume.toFixed(2)}
                  </td>
                  <td className="px-2 py-2.5 text-right text-gray-300 tabular-nums whitespace-nowrap">
                    {formatPrice(pos.priceOpen)}
                  </td>

                  {/* S / L column (editable) */}
                  <td className="px-2 py-2.5 text-right tabular-nums">
                    {editingId === pos.ticket ? (
                      <input
                        type="number"
                        step="0.00001"
                        value={editSL}
                        onChange={(e) => setEditSL(e.target.value)}
                        className="w-[72px] px-1 py-0.5 bg-gray-800 border border-gray-700 rounded text-right text-xs text-white"
                      />
                    ) : (
                      <span
                        className={`${pos.sl ? "text-gray-300" : "text-gray-500"}`}
                      >
                        {pos.sl ? formatPrice(pos.sl) : ""}
                      </span>
                    )}
                  </td>

                  {/* T / P column (editable) */}
                  <td className="px-2 py-2.5 text-right tabular-nums">
                    {editingId === pos.ticket ? (
                      <input
                        type="number"
                        step="0.00001"
                        value={editTP}
                        onChange={(e) => setEditTP(e.target.value)}
                        className="w-[72px] px-1 py-0.5 bg-gray-800 border border-gray-700 rounded text-right text-xs text-white"
                      />
                    ) : (
                      <span
                        className={`${pos.tp ? "text-gray-300" : "text-gray-500"}`}
                      >
                        {pos.tp ? formatPrice(pos.tp) : ""}
                      </span>
                    )}
                  </td>

                  <td className="px-2 py-2.5 text-right text-gray-300 tabular-nums whitespace-nowrap">
                    {formatPrice(pos.priceCurrent)}
                  </td>

                  {/* Swap */}
                  <td className="px-2 py-2.5 text-right tabular-nums text-gray-400">
                    {pos.swap ? pos.swap.toFixed(2) : ""}
                  </td>

                  {/* Profit */}
                  <td
                    className={`px-2 py-2.5 text-right font-medium tabular-nums whitespace-nowrap ${
                      pos.profit >= 0 ? "text-blue-400" : "text-red-400"
                    }`}
                  >
                    {pos.profit.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0")}
                  </td>

                  {/* Comment */}
                  <td className="px-2 py-2.5 text-left text-gray-400 text-xs max-w-[80px] truncate" title={pos.comment}>
                    {pos.comment || ""}
                  </td>

                  {/* Actions */}
                  <td className="px-2 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {editingId === pos.ticket ? (
                        <button
                          onClick={() => saveEdit(pos)}
                          className="p-1.5 bg-green-600/20 text-green-400 rounded hover:bg-green-600/30 transition"
                          title="Save"
                        >
                          <Save className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => startEdit(pos)}
                          className="p-1.5 bg-gray-800 text-gray-400 rounded hover:text-white transition"
                          title="Modify SL/TP"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleClose(pos.ticket)}
                        disabled={closingId === pos.ticket}
                        className="p-1.5 bg-red-500/10 text-red-400 rounded hover:bg-red-500/20 transition disabled:opacity-50"
                        title="Close position"
                      >
                        {closingId === pos.ticket ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
