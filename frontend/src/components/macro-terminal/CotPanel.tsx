export const dynamic = "force-dynamic";
export const revalidate = 0;

import React from "react";
import { ShieldAlert, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { TransformedCotData } from "@/types/cot";

async function fetchCotData(): Promise<TransformedCotData[]> {
  try {
    const res = await fetch("https://hunter-trades.com/api/macro/cot", {
      cache: "no-store",
    });

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    return data.data || [];
  } catch {
    return [];
  }
}

function getSentimentIcon(sentiment: "BULLISH" | "BEARISH" | "NEUTRAL") {
  if (sentiment === "BULLISH") return <TrendingUp className="w-4 h-4 text-data-profit" />;
  if (sentiment === "BEARISH") return <TrendingDown className="w-4 h-4 text-data-loss" />;
  return <Minus className="w-4 h-4 text-text-muted" />;
}

function getSentimentColor(sentiment: "BULLISH" | "BEARISH" | "NEUTRAL") {
  if (sentiment === "BULLISH") return "text-data-profit";
  if (sentiment === "BEARISH") return "text-data-loss";
  return "text-text-muted";
}

export default async function CotPanel() {
  const cotData = await fetchCotData();

  return (
    <div className="flex flex-col h-full glass border border-border-subtle rounded-xl overflow-hidden">
      <div className="flex items-center justify-between border-b border-border-subtle p-3">
        <h2 className="font-bold text-text-primary uppercase tracking-wider text-[10px] sm:text-xs">
          Commitment of Traders (COT)
        </h2>
      </div>

      <div className="flex-1 overflow-auto">
        {cotData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-text-muted text-sm">
            Data COT tidak tersedia
          </div>
        ) : (
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-border-subtle text-text-muted">
                <th className="text-left p-2">Simbol</th>
                <th className="text-left p-2">Sentimen</th>
                <th className="text-center p-2">Komersial</th>
                <th className="text-center p-2">Non-Komersial</th>
              </tr>
            </thead>
            <tbody>
              {cotData.map((item) => (
                <tr key={item.symbol} className="border-b border-border-subtle/50 hover:bg-white/5">
                  <td className="p-2">
                    <div className="font-mono font-bold">{item.symbol}</div>
                    <div className="text-text-muted text-[10px]">{item.name}</div>
                  </td>
                  <td className="p-2">
                    <div className={`flex items-center gap-1 ${getSentimentColor(item.sentiment)}`}>
                      {getSentimentIcon(item.sentiment)}
                      <span className="uppercase text-[10px]">{item.sentiment}</span>
                    </div>
                  </td>
                  <td className="p-2 text-center">
                    <div>{item.commercialLong} / {item.commercialShort}</div>
                    <div className="text-text-muted text-[10px]">Long / Short</div>
                  </td>
                  <td className="p-2 text-center">
                    <div>{item.nonCommercialLong} / {item.nonCommercialShort}</div>
                    <div className="text-text-muted text-[10px]">Long / Short</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="shrink-0 p-2 text-[9px] text-text-muted border-t border-border-subtle">
        Data: CFTC Commitments of Traders Report | Last Update:{" "}
        {cotData[0]?.lastUpdate
          ? new Date(cotData[0].lastUpdate).toLocaleDateString("id-ID")
          : "-"}
      </div>
    </div>
  );
}