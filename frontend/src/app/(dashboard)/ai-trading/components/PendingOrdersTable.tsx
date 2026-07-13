"use client";

import { useState } from "react";
import { XCircle, Loader2 } from "lucide-react";

interface PendingOrder {
  ticket: number;
  symbol: string;
  type: "BUY_LIMIT" | "SELL_LIMIT" | "BUY_STOP" | "SELL_STOP" | string;
  volume: number;
  price: number;
  sl: number;
  tp: number;
  time_setup: number;
}

interface PendingOrdersTableProps {
  orders: PendingOrder[];
  onCancel: (ticket: number) => void;
}

export function PendingOrdersTable({ orders, onCancel }: PendingOrdersTableProps) {
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const formatPrice = (price?: number | null) => {
    if (!price) return "";
    if (price > 1000) return price.toFixed(2);
    if (price > 10) return price.toFixed(3);
    return price.toFixed(5);
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts * 1000);
    return d.toLocaleString("id-ID", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const handleCancel = async (ticket: number) => {
    if (!window.confirm(`Are you sure you want to cancel pending order #${ticket}?`)) return;
    setCancellingId(ticket);
    await onCancel(ticket);
    setCancellingId(null);
  };

  if (!orders || orders.length === 0) return null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mt-4">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 flex justify-between items-center">
        <h3 className="text-sm font-semibold text-white">
          Pending Orders
          <span className="ml-2 text-gray-500 font-normal">
            ({orders.length})
          </span>
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wider">
              <th className="text-left px-2 py-2 font-medium">Symbol</th>
              <th className="text-left px-2 py-2 font-medium">Ticket</th>
              <th className="text-left px-2 py-2 font-medium">Time Setup</th>
              <th className="text-left px-2 py-2 font-medium">Type</th>
              <th className="text-right px-2 py-2 font-medium">Volume</th>
              <th className="text-right px-2 py-2 font-medium">Order Price</th>
              <th className="text-right px-2 py-2 font-medium">S / L</th>
              <th className="text-right px-2 py-2 font-medium">T / P</th>
              <th className="text-right px-2 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((ord) => {
              const isBuy = ord.type.includes("BUY");
              return (
                <tr
                  key={ord.ticket}
                  className="border-b border-gray-800/50 hover:bg-gray-800/30 transition"
                >
                  <td className="px-2 py-2.5 font-medium text-amber-500">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 border border-amber-500 rounded-sm flex items-center justify-center text-[8px] font-bold">⏱</span>
                      {ord.symbol.toLowerCase()}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-gray-400 font-mono text-xs">{ord.ticket}</td>
                  <td className="px-2 py-2.5 text-gray-400 text-xs">{formatDate(ord.time_setup)}</td>
                  <td className={`px-2 py-2.5 font-semibold text-xs ${isBuy ? "text-green-500" : "text-red-500"}`}>
                    {ord.type}
                  </td>
                  <td className="px-2 py-2.5 text-right font-medium text-white">{ord.volume.toFixed(2)}</td>
                  <td className="px-2 py-2.5 text-right text-gray-300 font-mono">{formatPrice(ord.price)}</td>
                  <td className="px-2 py-2.5 text-right text-red-400/80 font-mono">{ord.sl ? formatPrice(ord.sl) : "-"}</td>
                  <td className="px-2 py-2.5 text-right text-green-400/80 font-mono">{ord.tp ? formatPrice(ord.tp) : "-"}</td>
                  <td className="px-2 py-2.5 text-right">
                    <button
                      onClick={() => handleCancel(ord.ticket)}
                      disabled={cancellingId === ord.ticket}
                      className="inline-flex items-center justify-center p-1 hover:bg-red-500/10 text-gray-500 hover:text-red-400 rounded transition disabled:opacity-50"
                      title="Cancel Order"
                    >
                      {cancellingId === ord.ticket ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
