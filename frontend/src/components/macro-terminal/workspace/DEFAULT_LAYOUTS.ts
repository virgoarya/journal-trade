/**
 * Widget Workspace — Default Layouts
 *
 * Default layout configurations for each tab.
 * Only Overview has a full layout defined (Task 0.2 scope).
 * Other tabs will be populated in Task 0.4.
 */

import type { TabLayout } from "./types";

/**
 * Default layouts per tab.
 * Overview: 6 widgets in a 2-column grid layout.
 * Other tabs: empty fallback (will be populated in Task 0.4).
 */
export const DEFAULT_LAYOUTS: Record<string, TabLayout> = {
  overview: {
    items: [
      // ── Layout lama (sebelum price-chart ditambahkan):
      // macro-regime    y=0, h=8  → baris y 0..7
      // heatmap         y=0, h=8  → baris y 0..7
      // ai-reasoning    y=8, h=6  → baris y 8..13
      // liquidity-gauge  y=8, h=6  → baris y 8..13
      // economic-calendar y=14, h=6 → baris y 14..19
      // news-feed       y=14, h=6  → baris y 14..19
      //
      // ── Layout baru: price-chart (full-width, h=5) di y=0.
      // Semua widget lain digeser turun +5 baris agar tidak tumpang tindih:
      // macro-regime    y: 0 → 0+5 = 5
      // heatmap         y: 0 → 0+5 = 5
      // ai-reasoning    y: 8 → 8+5 = 13
      // liquidity-gauge  y: 8 → 8+5 = 13
      // economic-calendar y: 14 → 14+5 = 19
      // news-feed       y: 14 → 14+5 = 19
      { i: "price-chart", x: 0, y: 0, w: 12, h: 5, minW: 6, minH: 3 },
      { i: "macro-regime", x: 0, y: 5, w: 6, h: 8, minW: 4, minH: 6 },
      { i: "heatmap", x: 6, y: 5, w: 6, h: 8, minW: 4, minH: 6 },
      { i: "ai-reasoning", x: 0, y: 13, w: 6, h: 6, minW: 4, minH: 5 },
      { i: "liquidity-gauge", x: 6, y: 13, w: 6, h: 6, minW: 4, minH: 5 },
      { i: "economic-calendar", x: 0, y: 19, w: 6, h: 6, minW: 3, minH: 5 },
      { i: "news-feed", x: 6, y: 19, w: 6, h: 6, minW: 3, minH: 5 },
    ],
    hidden: [],
  },
  // ── COT: panel positioning tunggal (scanner ada di dalam CotPanel) ───────
  cot: {
    items: [{ i: "cot-panel", x: 0, y: 0, w: 12, h: 12, minW: 6, minH: 8 }],
    hidden: [],
  },

  // ── Quant Lab: yield curve + CB differentials (kiri), AI explainer (kanan) ─
  "quant-lab": {
    items: [
      { i: "yield-curve", x: 0, y: 0, w: 5, h: 8, minW: 4, minH: 6 },
      { i: "central-bank-differentials", x: 0, y: 8, w: 5, h: 5, minW: 4, minH: 4 },
      { i: "curve-explainer", x: 5, y: 0, w: 7, h: 13, minW: 4, minH: 6 },
    ],
    hidden: [],
  },

  // ── Nexus: kanvas aspect-ratio (butuh s/d 850px; beri ruang lebih) ───────
  nexus: {
    items: [{ i: "nexus", x: 0, y: 0, w: 12, h: 13, minW: 6, minH: 8 }],
    hidden: [],
  },

  // ── Intelligence: geo-risk (kiri) + AI command (kanan) ───────────────────
  intelligence: {
    items: [
      { i: "geo-risk", x: 0, y: 0, w: 5, h: 12, minW: 4, minH: 6 },
      { i: "agent-intelligence", x: 5, y: 0, w: 7, h: 12, minW: 4, minH: 6 },
      // Screener punya 7 kolom tabel — harus full-width (w:12), kalau tidak
      // kolom Harga/Chg/Sparkline/Aksi terpotong.
      { i: "macro-screener", x: 0, y: 12, w: 12, h: 9, minW: 6, minH: 6 },
    ],
    hidden: [],
  },
};

/**
 * Get the default layout for a given tab.
 * Returns empty layout if tab is not found.
 */
export function getDefaultLayout(tab: string): TabLayout {
  return DEFAULT_LAYOUTS[tab] ?? { items: [], hidden: [] };
}

/**
 * Check if a tab has a defined default layout.
 */
export function hasDefaultLayout(tab: string): boolean {
  return tab in DEFAULT_LAYOUTS && DEFAULT_LAYOUTS[tab].items.length > 0;
}
