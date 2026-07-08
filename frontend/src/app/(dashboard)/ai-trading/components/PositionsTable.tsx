"use client";

import { useState } from "react";
import { type Position } from "@/services/ai-trading.service";
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
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editSL, setEditSL] = useState("");
  const [editTP, setEditTP] = useState("");
  const [closingId, setClosingId] = useState<number | null>(null);

  const startEdit = (pos: Position) => {
    setEditingId(pos.ticket);
    setEditSL(String(pos.sl || 0));
    setEditTP(String(pos.tp || 0));
  };

  const saveEdit = async (ticket: number) => {
    await onModify(
      ticket,
      parseFloat(editSL) || undefined,
      parseFloat(editTP) || undefined,
    );
    setEditingId(null);
  };

  const handleClose = async (ticket: number) => {
    setClosingId(ticket);
    await onClose(ticket);
    setClosingId(null);
  };

  if (isLoading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8">
        <div className="flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-400">Loading positions...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800">
        <h3 className="text-sm font-semibold text-white">
          Open Positions
          <span className="ml-2 text-gray-500 font-normal">
            ({positions.length})
          </span>
        </h3>
      </div>

      {error && (
        <div className="px-4 py-3 text-center text-red-400 text-xs border-b border-gray-800/50 flex items-center justify-center gap-2">
          <span>⚠ {error}</span>
          {onRetry && (
            <button onClick={onRetry} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-800 hover:bg-gray-700 rounded text-gray-300 transition">
              <RefreshCw className="w-3 h-3" /> Retry
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
                <th className="text-left px-3 py-2">Symbol</th>
                <th className="text-left px-3 py-2">Type</th>
                <th className="text-right px-3 py-2">Volume</th>
                <th className="text-right px-3 py-2">Entry</th>
                <th className="text-right px-3 py-2">Current</th>
                <th className="text-right px-3 py-2">SL</th>
                <th className="text-right px-3 py-2">TP</th>
                <th className="text-left px-3 py-2">Comment</th>
                <th className="text-center px-3 py-2">Magic</th>
                <th className="text-right px-3 py-2">P&L</th>
                <th className="text-right px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((pos) => (
                <tr
                  key={pos.ticket}
                  className="border-b border-gray-800/50 hover:bg-gray-800/30 transition"
                >
                  <td className="px-3 py-2.5 font-medium text-white">
                    {pos.symbol}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded ${
                        pos.type === "BUY"
                          ? "bg-green-500/10 text-green-400"
                          : "bg-red-500/10 text-red-400"
                      }`}
                    >
                      {pos.type === "BUY" ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      {pos.type}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-300">
                    {pos.volume}
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-300">
                    {pos.priceOpen.toFixed(5)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-300">
                    {pos.priceCurrent.toFixed(5)}
                  </td>

                  {/* SL column (editable) */}
                  <td className="px-3 py-2.5 text-right">
                    {editingId === pos.ticket ? (
                      <input
                        type="number"
                        step="0.00001"
                        value={editSL}
                        onChange={(e) => setEditSL(e.target.value)}
                        className="w-20 px-1 py-0.5 bg-gray-800 border border-gray-700 rounded text-right text-xs text-white"
                      />
                    ) : (
                      <span
                        className={`${pos.sl ? "text-gray-300" : "text-gray-500"}`}
                      >
                        {pos.sl ? pos.sl.toFixed(5) : "—"}
                      </span>
                    )}
                  </td>

                  {/* TP column (editable) */}
                  <td className="px-3 py-2.5 text-right">
                    {editingId === pos.ticket ? (
                      <input
                        type="number"
                        step="0.00001"
                        value={editTP}
                        onChange={(e) => setEditTP(e.target.value)}
                        className="w-20 px-1 py-0.5 bg-gray-800 border border-gray-700 rounded text-right text-xs text-white"
                      />
                    ) : (
                      <span
                        className={`${pos.tp ? "text-gray-300" : "text-gray-500"}`}
                      >
                        {pos.tp ? pos.tp.toFixed(5) : "—"}
                      </span>
                    )}
                  </td>

                  {/* Comment */}
                  <td className="px-3 py-2.5 text-left text-gray-400 text-xs max-w-[120px] truncate" title={pos.comment}>
                    {pos.comment || "—"}
                  </td>

                  {/* Magic */}
                  <td className="px-3 py-2.5 text-center">
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${pos.magic ? `${pos.magic > 1000 ? "bg-purple-500/10 text-purple-400" : "bg-gray-500/10 text-gray-400"}` : "text-gray-500"}`}>
                      {pos.magic || "—"}
                    </span>
                  </td>

                  {/* P&L */}
                  <td
                    className={`px-3 py-2.5 text-right font-medium ${
                      pos.profit >= 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {pos.profit >= 0 ? "+" : ""}
                    {pos.profit.toFixed(2)}
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {editingId === pos.ticket ? (
                        <button
                          onClick={() => saveEdit(pos.ticket)}
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
