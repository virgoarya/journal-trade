"use client";

import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Trade {
  tradeDate: string | Date;
  pnl: number;
}

interface PnLCalendarProps {
  trades: Trade[];
}

export const PnLCalendar: React.FC<PnLCalendarProps> = ({ trades }) => {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const monthYear = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const pnlData = useMemo(() => {
    const data: Record<number, number> = {};
    trades.forEach(trade => {
      const date = new Date(trade.tradeDate);
      if (date.getUTCMonth() === currentDate.getMonth() && date.getUTCFullYear() === currentDate.getFullYear()) {
        const day = date.getUTCDate();
        data[day] = (data[day] || 0) + (trade.pnl || 0);
      }
    });
    return data;
  }, [trades, currentDate]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const navigateToLogDate = (day: number) => {
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    router.push(`/log-trade?date=${year}-${month}-${dayStr}`);
  };

  const getCellStyles = (day: number) => {
    const pnl = pnlData[day];
    if (pnl === undefined || pnl === 0) return "bg-zinc-900/40 border-zinc-800/60 text-zinc-600 hover:bg-zinc-800/60";

    if (pnl > 0) {
      return `bg-green-700/20 border-green-600/50 shadow-[inset_0_0_8px_rgba(16,185,129,0.2)] hover:bg-green-700/30 cursor-pointer`;
    } else {
      return `bg-red-700/20 border-red-600/50 shadow-[inset_0_0_8px_rgba(239,68,68,0.2)] hover:bg-red-700/30 cursor-pointer`;
    }
  };

  const daysArr = Array.from({ length: daysInMonth(currentDate.getFullYear(), currentDate.getMonth()) }, (_, i) => i + 1);
  const skipDays = (firstDayOfMonth(currentDate.getFullYear(), currentDate.getMonth()) + 6) % 7; // Adjust for Mon-Sun

  const weekdays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

  return (
    <div className="w-full h-full grid grid-rows-[auto_1fr] gap-4">
      <div className="flex justify-between items-center mb-4">
        <h4 className="font-bold text-text-primary uppercase tracking-widest text-sm">{monthYear}</h4>
        <div className="flex gap-2">
          <button onClick={handlePrevMonth} className="p-1 hover:bg-zinc-700/50 rounded-lg transition-all">
            <ChevronLeft className="w-4 h-4 text-text-muted hover:text-accent-gold" />
          </button>
          <button onClick={handleNextMonth} className="p-1 hover:bg-zinc-700/50 rounded-lg transition-all">
            <ChevronRight className="w-4 h-4 text-text-muted hover:text-accent-gold" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5 min-w-0 min-h-fit">
        {weekdays.map(d => (
          <div key={d} className="text-[10px] text-text-muted font-bold text-center tracking-widest pb-1">
            {d}
          </div>
        ))}

        {Array.from({ length: skipDays }).map((_, i) => <div key={`skip-${i}`} className="aspect-square"></div>)}

        {daysArr.map(day => {
          const pnl = pnlData[day];
          return (
            <div
              key={day}
              onClick={() => navigateToLogDate(day)}
              className={`rounded-xl border p-2 flex flex-col justify-between transition-all duration-300 aspect-square group hover:scale-[1.02] active:scale-[0.98] ${getCellStyles(day)}`}
            >
              <span className="text-xs font-mono font-bold text-text-primary/70 group-hover:text-text-primary transition-colors leading-none">
                {day}
              </span>
              {pnl !== undefined && pnl !== 0 && (
                <span className={`text-[10px] sm:text-xs font-extrabold font-mono truncate w-full text-right mt-1 leading-none ${pnl > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {pnl > 0 ? '+' : ''}${Math.abs(pnl).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
