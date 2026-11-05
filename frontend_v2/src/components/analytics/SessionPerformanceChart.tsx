"use client";

import React from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Cell } from 'recharts';

interface SessionData {
  session: string;
  pnl: number;
  trades: number;
}

interface SessionPerformanceChartProps {
  data: SessionData[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const pnl = payload[0].payload.pnl;
    return (
      <div className="glass border border-accent-gold/20 rounded-lg px-3 py-2 shadow-xl">
        <p className="text-[10px] text-text-muted uppercase tracking-widest font-bold">{label}</p>
        <p className={`text-sm font-mono font-bold ${pnl >= 0 ? 'text-data-profit' : 'text-data-loss'}`}>
          {pnl >= 0 ? '+' : ''}${pnl.toLocaleString()}
        </p>
        <p className="text-[9px] text-text-muted">{payload[0].payload.trades} executions</p>
      </div>
    );
  }
  return null;
};

export const SessionPerformanceChart: React.FC<SessionPerformanceChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center">
        <p className="text-[10px] text-text-muted uppercase tracking-widest italic font-mono">No Session Data Flowing</p>
      </div>
    );
  }

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="session"
            tick={{ fill: '#A1A1AA', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#A1A1AA', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={50}
            tickFormatter={(value) => `$${value >= 1000 ? (value/1000).toFixed(1)+'k' : value}`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(212,175,55,0.05)' }} />
          <Bar dataKey="pnl" radius={[4, 4, 0, 0]} maxBarSize={80}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.pnl >= 0 ? '#10B981' : '#EF4444'}
                fillOpacity={0.8}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
