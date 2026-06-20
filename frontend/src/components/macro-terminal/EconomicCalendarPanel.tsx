"use client";

import React, { useEffect, useState } from "react";
import { CalendarDays, AlertCircle } from "lucide-react";
import { useMacroTerminal } from "./MacroTerminalContext";

interface EconomicEvent {
  time?: string;
  country?: string;
  date?: string;
  title?: string;
  impact: "High" | "Medium" | "Low";
  forecast: string;
  previous: string;
  actual: string;
  direction?: "higher_is_better" | "lower_is_better" | "neutral";
}

export function EconomicCalendarPanel() {
  const { dataStatus } = useMacroTerminal();
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

const fetchCalendar = async () => {
    setError(null);
    
    try {
      const res = await fetch("/api/v1/market-data/economic-calendar");
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      if (json.success && json.data) {
        const majorCurrencies = ["US", "GB", "EU", "JP", "AU", "CA", "NZ", "CH", "USD", "GBP", "EUR", "JPY", "AUD", "CAD", "CHF"];

        const filtered = json.data.filter(
          (e: EconomicEvent) =>
            (e.impact === "High") &&
            majorCurrencies.some(c => e.country?.toUpperCase().includes(c)),
        );

        filtered.sort((a: EconomicEvent, b: EconomicEvent) => {
          return new Date(a.time || a.date || 0).getTime() - new Date(b.time || b.date || 0).getTime();
        });

        const now = new Date();
        const dayOfWeek = now.getDay();
        
        let displayEvents = filtered;

        if (dayOfWeek === 6 || dayOfWeek === 0) {
          // On weekends, show events from the past 7 days so it doesn't look empty
          displayEvents = filtered.filter(
            (e: EconomicEvent) =>
              new Date(e.time || e.date || 0).getTime() > now.getTime() - 7 * 24 * 60 * 60 * 1000,
          );
        } else {
          // On weekdays, show events from 2 hours ago onwards
          displayEvents = filtered.filter(
            (e: EconomicEvent) =>
              new Date(e.time || e.date || 0).getTime() > now.getTime() - 2 * 60 * 60 * 1000,
          );
        }

        setEvents(displayEvents.slice(0, 20));
      } else {
        throw new Error(json.message || "Invalid data format");
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Error loading calendar";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendar();
    const interval = setInterval(fetchCalendar, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const getImpactColor = (impact: string) => {
    if (impact === "High")
      return "text-[#ef4444] bg-[#ef4444]/20 border-[#ef4444]/50"; // Bright Red
    if (impact === "Medium")
      return "text-[#f59e0b] bg-[#f59e0b]/20 border-[#f59e0b]/50"; // Bright Orange
    return "text-text-muted bg-surface-elevated border-border-subtle";
  };

  const getActualColor = (
    actual: string,
    forecast: string,
    previous: string,
  ) => {
    if (!actual) return "text-text-primary";

    const actNum = parseFloat(actual.replace(/[^0-9.-]+/g, ""));
    const fcstNum = forecast ? parseFloat(forecast.replace(/[^0-9.-]+/g, "")) : NaN;
    const prevNum = previous ? parseFloat(previous.replace(/[^0-9.-]+/g, "")) : NaN;

    if (isNaN(actNum)) return "text-text-primary";
    
    // Compare against forecast if available, else compare against previous
    const targetNum = !isNaN(fcstNum) ? fcstNum : prevNum;
    
    if (isNaN(targetNum)) return "text-text-primary";

    if (actNum > targetNum) return "text-data-profit";
    if (actNum < targetNum) return "text-data-loss";
    return "text-text-primary";
  };

  return (
    <div className="flex flex-col h-full glass border border-border-subtle rounded-xl overflow-hidden bg-bg-void relative">
<div className="flex items-center justify-between border-b border-border-subtle p-3 shrink-0">
        <h2 className="font-bold text-text-primary uppercase tracking-wider text-[10px] sm:text-xs flex items-center gap-2">
          <CalendarDays size={14} /> Economic Calendar
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono text-text-muted uppercase tracking-wider border border-border-subtle px-2 py-0.5 rounded">
            {dataStatus.calendar.toUpperCase()}
          </span>
          {error && (
            <span className="text-[9px] font-mono text-data-loss animate-pulse">
              FAILED
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-0 min-h-0 custom-scrollbar">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <span className="text-xs font-mono text-text-muted animate-pulse">
              Loading events...
            </span>
          </div>
        ) : error ? (
          <div className="flex flex-col justify-center items-center h-full text-data-loss text-xs font-mono gap-2 p-4">
            <AlertCircle size={16} />
            <span>{error}</span>
            <button
              onClick={fetchCalendar}
              className="text-[10px] font-mono text-accent-gold hover:underline"
            >
              Retry
            </button>
          </div>
        ) : events.length === 0 ? (
          <div className="flex justify-center items-center h-full text-text-muted text-xs font-mono">
            No upcoming high-impact events.
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full min-w-[520px] text-left border-collapse">
              <thead className="sticky top-0 bg-bg-void/90 backdrop-blur border-b border-border-subtle z-10">
                <tr>
                  <th className="px-3 py-2 text-[9px] font-mono text-text-muted font-normal w-12">
                    TIME
                  </th>
                  <th className="px-3 py-2 text-[9px] font-mono text-text-muted font-normal w-12">
                    CUR
                  </th>
                  <th className="px-3 py-2 text-[9px] font-mono text-text-muted font-normal">
                    EVENT
                  </th>
                  <th className="px-3 py-2 text-[9px] font-mono text-text-muted font-normal text-right">
                    ACT
                  </th>
                  <th className="px-3 py-2 text-[9px] font-mono text-text-muted font-normal text-right">
                    PRV
                  </th>
                  <th className="px-3 py-2 text-[9px] font-mono text-text-muted font-normal text-right">
                    FCS
                  </th>
                </tr>
              </thead>
              <tbody className="font-mono text-xs">
                {events.map((event, idx) => {
                  const date = new Date(event.time || event.date || 0);
                  const timeStr = date.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  });
                  const dayStr = date.toLocaleDateString("en-US", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  });

                  const isPast = date.getTime() < new Date().getTime();

                  return (
                    <tr
                      key={idx}
                      className="border-b border-border-subtle/50 hover:bg-surface-elevated/30 transition-colors"
                    >
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div
                          className={`flex flex-col ${isPast ? "opacity-50" : ""}`}
                        >
                          <span className="text-[10px] text-text-muted">
                            {dayStr}
                          </span>
                          <span className="text-text-primary">{timeStr}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`px-1.5 py-0.5 text-[9px] font-bold border rounded ${getImpactColor(event.impact)} ${isPast ? "opacity-50" : ""}`}
                        >
                          {event.country || "-"}
                        </span>
                      </td>
                      <td
                        className={`px-3 py-2 text-text-secondary truncate max-w-[150px] ${isPast ? "opacity-50" : ""}`}
                        title={event.title || ""}
                      >
                        {event.title || "-"}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-bold ${getActualColor(event.actual, event.forecast, event.previous)}`}
                      >
                        {event.actual || "-"}
                      </td>
                      <td className="px-3 py-2 text-right text-text-secondary">
                        {event.previous || "-"}
                      </td>
                      <td className="px-3 py-2 text-right text-text-secondary">
                        {event.forecast || "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
