"use client";

import React, { useEffect, useState } from "react";
import { CalendarDays, AlertCircle } from "lucide-react";

interface EconomicEvent {
  title: string;
  country: string;
  date: string;
  impact: string;
  forecast: string;
  previous: string;
  actual: string;
}

export function EconomicCalendarPanel() {
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCalendar = async () => {
      try {
        const res = await fetch("/api/v1/market-data/economic-calendar");
        if (!res.ok) throw new Error("Failed to fetch");
        const json = await res.json();
        
        if (json.success && json.data) {
          // Filter out low impact/holidays and sort by date.
          // You might want to filter only major currencies: USD, EUR, GBP, JPY, CAD, AUD
          const majorCurrencies = ["USD", "EUR", "GBP", "JPY", "CAD", "AUD"];
          
          let filtered = json.data.filter((e: EconomicEvent) => 
            (e.impact === "High" || e.impact === "Medium") &&
            majorCurrencies.includes(e.country)
          );

          // Get current time
          const now = new Date().getTime();

          // Optional: only show events from yesterday to end of week
          // But since ForexFactory returns "this week", we can just sort them
          filtered.sort((a: EconomicEvent, b: EconomicEvent) => {
            return new Date(a.date).getTime() - new Date(b.date).getTime();
          });

          // Focus on upcoming and recent events
          // Let's just limit to the next 15 events or around current date
          const upcoming = filtered.filter((e: EconomicEvent) => new Date(e.date).getTime() > now - 24 * 60 * 60 * 1000);
          
          setEvents(upcoming.slice(0, 15));
        } else {
          throw new Error("Invalid data format");
        }
      } catch (err: any) {
        setError(err.message || "Error loading calendar");
      } finally {
        setLoading(false);
      }
    };

    fetchCalendar();
    const interval = setInterval(fetchCalendar, 5 * 60 * 1000); // 5 min
    return () => clearInterval(interval);
  }, []);

  const getImpactColor = (impact: string) => {
    if (impact === "High") return "text-data-loss bg-data-loss/10 border-data-loss/30";
    if (impact === "Medium") return "text-data-warning bg-data-warning/10 border-data-warning/30";
    return "text-text-muted bg-surface-elevated border-border-subtle";
  };

  const getActualColor = (actual: string, forecast: string) => {
    if (!actual || !forecast) return "text-text-primary";
    
    // Attempt basic numeric comparison (doesn't account for inverted logic like Unemployment Claims)
    const actNum = parseFloat(actual.replace(/[^0-9.-]+/g,""));
    const fcstNum = parseFloat(forecast.replace(/[^0-9.-]+/g,""));
    
    if (isNaN(actNum) || isNaN(fcstNum)) return "text-text-primary";
    if (actNum > fcstNum) return "text-data-profit";
    if (actNum < fcstNum) return "text-data-loss";
    return "text-text-primary";
  };

  return (
    <div className="flex flex-col h-full glass border border-border-subtle rounded-xl overflow-hidden bg-bg-void relative">
      <div className="flex items-center justify-between border-b border-border-subtle p-3 shrink-0">
        <h2 className="text-xs font-mono font-bold text-accent-gold uppercase tracking-widest flex items-center gap-2">
          <CalendarDays size={14} /> Economic Calendar
        </h2>
        <span className="text-[9px] font-mono text-text-muted uppercase tracking-wider border border-border-subtle px-2 py-0.5 rounded">
          This Week
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-0 min-h-0 custom-scrollbar">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <span className="text-xs font-mono text-text-muted animate-pulse">Loading events...</span>
          </div>
        ) : error ? (
          <div className="flex justify-center items-center h-full text-data-loss text-xs font-mono gap-2">
            <AlertCircle size={14} /> {error}
          </div>
        ) : events.length === 0 ? (
          <div className="flex justify-center items-center h-full text-text-muted text-xs font-mono">
            No upcoming high-impact events.
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-bg-void/90 backdrop-blur border-b border-border-subtle z-10">
              <tr>
                <th className="px-3 py-2 text-[9px] font-mono text-text-muted font-normal w-12">TIME</th>
                <th className="px-3 py-2 text-[9px] font-mono text-text-muted font-normal w-12">CUR</th>
                <th className="px-3 py-2 text-[9px] font-mono text-text-muted font-normal">EVENT</th>
                <th className="px-3 py-2 text-[9px] font-mono text-text-muted font-normal text-right">ACT</th>
                <th className="px-3 py-2 text-[9px] font-mono text-text-muted font-normal text-right">FCS</th>
                <th className="px-3 py-2 text-[9px] font-mono text-text-muted font-normal text-right">PRV</th>
              </tr>
            </thead>
            <tbody className="font-mono text-xs">
              {events.map((event, idx) => {
                const date = new Date(event.date);
                const timeStr = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
                const dayStr = date.toLocaleDateString("en-US", { weekday: "short" });
                
                const isPast = date.getTime() < new Date().getTime();

                return (
                  <tr key={idx} className="border-b border-border-subtle/50 hover:bg-surface-elevated/30 transition-colors">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className={`flex flex-col ${isPast ? 'opacity-50' : ''}`}>
                        <span className="text-[10px] text-text-muted">{dayStr}</span>
                        <span className="text-text-primary">{timeStr}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 text-[9px] font-bold border rounded ${getImpactColor(event.impact)} ${isPast ? 'opacity-50' : ''}`}>
                        {event.country}
                      </span>
                    </td>
                    <td className={`px-3 py-2 text-text-secondary truncate max-w-[150px] ${isPast ? 'opacity-50' : ''}`} title={event.title}>
                      {event.title}
                    </td>
                    <td className={`px-3 py-2 text-right font-bold ${getActualColor(event.actual, event.forecast)}`}>
                      {event.actual || "-"}
                    </td>
                    <td className="px-3 py-2 text-right text-text-secondary">
                      {event.forecast || "-"}
                    </td>
                    <td className="px-3 py-2 text-right text-text-muted">
                      {event.previous || "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
