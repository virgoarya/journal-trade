"use client";

import React from 'react';

interface HeatmapData {
  day: string;
  sessions: {
    name: string;
    pnl: number;
    count: number;
  }[];
}

interface HeatmapProps {
  data: HeatmapData[];
}

export const Heatmap: React.FC<HeatmapProps> = ({ data }) => {
  if (!data || !Array.isArray(data)) return null;

  // Find max PnL for scaling (or use a sensible default)
  const allPnls = data.flatMap(d => d.sessions.map(s => Math.abs(s.pnl)));
  const maxPnL = Math.max(...allPnls, 100);

  const getCellColor = (pnl: number) => {
    if (pnl === 0) return 'bg-white/5 border-white/5';
    
    // Scale intensity based on PnL (higher base for better visibility)
    const baseOpacity = 20;
    const extraOpacity = Math.min(Math.abs(pnl) / maxPnL, 1) * 80;
    const finalOpacity = Math.round(baseOpacity + extraOpacity);
    
    if (pnl > 0) {
      // Gold/Emerald for profit
      return `bg-accent-gold/[${finalOpacity}%] border-accent-gold/30 shadow-[0_0_10px_rgba(212,175,55,0.1)]`;
    } else {
      // Red for loss
      return `bg-data-loss/[${finalOpacity}%] border-data-loss/30`;
    }
  };

  const sessions = ["Sydney", "Asia", "London", "NY"];

  return (
    <div className="w-full space-y-4">
      <div className="grid grid-cols-[100px_1fr] gap-4">
        {/* Header - Days */}
        <div />
        <div className="grid grid-cols-7 gap-2">
          {data.map((d, i) => (
            <div key={i} className="text-[10px] text-text-muted font-bold text-center tracking-widest uppercase">
              {d.day}
            </div>
          ))}
        </div>

        {/* Rows - Sessions */}
        {sessions.map((session, sIdx) => (
          <React.Fragment key={session}>
            <div className="flex items-center">
              <span className="text-[10px] text-accent-gold font-bold uppercase tracking-widest leading-none">
                {session}
              </span>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {data.map((dayData, dIdx) => {
                const cell = dayData.sessions[sIdx];
                return (
                  <div
                    key={`${dIdx}-${sIdx}`}
                    className={`aspect-video rounded-md border transition-all duration-300 flex items-center justify-center group relative cursor-help ${getCellColor(cell.pnl)}`}
                    title={`${dayData.day} ${session}: ${cell.pnl >= 0 ? '+' : ''}$${cell.pnl.toLocaleString()} (${cell.count} trades)`}
                  >
                    {cell.count > 0 && (
                      <span className="text-[8px] font-mono text-white/40 group-hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        {cell.count}
                      </span>
                    )}
                    
                    {/* Tooltip detail (Optional/Hover) */}
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-bg-surface border border-accent-gold/20 px-2 py-1 rounded text-[9px] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-10 shadow-xl">
                      <span className={cell.pnl >= 0 ? 'text-data-profit' : 'text-data-loss'}>
                        {cell.pnl >= 0 ? '+' : ''}${cell.pnl.toLocaleString()}
                      </span>
                      <span className="text-text-muted ml-1">({cell.count} trades)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end space-x-6 pt-2">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded bg-data-loss/80 border border-data-loss/30" />
          <span className="text-[9px] text-text-muted uppercase tracking-widest font-bold">Net Loss</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded bg-white/20 border border-white/10" />
          <span className="text-[9px] text-text-muted uppercase tracking-widest font-bold">No Trade</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded bg-accent-gold/80 border border-accent-gold/30" />
          <span className="text-[9px] text-text-muted uppercase tracking-widest font-bold">Net Profit</span>
        </div>
      </div>
    </div>
  );
};
