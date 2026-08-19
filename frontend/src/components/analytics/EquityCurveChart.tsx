"use client";

import React from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';

interface EquityPoint {
  date: string;
  equity: number;
}

interface EquityCurveChartProps {
  data: EquityPoint[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass border border-accent-gold/20 rounded-lg px-3 py-2 shadow-xl">
        <p className="text-[10px] text-text-muted uppercase tracking-widest font-bold">{label}</p>
        <p className="text-sm font-mono text-accent-gold font-bold">
          ${payload[0].value.toLocaleString()}
        </p>
      </div>
    );
  }
  return null;
};

export const EquityCurveChart: React.FC<EquityCurveChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center">
        <p className="text-[10px] text-text-muted uppercase tracking-widest italic font-mono">No Equity Data Flowing</p>
      </div>
    );
  }

  const isPositive = data[data.length - 1].equity >= data[0].equity;
  const strokeColor = isPositive ? '#10B981' : '#EF4444';
  const gradientId = isPositive ? 'equityGradient' : 'equityGradientLoss';

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={strokeColor} stopOpacity={0.4} />
              <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: '#A1A1AA', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: '#A1A1AA', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={50}
            tickFormatter={(value) => `$${value >= 1000 ? (value/1000).toFixed(1)+'k' : value}`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#D4AF37', strokeWidth: 1, strokeDasharray: '4 4' }} />
          <Area
            type="monotone"
            dataKey="equity"
            stroke={strokeColor}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 4, fill: strokeColor, stroke: '#1E1E1E', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
