"use client";

import React from 'react';

interface AssetData {
  asset: string;
  count: number;
  percentage: number;
}

interface AssetDistributionChartProps {
  data: AssetData[];
}

export const AssetDistributionChart: React.FC<AssetDistributionChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-[10px] text-text-muted uppercase tracking-widest italic font-mono">No Asset Data available</p>
      </div>
    );
  }

  // Predefined premium colors
  const colors = [
    "#d4af37", // Gold
    "#10b981", // Profit Green
    "#3b82f6", // Blue
    "#8b5cf6", // Purple
    "#f59e0b", // Amber
    "#6b7280"  // Muted/Others
  ];

  let cumulativePercentage = 0;
  const radius = 35;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="w-full h-full flex flex-col md:flex-row items-center gap-6">
      {/* Donut Chart SVG */}
      <div className="relative w-32 h-32 flex items-center justify-center">
        <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
          {data.map((item, index) => {
            const strokeDashoffset = circumference - (item.percentage / 100) * circumference;
            const rotation = (cumulativePercentage / 100) * 360;
            cumulativePercentage += item.percentage;
            
            return (
              <circle
                key={item.asset}
                cx="50"
                cy="50"
                r={radius}
                fill="transparent"
                stroke={colors[index % colors.length]}
                strokeWidth="10"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-in-out"
                style={{ transformOrigin: 'center', transform: `rotate(${rotation}deg)` }}
              />
            );
          })}
          {/* Inner Void */}
          <circle cx="50" cy="50" r={radius - 8} className="fill-bg-void/40" />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-[10px] text-text-muted uppercase font-bold tracking-tighter">Total Assets</span>
          <span className="text-sm font-mono font-bold text-accent-gold">{data.length}</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex-1 space-y-3 w-full">
        {data.map((item, index) => (
          <div key={item.asset} className="flex items-center justify-between group">
            <div className="flex items-center gap-2">
              <div 
                className="w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)]" 
                style={{ backgroundColor: colors[index % colors.length] }} 
              />
              <span className="text-[11px] font-bold text-text-primary uppercase tracking-wider group-hover:text-accent-gold transition-colors">
                {item.asset}
              </span>
            </div>
            <div className="flex items-center gap-3">
               <span className="text-[10px] font-mono text-text-muted">{item.count} trades</span>
               <span className="text-[11px] font-mono font-bold text-accent-gold min-w-[40px] text-right">
                 {item.percentage}%
               </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
