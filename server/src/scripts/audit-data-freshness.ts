/**
 * audit-data-freshness.ts — Cek semua series data vs ground truth FRED.
 *
 * Tujuan: mendeteksi data LAGGING / series salah / nilai tidak sinkron
 * SEBELUM terlihat di UI.
 *
 * Jalankan:
 *   npx tsx src/scripts/audit-data-freshness.ts
 */

import "dotenv/config";
import axios from "axios";

const KEY = process.env.FRED_API_KEY;

// Series yang dipakai di seluruh aplikasi + ekspektasi frekuensi
const EXPECTED: Record<string, { label: string; maxLagDays: number; usedBy: string }> = {
  DFF:       { label: "Fed Funds Effective Rate",   maxLagDays: 5,  usedBy: "GeoRisk, Nexus" },
  DFEDTARL:  { label: "Fed Target Range Lower",     maxLagDays: 5,  usedBy: "Nexus (konteks)" },
  DFEDTARU:  { label: "Fed Target Range Upper",     maxLagDays: 5,  usedBy: "Nexus (konteks)" },
  T5YIE:     { label: "Breakeven Inflation 5Y",     maxLagDays: 5,  usedBy: "Nexus" },
  T10YIE:    { label: "Breakeven Inflation 10Y",    maxLagDays: 5,  usedBy: "Nexus" },
  DFII10:    { label: "Real Yield 10Y (TIPS)",      maxLagDays: 5,  usedBy: "Nexus" },
  WALCL:     { label: "Fed Balance Sheet",          maxLagDays: 14, usedBy: "Nexus" },
  RRPONTSYD: { label: "ON RRP Balance",             maxLagDays: 5,  usedBy: "GeoRisk, Liquidity" },
  VIXCLS:    { label: "VIX (close)",                maxLagDays: 5,  usedBy: "GeoRisk, Quant" },
  DGS3MO:    { label: "Treasury 3M",                maxLagDays: 5,  usedBy: "Yield Curve, Quant" },
  DGS2:      { label: "Treasury 2Y",                maxLagDays: 5,  usedBy: "Yield Curve, Quant" },
  DGS5:      { label: "Treasury 5Y",                maxLagDays: 5,  usedBy: "Yield Curve, Quant" },
  DGS10:     { label: "Treasury 10Y",               maxLagDays: 5,  usedBy: "Yield Curve, Quant" },
  DGS30:     { label: "Treasury 30Y",               maxLagDays: 5,  usedBy: "Yield Curve, Quant" },
  // Series BULANAN — lag besar itu normal
  CPIAUCSL:  { label: "CPI (monthly)",              maxLagDays: 75, usedBy: "GeoRisk, Nexus, MacroRegime" },
  PCEPI:     { label: "PCE Price Index (monthly)",  maxLagDays: 75, usedBy: "Nexus (fallback)" },
  UMCSENT:   { label: "Consumer Sentiment (monthly)", maxLagDays: 75, usedBy: "Nexus" },
  IPMAN:     { label: "Industrial Production Mfg (monthly)", maxLagDays: 75, usedBy: "GeoRisk (cadangan)" },
  GACDISA066MSFRBNY: { label: "Empire State Mfg (diffusion)", maxLagDays: 45, usedBy: "GeoRisk supply chain" },
  // Central Bank Policy Rates (FX Differentials panel)
  ECBDFR:    { label: "ECB Deposit Facility Rate", maxLagDays: 10, usedBy: "CentralBankDifferentials" },
  IUDSOIA:   { label: "SONIA (BoE proxy)",         maxLagDays: 10, usedBy: "CentralBankDifferentials" },
  IR3TIB01JPM156N: { label: "Japan 3M Interbank",  maxLagDays: 120, usedBy: "CentralBankDifferentials" },
  IR3TIB01CAM156N: { label: "Canada 3M Interbank", maxLagDays: 120, usedBy: "CentralBankDifferentials" },
  IR3TIB01AUM156N: { label: "Australia 3M Interbank", maxLagDays: 120, usedBy: "CentralBankDifferentials" },
  IR3TIB01CHM156N: { label: "Swiss 3M Interbank",  maxLagDays: 120, usedBy: "CentralBankDifferentials" },
  IR3TIB01NZM156N: { label: "NZ 3M Interbank",     maxLagDays: 120, usedBy: "CentralBankDifferentials" },
};

async function seriesMeta(id: string) {
  const r = await axios.get("https://api.stlouisfed.org/fred/series", {
    params: { series_id: id, api_key: KEY, file_type: "json" },
    timeout: 15000,
  });
  const s = r.data?.seriess?.[0];
  return s ? { freq: s.frequency_short, title: s.title } : null;
}

async function lastObs(id: string) {
  const r = await axios.get("https://api.stlouisfed.org/fred/series/observations", {
    params: {
      series_id: id, api_key: KEY, file_type: "json",
      sort_order: "desc", limit: 5, observation_start: "2020-01-01",
    },
    timeout: 15000,
  });
  const obs = (r.data?.observations ?? []).filter((o: any) => o.value !== ".");
  return obs[0] ? { date: obs[0].date, value: parseFloat(obs[0].value) } : null;
}

async function main() {
  if (!KEY) {
    console.error("❌ FRED_API_KEY tidak ada di .env");
    process.exit(1);
  }

  const today = new Date();
  let problems = 0;

  console.log("=".repeat(96));
  console.log("AUDIT FRESHNESS DATA — semua series vs FRED");
  console.log("=".repeat(96));
  console.log(
    `${"SERIES".padEnd(10)} ${"FREQ".padEnd(5)} ${"TERAKHIR".padEnd(12)} ${"LAG".padEnd(7)} ${"NILAI".padEnd(11)} STATUS`
  );
  console.log("-".repeat(96));

  for (const [id, exp] of Object.entries(EXPECTED)) {
    const meta = await seriesMeta(id);
    const last = await lastObs(id);

    if (!meta || !last) {
      console.log(
        `${id.padEnd(10)} ${"??".padEnd(5)} ${"-".padEnd(12)} ${"-".padEnd(7)} ${"-".padEnd(11)} ❌ SERIES TIDAK ADA / KOSONG  (${exp.usedBy})`
      );
      problems++;
      continue;
    }

    const lagDays = Math.floor(
      (today.getTime() - new Date(last.date).getTime()) / 86400000
    );
    const ok = lagDays <= exp.maxLagDays;
    if (!ok) problems++;

    console.log(
      `${id.padEnd(10)} ${String(meta.freq).padEnd(5)} ${last.date.padEnd(12)} ${(lagDays + "d").padEnd(7)} ${String(last.value).padEnd(11)} ${
        ok ? "✅" : `⚠️  LAGGING (maks ${exp.maxLagDays}d) — ${exp.usedBy}`
      }`
    );
  }

  console.log("-".repeat(96));
  if (problems === 0) {
    console.log("✅ SEMUA SERIES FRESH — tidak ada data lagging.");
  } else {
    console.log(`⚠️  ${problems} masalah ditemukan. Periksa item di atas.`);
  }
  console.log("=".repeat(96));
}

main().catch((e) => {
  console.error("Audit gagal:", e.message);
  process.exit(1);
});
