/**
 * TradingView economic calendar provider.
 * Dipisah dari macro-data.service supaya bisa di-swap / di-unit-test.
 * Spec: docs/design/macro-data-layer-spec.md §3
 */
import axios from "axios";
import { silentLogger } from "../../../utils/silent-logger";
import type { ICalendarProvider, EconomicEvent } from "./types";

const BASE_URL = "https://economic-calendar.tradingview.com/events";

function mapImportance(importance: number): EconomicEvent["impact"] {
  if (importance === 1) return "High";
  if (importance === 0) return "Medium";
  return "Low";
}

function formatScale(scale: number | string | undefined): string {
  const n = Number(scale);
  if (!n || n === 1) return "";
  if (n === 1_000_000_000) return "B";
  if (n === 1_000_000) return "M";
  if (n === 1_000) return "K";
  return "";
}

/**
 * Kata kunci di JUDUL event yang menandakan nilainya dalam persen.
 *
 * SENGAJA TIDAK memuat "CPI"/"PPI"/"Inflation" sendirian: di TradingView
 * "CPI" tanpa MoM/YoY adalah INDEKS HARGA (level, mis. 336.65 poin), bukan
 * persen — menempelkan "%" ke situ salah. Kasus persen yang benar sudah
 * tertangkap oleh MoM/YoY/m/m/q/q.
 */
const PERCENT_TITLE = /\b(MoM|YoY|QoQ|m\/m|q\/q|y\/y|Rate|Unemployment)\b/i;

/**
 * Format nilai dari API TradingView.
 *
 * PENTING — kenapa `currency` TIDAK dipakai sebagai satuan:
 * response TradingView tidak punya field satuan sama sekali. `currency` adalah
 * MATA UANG NEGARA event (selalu "USD"/"EUR"/...), bukan satuan nilainya.
 * Menempelkannya menghasilkan klaim yang SALAH, mis. "Retail Sales YoY 0.8 EUR"
 * padahal nilainya 0,8 persen — dan itu terjadi pada ~160 dari 190 event
 * (mayoritas event tidak punya `scale`). Data salah lebih buruk daripada data
 * tanpa satuan.
 *
 * Aturan:
 *   1. `scale` (K/M/B) dipakai sebagai sufiks MAGNITUDE — selalu benar secara faktual.
 *   2. Persen dideteksi dari JUDUL event (MoM/YoY/Rate/CPI/...).
 *   3. Sisanya dibiarkan polos — jujur, tidak mengarang satuan.
 */
function formatValue(value: any, scale: number | undefined, title: string): string {
  if (value == null) return "";
  const suffix = formatScale(scale);
  if (suffix) return `${value}${suffix}`;
  if (PERCENT_TITLE.test(title)) return `${value}%`;
  return `${value}`;
}

export const tradingviewCalendarProvider: ICalendarProvider = {
  name: "tradingview",

  async fetchCalendar(
    from: string,
    to: string,
    countries: string
  ): Promise<EconomicEvent[]> {
    try {
      const resp = await axios.get(BASE_URL, {
        params: { from, to, countries },
        headers: {
          "User-Agent": "Mozilla/5.0",
          Origin: "https://www.tradingview.com",
        },
        timeout: 10_000,
      });

      const events: EconomicEvent[] = [];
      const seen = new Set<string>();

      for (const item of resp.data?.result ?? []) {
        if (item.importance < 0) continue;

        const isoDate = item.date || item.referenceDate || new Date().toISOString();
        const id = `${item.title}-${item.country}-${isoDate}`;
        if (seen.has(id)) continue;
        seen.add(id);

        events.push({
          title: item.title,
          country: item.country,
          date: isoDate,
          impact: mapImportance(item.importance),
          forecast: formatValue(item.forecast, item.scale, item.title),
          previous: formatValue(item.previous, item.scale, item.title),
          actual: formatValue(item.actual, item.scale, item.title),
          direction: "neutral",
        });
      }

      return events;
    } catch (error: any) {
      silentLogger.warn(`[Calendar/TradingView] gagal: ${error.message}`);
      return [];
    }
  },
};
