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

  const maxPnL = useMemo(() => {
    const values = Object.values(pnlData).map(v => Math.abs(v));
    return Math.max(...values, 100);
  }, [pnlData]);

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
    if (pnl === undefined || pnl === 0) return "bg-white/5 border-white/5";

    // Opacity updated to 40% (0.4) as requested
    const opacity = 0.4;
    
    if (pnl > 0) {
      return `bg-data-profit/[${Math.round(opacity * 100)}] border-data-profit/20 shadow-[0_0_12px_rgba(16,185,129,${opacity * 0.5})] hover:bg-data-profit/30 cursor-pointer`;
    } else {
      return `bg-data-loss/[${Math.round(opacity * 100)}] border-data-loss/20 hover:bg-data-loss/30 cursor-pointer`;
    }
  };

  const daysArr = Array.from({ length: daysInMonth(currentDate.getFullYear(), currentDate.getMonth()) }, (_, i) => i + 1);
  const skipDays = (firstDayOfMonth(currentDate.getFullYear(), currentDate.getMonth()) + 6) % 7; // Adjust for Mon-Sun

  const weekdays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h4 className="font-semibold text-text-primary uppercase tracking-widest text-[10px]">{monthYear}</h4>
        <div className="flex gap-2">
          <button onClick={handlePrevMonth} className="p-1 hover:bg-white/5 rounded-lg border border-white/5 transition-all">
            <ChevronLeft className="w-4 h-4 text-text-muted" />
          </button>
          <button onClick={handleNextMonth} className="p-1 hover:bg-white/5 rounded-lg border border-white/5 transition-all">
            <ChevronRight className="w-4 h-4 text-text-muted" />
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-7 gap-1.5"> {/* Gap reduced from 2 to 1.5 */}
        {weekdays.map(d => (
          <div key={d} className="text-[9px] text-text-muted font-bold text-center tracking-widest pb-1">
            {d}
          </div>
        ))}
        
        {Array.from({ length: skipDays }).map((_, i) => <div key={`skip-${i}`} />)}
        
        {daysArr.map(day => {
          const pnl = pnlData[day];
          return (
            <div
              key={day}
              onClick={() => navigateToLogDate(day)}
              className={`aspect-square rounded-lg border p-1.5 flex flex-col justify-between transition-all duration-300 overflow-hidden group hover:scale-[1.02] active:scale-95 ${getCellStyles(day)}`}
            >
              <span className="text-[11px] font-mono font-bold text-text-primary/70 group-hover:text-text-primary transition-colors">
                {day}
              </span>
              {pnl !== undefined && pnl !== 0 && (
                <span className={`text-[10px] sm:text-[11px] font-bold font-mono truncate ${pnl > 0 ? 'text-data-profit' : 'text-data-loss'}`}>
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
