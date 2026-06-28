"use client";

import React from "react";
import { ShieldAlert, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useMacroTerminal } from "./MacroTerminalContext";

export function CotPanel() {
  const { cotData, dataStatus } = useMacroTerminal();

  const getSentimentIcon = (sentiment: "BULLISH" | "BEARISH" | "NEUTRAL") => {
    if (sentiment === "BULLISH") return <TrendingUp className="w-4 h-4 text-data-profit" />;
    if (sentiment === "BEARISH") return <TrendingDown className="w-4 h-4 text-data-loss" />;
    return <Minus className="w-4 h-4 text-text-muted" />;
  };

  const getSentimentColor = (sentiment: "BULLISH" | "BEARISH" | "NEUTRAL") => {
    if (sentiment === "BULLISH") return "text-data-profit";
    if (sentiment === "BEARISH") return "text-data-loss";
    return "text-text-muted";
  };

  const renderSpread = (commercial: number, nonCommercial: number) => {
    const diff = Math.abs(commercial - nonCommercial);
    const isLarger = commercial > nonCommercial;
    return (
      <div className="flex items-center gap-1">
        <span>{isLarger ? "C" : "NC"}: {diff.toFixed(0)}</span>
        {isLarger ? (
          <ShieldAlert className="w-3 h-3 text-accent-gold" />
        ) : (
          <ShieldAlert className="w-3 h-3 text-text-muted" />
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full glass border border-border-subtle rounded-xl overflow-hidden">
      <div className="flex items-center justify-between border-b border-border-subtle p-3">
        <h2 className="font-bold text-text-primary uppercase tracking-wider text-[10px] sm:text-xs">
          Commitment of Traders (COT)
        </h2>
        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
          dataStatus.cot === "live"
            ? "text-data-profit border-data-profit/30 bg-data-profit/10"
            : dataStatus.cot === "cache"
              ? "text-data-warning border-data-warning/30 bg-data-warning/10"
              : "text-text-muted border-border-subtle bg-surface-elevated/50"
        }`}>
          {dataStatus.cot.toUpperCase()}
        </span>
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
              {cotData.map((position) => (
                <tr key={position.symbol} className="border-b border-border-subtle/50 hover:bg-white/5">
                  <td className="p-2">
                    <div className="font-mono font-bold">{position.symbol}</div>
                    <div className="text-text-muted text-[10px]">{position.name}</div>
                  </td>
                  <td className="p-2">
                    <div className={`flex items-center gap-1 ${getSentimentColor(position.sentiment)}`}>
                      {getSentimentIcon(position.sentiment)}
                      <span className="uppercase text-[10px]">{position.sentiment}</span>
                    </div>
                  </td>
                  <td className="p-2 text-center">
                    <div>{position.commercialLong} / {position.commercialShort}</div>
                    <div className="text-text-muted text-[10px]">Long / Short</div>
                  </td>
                  <td className="p-2 text-center">
                    <div>{position.nonCommercialLong} / {position.nonCommercialShort}</div>
                    <div className="text-text-muted text-[10px]">Long / Short</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="shrink-0 p-2 text-[9px] text-text-muted border-t border-border-subtle">
        Data: CFTC Commitments of Traders Report | Last Update: {cotData[0]?.lastUpdate ? new Date(cotData[0].lastUpdate).toLocaleDateString("id-ID") : "-"}
      </div>
    </div>
  );
}