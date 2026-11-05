"use client";

/**
 * MacroScreener — Tabel penyaring instrumen makro (indeks, FX, komoditas, yield).
 * Spec: Fase 2 — Screener & Sparkline · Fase 2.3 — Realtime Hardening
 *
 * Realtime: auto-refresh adaptif (pause saat tab hidden / di luar viewport)
 * + flash hijau/merah saat harga berubah.
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Table, Search, ArrowUpDown, ExternalLink, RefreshCw } from "lucide-react";
import { DEFAULT_INSTRUMENTS, fetchCandles, PENDING_INSTRUMENT_KEY, type MacroInstrument } from "@/services/macro-candles.service";
import { Sparkline } from "./Sparkline";
import { useAdaptivePolling } from "@/hooks/useAdaptivePolling";
import { useFlashOnChange } from "@/hooks/useFlashOnChange";

/** Interval refresh screener — 60 detik (candle 1M tidak perlu lebih cepat). */
const SCREENER_POLL_MS = 60_000;

interface ScreenerRow extends MacroInstrument {
  price?: number;
  change?: number;
  sparkline: number[];
  loading: boolean;
}

type SortField = "symbol" | "name" | "category" | "price" | "change";
type SortOrder = "asc" | "desc";

// ─────────────────────────────────────────────────────────────────────────────
// BARIS — komponen terpisah supaya hook flash bisa dipakai per baris
// ─────────────────────────────────────────────────────────────────────────────

