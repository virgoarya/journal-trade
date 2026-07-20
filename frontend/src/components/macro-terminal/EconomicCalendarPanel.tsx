"use client";

import React, { useEffect, useState, useMemo } from "react";
import { CalendarDays, AlertCircle, ChevronDown } from "lucide-react";
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

type TimeFilter = "today" | "this_week" | "all";

export function EconomicCalendarPanel({ className }: { className?: string }) {
  const { dataStatus } = useMacroTerminal();
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TimeFilter>("today");
  const [impactFilter, setImpactFilter] = useState<string>("All");
  const [currencyFilter, setCurrencyFilter] = useState<string>("All");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchCalendar = async () => {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/v1/market-data/economic-calendar");

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      if (json.success && json.data) {
        const majorCurrencies = ["US", "GB", "EU", "JP", "AU", "CA", "NZ", "CH", "USD", "GBP", "EUR", "JPY", "AUD", "CAD", "CHF"];

        const filtered = json.data.filter(
          (e: EconomicEvent) =>
            majorCurrencies.some(c => e.country?.toUpperCase().includes(c)),
        );

        filtered.sort((a: EconomicEvent, b: EconomicEvent) => {
          return new Date(a.time || a.date || 0).getTime() - new Date(b.time || b.date || 0).getTime();
        });

        setEvents(filtered); // Store all filtered events, apply display filter later
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
    const interval = setInterval(fetchCalendar, 5 * 60 * 1000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, []);

  const displayedEvents = useMemo(() => {
    if (!mounted) return []; // Return empty during SSR to prevent hydration mismatch
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
    startOfWeek.setHours(0, 0, 0, 0);

    return events.filter((event) => {
      const eventDate = new Date(event.time || event.date || 0);
      
      let timePass = true;
      if (filter === "today") {
        timePass = eventDate.getDate() === today.getDate() &&
                   eventDate.getMonth() === today.getMonth() &&
                   eventDate.getFullYear() === today.getFullYear();
      } else if (filter === "this_week") {
        timePass = eventDate.getTime() >= startOfWeek.getTime();
      }
      
      let impactPass = true;
      if (impactFilter !== "All") {
        impactPass = event.impact === impactFilter;
      }
      
      let currPass = true;
      if (currencyFilter !== "All") {
        const c = event.country?.toUpperCase() || "";
        currPass = c.includes(currencyFilter) || c.includes(currencyFilter.substring(0, 2));
      }

      return timePass && impactPass && currPass;
    }).slice(0, 30); // Limit to 30 events for display
  }, [events, filter, impactFilter, currencyFilter, mounted]);

  const getImpactColor = (impact: string) => {
    if (impact === "High")
      return "text-[#ef4444] bg-[#ef4444]/20 border-[#ef4444]/50"; // Bright Red
    if (impact === "Medium")
      return "text-[#f59e0b] bg-[#f59e0b]/20 border-[#f59e0b]/50"; // Bright Orange
    return "text-text-muted glass border-border-subtle";
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
    <div className={`flex flex-col w-full glass overflow-hidden relative ${className ?? ""}`}>
      <div className="flex items-center justify-between border-b border-border-subtle p-2 shrink-0">
        <h2 className="font-bold text-text-primary uppercase tracking-wider text-[11px] sm:text-xs flex items-center gap-2 min-w-0">
          <CalendarDays size={14} className="text-accent-gold flex-shrink-0" /> Economic Calendar
        </h2>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {/* Currency Filter */}
          <div className="relative">
            <select
              value={currencyFilter}
              onChange={(e) => setCurrencyFilter(e.target.value)}
              className="appearance-none bg-transparent border border-border-subtle rounded-md pl-2 pr-5 py-0.5 text-[9px] font-mono text-text-muted hover:border-accent-gold/50 transition-colors cursor-pointer"
            >
              <option value="All">ALL CUR</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="JPY">JPY</option>
              <option value="AUD">AUD</option>
              <option value="CAD">CAD</option>
              <option value="CHF">CHF</option>
              <option value="NZD">NZD</option>
            </select>
            <ChevronDown size={10} className="absolute right-1 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          </div>

          {/* Impact Filter */}
          <div className="relative">
            <select
              value={impactFilter}
              onChange={(e) => setImpactFilter(e.target.value)}
              className="appearance-none bg-transparent border border-border-subtle rounded-md pl-2 pr-5 py-0.5 text-[9px] font-mono text-text-muted hover:border-accent-gold/50 transition-colors cursor-pointer"
            >
              <option value="All">ALL IMPACT</option>
              <option value="High">HIGH</option>
              <option value="Medium">MEDIUM</option>
              <option value="Low">LOW</option>
            </select>
            <ChevronDown size={10} className="absolute right-1 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          </div>

          {/* Time Filter */}
          <div className="relative">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as TimeFilter)}
              className="appearance-none bg-transparent border border-border-subtle rounded-md pl-2 pr-5 py-0.5 text-[9px] font-mono text-text-muted hover:border-accent-gold/50 transition-colors cursor-pointer"
            >
              <option value="today">TODAY</option>
              <option value="this_week">THIS WEEK</option>
              <option value="all">ALL TIME</option>
            </select>
            <ChevronDown size={10} className="absolute right-1 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          </div>

          {dataStatus.calendar === "stale" || dataStatus.calendar === "error" ? (
            <span className="flex items-center gap-1.5 text-[8px] sm:text-[9px] font-mono font-medium text-text-muted bg-white/5 px-2 py-0.5 rounded border border-white/10 uppercase tracking-widest whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-gold/50 animate-pulse"></span>
              Connecting...
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[8px] sm:text-[9px] font-mono font-bold text-data-profit bg-data-profit/10 px-2 py-0.5 rounded border border-data-profit/20 uppercase tracking-widest whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-data-profit animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
              LIVE
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
        ) : displayedEvents.length === 0 ? (
          <div className="flex justify-center items-center h-full text-text-muted text-xs font-mono">
            No upcoming high-impact events for this filter.
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-[#0a0a0a] backdrop-blur border-b border-border-subtle z-10">
                <tr>
                  <th className="px-2 py-1.5 text-[10px] font-mono text-text-muted font-normal w-[50px]">
                    TIME
                  </th>
                  <th className="px-2 py-1.5 text-[10px] font-mono text-text-muted font-normal w-[40px]">
                    CUR
                  </th>
                  <th className="px-2 py-1.5 text-[10px] font-mono text-text-muted font-normal">
                    EVENT
                  </th>
                  <th className="px-2 py-1.5 text-[10px] font-mono text-text-muted font-normal text-right w-[50px]">
                    ACT
                  </th>
                  <th className="px-2 py-1.5 text-[10px] font-mono text-text-muted font-normal text-right w-[50px]">
                    PRV
                  </th>
                  <th className="px-2 py-1.5 text-[10px] font-mono text-text-muted font-normal text-right w-[50px]">
                    FCS
                  </th>
                </tr>
              </thead>
              <tbody className="font-mono text-xs">
                {displayedEvents.map((event, idx) => {
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
                      className="border-b border-border-subtle/50 hover:bg-white/5 transition-colors"
                    >
                      <td className="px-2 py-2 whitespace-nowrap">
                        <div
                          className={`flex flex-col ${isPast ? "opacity-50" : ""}`}
                        >
                          <span className="text-[10px] text-text-muted">
                            {dayStr}
                          </span>
                          <span className="text-text-primary text-xs font-semibold">{timeStr}</span>
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <span
                          className={`px-1.5 py-0.5 text-[10px] font-bold border rounded ${getImpactColor(event.impact)} ${isPast ? "opacity-50" : ""}`}
                        >
                          {event.country || "-"}
                        </span>
                      </td>
                      <td
                        className={`px-2 py-2 text-text-secondary truncate max-w-[120px] sm:max-w-[160px] text-xs ${isPast ? "opacity-50" : ""}`}
                        title={event.title || ""}
                      >
                        {event.title || "-"}
                      </td>
                      <td
                        className={`px-2 py-2 text-right font-bold text-xs ${getActualColor(event.actual, event.forecast, event.previous)}`}
                      >
                        {event.actual || "-"}
                      </td>
                      <td className="px-2 py-2 text-right text-text-muted text-xs">
                        {event.previous || "-"}
                      </td>
                      <td className="px-2 py-2 text-right text-text-muted text-xs">
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
