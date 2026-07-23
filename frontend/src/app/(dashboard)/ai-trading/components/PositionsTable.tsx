"use client";

import { useState } from "react";
import { type Position } from "@/services/ai-trading.service";
import { SkeletonLoader } from "./SkeletonLoader";
import { EmptyState } from "./EmptyState";
import {
  XCircle,
  Pencil,
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

  const getSLTPColor = (pos: Position) => {
    if (!pos.sl || !pos.tp || pos.sl === pos.tp) return "";
    const ratio = (pos.priceCurrent - pos.sl) / (pos.tp - pos.sl);
    const threshold = 0.2;
    if (ratio < threshold) return "text-neon-red drop-shadow-[0_0_2px_rgba(255,56,100,0.4)]";
    if (ratio > 1 - threshold) return "text-neon-green drop-shadow-[0_0_2px_rgba(57,255,136,0.4)]";
    return "text-text-primary";
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
    return null;
  }

  return (
    <div className="glass overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-accent-gold/20 flex justify-between items-center bg-black/20">
        <h3 className="text-[11px] font-bold tracking-widest uppercase text-accent-gold drop-shadow-[0_0_4px_rgba(212,175,55,0.4)]">
          Open Positions
          <span className="ml-2 text-accent-gold-dim">
            [{positions.length}]
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
              <tr className="border-b border-accent-gold/10 text-accent-gold-dim text-[10px] uppercase tracking-wider bg-black/40">
                <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Symbol</th>
                <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Ticket</th>
                <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Time</th>
                <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Type</th>
                <th className="text-right px-3 py-2 font-medium whitespace-nowrap">Volume</th>
                <th className="text-right px-3 py-2 font-medium whitespace-nowrap">Open</th>
                <th className="text-right px-3 py-2 font-medium whitespace-nowrap">S / L</th>
                <th className="text-right px-3 py-2 font-medium whitespace-nowrap">T / P</th>
                <th className="text-right px-3 py-2 font-medium whitespace-nowrap">Current</th>
                <th className="text-right px-3 py-2 font-medium whitespace-nowrap">Swap</th>
                <th className="text-right px-3 py-2 font-medium whitespace-nowrap">Profit</th>
                <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Comment</th>
                <th className="text-right px-3 py-2 font-medium whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((pos) => (
                <tr
                  key={pos.ticket}
                  className="border-b border-accent-gold/10 hover:bg-accent-gold/5 transition group"
                >
                  <td className="px-3 py-2.5 font-mono text-text-primary">
                    <span className="inline-flex items-center gap-2 bg-black/50 border border-accent-gold/20 px-2 py-0.5 rounded shadow-[inset_0_0_8px_rgba(212,175,55,0.1)]">
                      <span className={`w-2 h-2 rounded-full animate-pulse shadow-[0_0_4px_currentColor] ${pos.type.toLowerCase() === 'buy' ? 'bg-neon-green text-neon-green' : 'bg-neon-red text-neon-red'}`} />
                      {pos.symbol.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-text-muted text-[10px] font-mono">
                    #{pos.ticket}
                  </td>
                  <td className="px-3 py-2.5 text-text-muted text-[10px] tabular-nums whitespace-nowrap font-mono">
                    {(() => {
                      const d = new Date(pos.time * 1000);
                      const pad = (n: number) => n.toString().padStart(2, "0");
                      return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
                    })()}
                  </td>
                  <td className={`px-3 py-2.5 text-[10px] font-bold font-mono tracking-wider ${pos.type.toLowerCase() === 'buy' ? 'text-neon-green' : 'text-neon-red'}`}>
                    {pos.type.toUpperCase()}
                  </td>
                  <td className="px-3 py-2.5 text-right text-text-primary font-mono tabular-nums">
                    {pos.volume.toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-text-primary font-mono tabular-nums whitespace-nowrap">
                    {formatPrice(pos.priceOpen)}
                  </td>

                  {/* S / L column (editable) */}
                  <td className="px-3 py-2.5 text-right tabular-nums font-mono">
                    {editingId === pos.ticket ? (
                      <input
                        type="number"
                        step="0.00001"
                        value={editSL}
                        onChange={(e) => setEditSL(e.target.value)}
                        className="w-[72px] px-1 py-0.5 bg-black/60 border border-accent-gold/40 rounded text-right text-xs text-text-primary focus:outline-none focus:border-accent-gold focus:shadow-[0_0_4px_rgba(212,175,55,0.6)]"
                      />
                    ) : (
                      <span
                        className={`${pos.sl ? getSLTPColor(pos) : "text-text-muted/50"}`}
                      >
                        {pos.sl ? formatPrice(pos.sl) : "-"}
                      </span>
                    )}
                  </td>

                  {/* T / P column (editable) */}
                  <td className="px-3 py-2.5 text-right tabular-nums font-mono">
                    {editingId === pos.ticket ? (
                      <input
                        type="number"
                        step="0.00001"
                        value={editTP}
                        onChange={(e) => setEditTP(e.target.value)}
                        className="w-[72px] px-1 py-0.5 bg-black/60 border border-accent-gold/40 rounded text-right text-xs text-text-primary focus:outline-none focus:border-accent-gold focus:shadow-[0_0_4px_rgba(212,175,55,0.6)]"
                      />
                    ) : (
                      <span
                        className={`${pos.tp ? getSLTPColor(pos) : "text-text-muted/50"}`}
                      >
                        {pos.tp ? formatPrice(pos.tp) : "-"}
                      </span>
                    )}
                  </td>

                  <td className="px-3 py-2.5 text-right text-accent-gold font-mono font-bold tabular-nums whitespace-nowrap drop-shadow-[0_0_2px_rgba(212,175,55,0.4)]">
                    {formatPrice(pos.priceCurrent)}
                  </td>

                  {/* Swap */}
                  <td className="px-3 py-2.5 text-right tabular-nums text-text-muted font-mono text-xs">
                    {pos.swap ? pos.swap.toFixed(2) : "-"}
                  </td>

                  {/* Profit */}
                  <td
                    className={`px-3 py-2.5 text-right font-bold tabular-nums whitespace-nowrap font-mono text-[15px] ${
                      pos.profit >= 0 ? "text-neon-green drop-shadow-[0_0_6px_rgba(57,255,136,0.5)]" : "text-neon-red drop-shadow-[0_0_6px_rgba(255,56,100,0.5)]"
                    }`}
                  >
                    {pos.profit >= 0 ? "+" : ""}{pos.profit.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
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
