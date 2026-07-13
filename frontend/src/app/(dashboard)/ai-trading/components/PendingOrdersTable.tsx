"use client";

import { useState } from "react";
import { XCircle, Loader2 } from "lucide-react";

interface PendingOrder {
  ticket: number;
  symbol: string;
  type: "BUY_LIMIT" | "SELL_LIMIT" | "BUY_STOP" | "SELL_STOP" | string | number;
  volume?: number;
  volume_initial?: number;
  volume_current?: number;
  price?: number;
  price_open?: number;
  sl: number;
  tp: number;
  time_setup: number;
  comment?: string;
}

interface PendingOrdersTableProps {
  orders: PendingOrder[];
  onCancel: (ticket: number) => void;
}

export function PendingOrdersTable({ orders, onCancel }: PendingOrdersTableProps) {
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const getOrderTypeName = (type: any) => {
    if (typeof type === 'string') return type;
    switch (Number(type)) {
      case 0: return "BUY";
      case 1: return "SELL";
      case 2: return "BUY_LIMIT";
      case 3: return "SELL_LIMIT";
      case 4: return "BUY_STOP";
      case 5: return "SELL_STOP";
      case 6: return "BUY_STOP_LIMIT";
      case 7: return "SELL_STOP_LIMIT";
      case 8: return "CLOSE_BY";
      default: return `UNKNOWN (${type})`;
    }
  };

  const formatPrice = (price?: number | null) => {
    if (!price) return "";
    if (price > 1000) return price.toFixed(2);
    if (price > 10) return price.toFixed(3);
    return price.toFixed(5);
  };

  // Date format will be inline like PositionsTable

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
              <th className="text-left px-2 py-2 font-medium">Time</th>
              <th className="text-left px-2 py-2 font-medium">Type</th>
              <th className="text-right px-2 py-2 font-medium">Volume</th>
              <th className="text-right px-2 py-2 font-medium">Price</th>
              <th className="text-right px-2 py-2 font-medium">S / L</th>
              <th className="text-right px-2 py-2 font-medium">T / P</th>
              <th className="text-left px-2 py-2 font-medium">Comment</th>
              <th className="text-right px-2 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((ord) => {
              const typeStr = getOrderTypeName(ord.type);
              return (
                <tr
                  key={ord.ticket}
                  className="border-b border-gray-800/50 hover:bg-gray-800/30 transition"
                >
                  <td className="px-2 py-2.5 font-medium text-blue-400">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 border border-blue-500 rounded-sm flex items-center justify-center text-[6px]">↑</span>
                      {ord.symbol.toLowerCase()}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-gray-400 text-xs">
                    {ord.ticket}
                  </td>
                  <td className="px-2 py-2.5 text-gray-400 text-xs tabular-nums whitespace-nowrap">
                    {(() => {
                      const d = new Date(ord.time_setup * 1000);
                      const pad = (n: number) => n.toString().padStart(2, "0");
                      return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
                    })()}
                  </td>
                  <td className="px-2 py-2.5 text-gray-300">
                    {typeStr.toLowerCase()}
                  </td>
                  <td className="px-2 py-2.5 text-right text-gray-300 tabular-nums">
                    {(ord.volume_initial || ord.volume_current || ord.volume || 0).toFixed(2)}
                  </td>
                  <td className="px-2 py-2.5 text-right text-gray-300 tabular-nums whitespace-nowrap">
                    {formatPrice(ord.price_open || ord.price)}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums">
                    <span className={`${ord.sl ? "text-gray-300" : "text-gray-500"}`}>
                      {ord.sl ? formatPrice(ord.sl) : ""}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums">
                    <span className={`${ord.tp ? "text-gray-300" : "text-gray-500"}`}>
                      {ord.tp ? formatPrice(ord.tp) : ""}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-left text-gray-400 text-xs max-w-[80px] truncate" title={ord.comment}>
                    {ord.comment || ""}
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleCancel(ord.ticket)}
                        disabled={cancellingId === ord.ticket}
                        className="p-1.5 bg-red-500/10 text-red-400 rounded hover:bg-red-500/20 transition disabled:opacity-50"
                        title="Cancel Order"
                      >
                        {cancellingId === ord.ticket ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
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
