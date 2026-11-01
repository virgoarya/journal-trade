/**
 * VERIFY-1 / Step 1b — Survey koleksi MongoDB + cari field agentConsensus/llmConsensus
 * di seluruh database (sample scan) untuk melokalisir di mana flag benar-benar disimpan.
 * Jalankan: node scripts/verify1-survey.mjs   (dari server/)
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv(file) {
  const out = {};
  try {
    const raw = readFileSync(file, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq === -1) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      out[k] = v;
    }
  } catch (e) {
    console.error(`[env] gagal baca ${file}: ${e.message}`);
  }
  return out;
}

const env = loadEnv(join(__dirname, "..", ".env"));
const url = env.DATABASE_URL;
const dbName = env.DATABASE_NAME;
if (!url) { console.error("DATABASE_URL tidak ada di server/.env"); process.exit(2); }

await mongoose.connect(url, { dbName: dbName || undefined, serverSelectionTimeoutMS: 15000 });
const db = mongoose.connection.db;
console.log(`=== VERIFY-1 STEP 1b: survey ${db.databaseName} ===`);

console.log(`\n--- Database di server ---`);
for (const d of (await db.admin().listDatabases()).databases) {
  console.log(`  ${String(d.name).padEnd(30)} ${d.sizeOnDisk}`);
}

const cols = await db.listCollections().toArray();
console.log(`\n--- Koleksi (${cols.length}) ---`);
const docCounts = {};
for (const c of cols) {
  const n = await db.collection(c.name).estimatedDocumentCount();
  docCounts[c.name] = n;
  console.log(`  ${c.name.padEnd(40)} ${n}`);
}

const TARGET = ["agentConsensus", "llmConsensus"];
console.log(`\n--- Scan field ${TARGET.join(" / ")} (max 3 dokumen per koleksi) ---`);
let hits = 0;
for (const c of cols) {
  if (docCounts[c.name] === 0) continue;
  const docs = await db.collection(c.name).find({}).limit(3).toArray();
  for (const d of docs) {
    const flat = JSON.stringify(d);
    for (const t of TARGET) {
      if (flat.includes(t)) {
        hits++;
        // cari path ke field tsb secara rekursif
        const paths = [];
        const walk = (o, p) => {
          if (o === null || typeof o !== "object") return;
          for (const k of Object.keys(o)) {
            const np = p ? `${p}.${k}` : k;
            if (k === t) paths.push(`${np} = ${JSON.stringify(o[k])}`);
            walk(o[k], np);
          }
        };
        walk(d, "");
        console.log(`\n[${c.name}] ${d._id}`);
        for (const p of paths) console.log(`   ${p}`);
      }
    }
  }
}
if (hits === 0) console.log("  (tidak ada dokumen mana pun yang memuat field tersebut)");

await mongoose.disconnect();
console.log("\n[OK] STEP 1b selesai.");
