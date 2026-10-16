import { fredLatest } from "../utils/fred-api.helper";
import { silentLogger } from "../utils/silent-logger";

/**
 * central-bank-differentials.service.ts
 *
 * FX Central Bank Policy Rate Differentials — dihitung dari data FRED LIVE.
 *
 * SEBELUMNYA: service ini mengembalikan STUB DATA hardcoded dengan angka usang
 * (FOMC 5.25% padahal aktual 4.00%) → panel selalu menampilkan data basi.
 *
 * SEKARANG: fetch rate dari FRED untuk setiap bank sentral, hitung differential
 * secara nyata. Kalau rate tidak lengkap, pair tersebut DILEWATI (jangan
 * menampilkan angka palsu).
 *
 * Seri FRED yang dipakai (dipilih berdasarkan ketersediaan & kesegaran):
 *   - FOMC : DFEDTARU (target upper, harian)
 *   - ECB  : ECBDFR   (deposit facility rate, harian)
 *   - BoE  : IUDSOIA  (SONIA — proxy policy rate, harian)
 *   - BOJ  : IR3TIB01JPM156N (3M interbank — policy rate resmi tak tersedia di FRED)
 *   - BoC  : IR3TIB01CAM156N (3M interbank, lag ~63d)
 *           CATATAN: IRSTCB01CAM156N (policy rate) sudah TIDAK diupdate sejak 2023
 *           (lag 1037 hari) → jangan dipakai lagi.
 *   - RBA  : IR3TIB01AUM156N (3M interbank)
 *   - SNB  : IR3TIB01CHM156N (3M interbank)
 *   - RBNZ : IR3TIB01NZM156N (3M interbank)
 */

interface CentralBankDifferential {
  code: string;
  currencyPair: string;
  centralBank: string;
  policyRateDiff: number;
  yieldCurveFlat: boolean;
  lastUpdate: string;
}

// Konfigurasi: pasangan mata uang → bank sentral & seri FRED-nya
const PAIRS: Array<{
  code: string;
  currencyPair: string;
  base: { bank: string; series: string };
  quote: { bank: string; series: string };
}> = [
  {
    code: "EURUSD",
    currencyPair: "EUR/USD",
    base: { bank: "ECB", series: "ECBDFR" },
    quote: { bank: "FOMC", series: "DFEDTARU" },
  },
  {
    code: "USDJPY",
    currencyPair: "USD/JPY",
    base: { bank: "FOMC", series: "DFEDTARU" },
    quote: { bank: "BOJ", series: "IR3TIB01JPM156N" },
  },
  {
    code: "GBPUSD",
    currencyPair: "GBP/USD",
    base: { bank: "BoE", series: "IUDSOIA" },
    quote: { bank: "FOMC", series: "DFEDTARU" },
  },
  {
    code: "AUDUSD",
    currencyPair: "AUD/USD",
    base: { bank: "RBA", series: "IR3TIB01AUM156N" },
    quote: { bank: "FOMC", series: "DFEDTARU" },
  },
  {
    code: "USDCAD",
    currencyPair: "USD/CAD",
    base: { bank: "FOMC", series: "DFEDTARU" },
    // IRSTCB01CAM156N (policy rate) tidak diupdate FRED sejak 2023 → pakai 3M interbank
    quote: { bank: "BoC", series: "IR3TIB01CAM156N" },
  },
  {
    code: "USDCHF",
    currencyPair: "USD/CHF",
    base: { bank: "FOMC", series: "DFEDTARU" },
    quote: { bank: "SNB", series: "IR3TIB01CHM156N" },
  },
  {
    code: "NZDUSD",
    currencyPair: "NZD/USD",
    base: { bank: "RBNZ", series: "IR3TIB01NZM156N" },
    quote: { bank: "FOMC", series: "DFEDTARU" },
  },
];

// Cache hasil (policy rate bank sentral tidak berubah tiap menit)
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 menit
let cachedResult: CentralBankDifferential[] | null = null;
let cachedAt = 0;

export const centralBankDifferentialsService = {
  /**
   * Hitung FX Central Bank Policy Rate Differentials dari data FRED live.
   */
  async getDifferentials(): Promise<CentralBankDifferential[]> {
    if (cachedResult && Date.now() - cachedAt < CACHE_TTL_MS) {
      return cachedResult;
    }

    // Kumpulkan semua seri unik, fetch sekali per seri (hindari request duplikat)
    const uniqueSeries = new Set<string>();
    PAIRS.forEach((p) => {
      uniqueSeries.add(p.base.series);
      uniqueSeries.add(p.quote.series);
    });

    const rates = new Map<string, number | null>();
    for (const series of uniqueSeries) {
      try {
        const value = await fredLatest(series, 6);
        rates.set(series, value);
        if (value == null) {
          silentLogger.warn(`[CentralBankDifferentials] FRED series ${series} kosong`);
        }
      } catch (err: any) {
        silentLogger.warn(`[CentralBankDifferentials] Gagal fetch ${series}:`, err.message);
        rates.set(series, null);
      }
    }

    const now = new Date().toISOString();
    const result: CentralBankDifferential[] = [];

    for (const pair of PAIRS) {
      const baseRate = rates.get(pair.base.series) ?? null;
      const quoteRate = rates.get(pair.quote.series) ?? null;

      // Kalau salah satu rate tidak tersedia, lewati pair ini — lebih baik pair
      // tidak muncul daripada menampilkan differential dari angka palsu.
      if (baseRate == null || quoteRate == null) {
        silentLogger.warn(
          `[CentralBankDifferentials] ${pair.code} dilewati — rate tidak lengkap ` +
            `(${pair.base.bank}=${baseRate}, ${pair.quote.bank}=${quoteRate})`
        );
        continue;
      }

      const diff = Math.round((baseRate - quoteRate) * 100) / 100;

      result.push({
        code: pair.code,
        currencyPair: pair.currencyPair,
        centralBank: `${pair.base.bank} (${baseRate.toFixed(2)}%) vs ${pair.quote.bank} (${quoteRate.toFixed(2)}%)`,
        policyRateDiff: diff,
        // "Flat" kalau selisih sangat kecil — kurva rate tidak memberi sinyal arah
        yieldCurveFlat: Math.abs(diff) < 0.25,
        lastUpdate: now,
      });
    }

    if (result.length === 0) {
      silentLogger.error("[CentralBankDifferentials] Tidak ada pair valid dari FRED");
      return cachedResult ?? [];
    }

    cachedResult = result;
    cachedAt = Date.now();
    silentLogger.info(`[CentralBankDifferentials] ${result.length} pair dari FRED live`);
    return result;
  },
};