function ScreenerRowView({
  row,
  onOpenChart,
}: {
  row: ScreenerRow;
  onOpenChart: (symbol: string) => void;
}) {
  const priceFlash = useFlashOnChange(row.price ?? null, 600);
  const chg = row.change ?? 0;
  const isPos = chg >= 0;

  return (
    <tr className="hover:bg-white/5 transition-colors group">
      <td className="p-2.5 font-bold text-accent-gold">{row.symbol}</td>
      <td className="p-2.5 text-text-primary truncate max-w-[160px]">{row.name}</td>
      <td className="p-2.5 text-text-muted uppercase text-[9px]">{row.category}</td>
      <td className={`p-2.5 text-right font-semibold tabular-nums transition-colors ${priceFlash}`}>
        {row.loading ? "..." : (row.price?.toLocaleString("en-US", { minimumFractionDigits: 2 }) ?? "—")}
      </td>
      <td className={`p-2.5 text-right font-semibold tabular-nums ${isPos ? "text-data-profit" : "text-data-loss"}`}>
        {row.loading ? "..." : `${isPos ? "+" : ""}${chg.toFixed(2)}%`}
      </td>
      <td className="p-2.5 text-center align-middle">
        {row.loading ? (
          <span className="text-text-muted text-[9px]">loading...</span>
        ) : (
          <Sparkline data={row.sparkline} width={80} height={20} />
        )}
      </td>
      <td className="p-2.5 text-center">
        <button
          type="button"
          onClick={() => onOpenChart(row.symbol)}
          title={`Buka ${row.symbol} di chart`}
          aria-label={`Buka ${row.symbol} di chart`}
          className="p-1 rounded bg-accent-gold/10 text-accent-gold hover:bg-accent-gold/20 transition-colors inline-flex items-center gap-1 text-[9px]"
        >
          <ExternalLink size={10} /> Chart
        </button>
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREENER
// ─────────────────────────────────────────────────────────────────────────────

export function MacroScreener({ className }: { className?: string }) {
  const [rows, setRows] = useState<ScreenerRow[]>(
    DEFAULT_INSTRUMENTS.map((inst) => ({ ...inst, sparkline: [], loading: true }))
  );
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [sortField, setSortField] = useState<SortField>("symbol");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  /**
   * Ambil harga + sparkline semua instrumen.
   * `silent` = refresh latar: jangan tampilkan spinner, pertahankan data lama bila gagal.
   */
  const loadAll = useCallback(async (silent = false) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    if (!silent) setRefreshing(true);

    try {
      const results = await Promise.all(
        DEFAULT_INSTRUMENTS.map(async (inst) => {
          try {
            // 1M — cukup untuk sparkline 30 titik
            const res = await fetchCandles(inst.symbol, "1M", 30, ac.signal);
            const closes = res.candles.map((c) => c.close);
            const last = closes[closes.length - 1] ?? 0;
            const prev = closes[0] ?? last;
            const change = prev > 0 ? ((last - prev) / prev) * 100 : 0;
            return { ...inst, price: last, change, sparkline: closes, loading: false } as ScreenerRow;
          } catch {
            // gagal → null, baris lama dipertahankan
            return null;
          }
        })
      );

      if (ac.signal.aborted) return;

      setRows((prev) =>
        DEFAULT_INSTRUMENTS.map((inst, i) => {
          const next = results[i];
          if (next) return next;
          const old = prev.find((r) => r.symbol === inst.symbol);
          return old ?? { ...inst, sparkline: [], loading: false };
        })
      );
      setLastUpdated(new Date());
    } finally {
      if (!ac.signal.aborted && !silent) setRefreshing(false);
    }
  }, []);

  // Muat pertama kali
  useEffect(() => {
    void loadAll();
    return () => abortRef.current?.abort();
  }, [loadAll]);

  // Auto-refresh adaptif: pause saat tab hidden / di luar viewport
  useAdaptivePolling({
    ref: rootRef,
    ms: SCREENER_POLL_MS,
    fn: () => { void loadAll(true); },
  });

  const categories = useMemo(() => {
    const set = new Set(DEFAULT_INSTRUMENTS.map((i) => i.category));
    return ["ALL", ...Array.from(set)];
  }, []);

  const filteredAndSorted = useMemo(() => {
    const list = rows.filter((r) => {
      const q = search.toLowerCase();
      const matchSearch =
        r.symbol.toLowerCase().includes(q) || r.name.toLowerCase().includes(q);
      const matchCat = categoryFilter === "ALL" || r.category === categoryFilter;
      return matchSearch && matchCat;
    });

    list.sort((a, b) => {
      let va: any = a[sortField] ?? 0;
      let vb: any = b[sortField] ?? 0;
      if (typeof va === "string") va = va.toLowerCase();
      if (typeof vb === "string") vb = vb.toLowerCase();

      if (va < vb) return sortOrder === "asc" ? -1 : 1;
      if (va > vb) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [rows, search, categoryFilter, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const pathname = usePathname();
  const router = useRouter();

  const openChart = useCallback((symbol: string) => {
    if (pathname.startsWith("/macro-terminal/overview")) {
      window.dispatchEvent(new CustomEvent("macro:open-instrument", { detail: { symbol } }));
      return;
    }

    try {
      sessionStorage.setItem(PENDING_INSTRUMENT_KEY, symbol);
    } catch {
      /* sessionStorage diblokir */
    }
    router.push("/macro-terminal/overview");
  }, [pathname, router]);

  return (
    <div ref={rootRef} className={`flex flex-col w-full glass overflow-hidden ${className ?? ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-subtle p-2">
        <div className="flex items-center gap-2">
          <Table size={14} className="text-accent-gold" />
          <h2 className="font-bold text-text-primary uppercase tracking-wider text-[11px] sm:text-xs">
            Macro Screener &amp; Watchlist
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono text-text-muted uppercase">
            {filteredAndSorted.length} INSTRUMENTS
          </span>
          <button
            type="button"
            onClick={() => void loadAll()}
            disabled={refreshing}
            aria-label="Muat ulang data screener"
            className="flex items-center gap-1 text-[9px] font-mono text-text-muted hover:text-text-primary disabled:opacity-40 transition-colors"
          >
            <RefreshCw size={10} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-border-subtle px-3 py-2 flex-wrap">
        <div className="flex items-center gap-1.5 bg-black/40 border border-border-subtle rounded px-2 py-1 flex-1 min-w-[180px]">
          <Search size={12} className="text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari simbol atau nama..."
            aria-label="Cari instrumen"
            className="w-full bg-transparent border-none outline-none font-mono text-[10px] text-text-primary placeholder:text-text-muted/60"
          />
        </div>

        {/* Kategori filter */}
        <div className="flex gap-1 overflow-x-auto" role="group" aria-label="Filter kategori">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              aria-pressed={categoryFilter === cat}
              className={`text-[9px] font-mono px-2 py-1 rounded transition-colors whitespace-nowrap ${
                categoryFilter === cat
                  ? "bg-accent-gold text-black font-bold"
                  : "bg-white/5 text-text-muted hover:text-text-primary"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Tabel */}
      <div className="overflow-x-auto max-h-[380px]">
        <table className="w-full text-left font-mono text-[10px]">
          <caption className="sr-only">
            Screener instrumen makro: simbol, nama, kategori, harga, perubahan 1 bulan, dan sparkline
          </caption>
          <thead className="sticky top-0 bg-[#0d0d12] border-b border-border-subtle text-text-muted uppercase text-[9px] tracking-wider">
            <tr>
              <th scope="col" className="p-2.5 cursor-pointer hover:text-text-primary" onClick={() => handleSort("symbol")}>
                <div className="flex items-center gap-1">Simbol <ArrowUpDown size={10} /></div>
              </th>
              <th scope="col" className="p-2.5 cursor-pointer hover:text-text-primary" onClick={() => handleSort("name")}>
                <div className="flex items-center gap-1">Nama <ArrowUpDown size={10} /></div>
              </th>
              <th scope="col" className="p-2.5 cursor-pointer hover:text-text-primary" onClick={() => handleSort("category")}>
                <div className="flex items-center gap-1">Kategori <ArrowUpDown size={10} /></div>
              </th>
              <th scope="col" className="p-2.5 text-right cursor-pointer hover:text-text-primary" onClick={() => handleSort("price")}>
                <div className="flex items-center justify-end gap-1">Harga <ArrowUpDown size={10} /></div>
              </th>
              <th scope="col" className="p-2.5 text-right cursor-pointer hover:text-text-primary" onClick={() => handleSort("change")}>
                <div className="flex items-center justify-end gap-1">Chg 1M <ArrowUpDown size={10} /></div>
              </th>
              <th scope="col" className="p-2.5 text-center">Sparkline (1M)</th>
              <th scope="col" className="p-2.5 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle/50">
            {filteredAndSorted.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-text-muted">
                  Tidak ada instrumen yang cocok.
                </td>
              </tr>
            ) : (
              filteredAndSorted.map((row) => (
                <ScreenerRowView key={row.symbol} row={row} onOpenChart={openChart} />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border-subtle px-2 py-1 font-mono text-[8px] text-text-muted uppercase tracking-wider">
        <span>
          AUTO-REFRESH 60s · PAUSE SAAT TAB HIDDEN
          {lastUpdated ? ` · UPD ${lastUpdated.toLocaleTimeString("en-GB", { hour12: false })}` : ""}
        </span>
        <span className="hidden sm:inline">KLIK HEADER = URUTKAN</span>
      </div>
    </div>
  );
}

export default MacroScreener;
