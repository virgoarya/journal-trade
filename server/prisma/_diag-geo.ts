/**
 * TEMP — cek isi GeoRiskSnapshot & MacroIndicator di MongoDB.
 */
import "dotenv/config";
import mongoose from "mongoose";

async function main() {
  const uri = process.env.DATABASE_URL;
  if (!uri) { console.error("no DATABASE_URL"); process.exit(1); }
  await mongoose.connect(uri);

  const db = mongoose.connection.db!;

  // ── GeoRiskSnapshot terakhir ──
  const snaps = await db.collection("geo_risk_snapshots")
    .find({}).sort({ fetchedAt: -1 }).limit(5).toArray();

  console.log("=== GeoRiskSnapshot (5 terakhir) ===");
  for (const s of snaps) {
    console.log(`\n  fetchedAt: ${s.fetchedAt?.toISOString?.() ?? s.fetchedAt}`);
    console.log(`    globalPmi  = ${s.globalPmi}   onRrpBalance = ${s.onRrpBalance}`);
    console.log(`    fedfunds   = ${s.fedfunds_rate}   cpi_yoy = ${s.cpi_yoy}   vix = ${s.vix}`);
    console.log(`    scores     = ${JSON.stringify(s.scores)}`);
    // verifikasi formula supplyChain
    if (typeof s.globalPmi === "number") {
      const calc = Math.round(Math.min(100, Math.max(0, (50 - s.globalPmi) * 5 + 50)));
      console.log(`    → formula(globalPmi=${s.globalPmi}) = ${calc} | tersimpan = ${s.scores?.supplyChain} | ${calc === s.scores?.supplyChain ? "KONSISTEN" : "❌ TIDAK KONSISTEN"}`);
    }
  }

  // ── MacroIndicator ISM PMI ──
  console.log("\n=== MacroIndicator (ISM Manufacturing PMI) ===");
  const mi = await db.collection("macroindicators")
    .find({ indicatorName: /ISM|PMI/i }).limit(10).toArray();
  if (mi.length === 0) {
    console.log("  (tidak ada dokumen ISM/PMI)");
  } else {
    for (const d of mi) {
      console.log(`  ${d.indicatorName} | ${d.country} | actual=${d.actualValue} | release=${d.releaseDate}`);
    }
  }

  // ── Semua MacroIndicator (ringkas) ──
  const all = await db.collection("macroindicators").find({}).limit(20).toArray();
  console.log(`\n=== MacroIndicator total (sample ${all.length}) ===`);
  for (const d of all.slice(0, 20)) {
    console.log(`  ${String(d.indicatorName).padEnd(34)} ${String(d.country).padEnd(4)} actual=${d.actualValue}`);
  }

  await mongoose.disconnect();
}

main().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
