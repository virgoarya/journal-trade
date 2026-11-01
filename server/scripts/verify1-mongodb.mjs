/**
 * VERIFY-1 / Step 1 — Query MongoDB langsung.
 * Membaca server/.env, konek ke MongoDB, lalu melaporkan state field yang
 * diverifikasi task: agentConsensus + llmConsensus di collection user_settings,
 * baik di aiTrading.* maupun savedPipelineConfigs[broker].*.
 *
 * Jalankan: node scripts/verify1-mongodb.mjs   (dari server/)
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- minimal .env loader (tanpa dependency tambahan) ---
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
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
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

if (!url) {
  console.error("DATABASE_URL tidak ditemukan di server/.env");
  process.exit(2);
}

// Redaksi aman: sembunyikan kredensial di host string
const redacted = url.replace(/\/\/([^@/]+)@/, "//***:***@");
console.log("=== VERIFY-1 STEP 1: MongoDB query ===");
console.log(`DATABASE_URL : ${redacted}`);
console.log(`DATABASE_NAME: ${dbName || "(default dari URL)"}`);

try {
  await mongoose.connect(url, { dbName: dbName || undefined, serverSelectionTimeoutMS: 15000 });
  console.log(`connect      : OK (${mongoose.connection.host})`);
  const db = mongoose.connection.db;
  console.log(`database     : ${db.databaseName}`);

  const col = db.collection("user_settings");
  const total = await col.countDocuments();
  console.log(`\ncollection   : user_settings  (total dokumen: ${total})`);

  const docs = await col.find({}).limit(20).toArray();

  if (docs.length === 0) {
    console.log("\n(!) Tidak ada dokumen user_settings sama sekali.");
  }

  console.log("\n--- Field per dokumen ---");
  for (const d of docs) {
    const ai = d.aiTrading || {};
    const spc = d.savedPipelineConfigs || {};
    const brokers = Object.keys(spc);
    console.log(`\nuserId=${d.userId}`);
    console.log(`  aiTrading.agentConsensus : ${JSON.stringify(ai.agentConsensus ?? null)}`);
    console.log(`  aiTrading.llmConsensus   : ${JSON.stringify(ai.llmConsensus ?? null)}`);
    console.log(`  savedPipelineConfigs keys: ${brokers.length ? brokers.join(", ") : "(none)"}`);
    for (const b of brokers) {
      const bc = spc[b] || {};
      console.log(`    [${b}].agentConsensus : ${JSON.stringify(bc.agentConsensus ?? null)}`);
      console.log(`    [${b}].llmConsensus   : ${JSON.stringify(bc.llmConsensus ?? null)}`);
    }
  }

  // Agregasi klaim: berapa dokumen yang benar-benar punya flag true.
  // Catatan: `savedPipelineConfigs` adalah OBJECT (Schema.Types.Mixed), bukan
  // array — jadi $elemMatch di sini SELALU 0 dan menyesatkan. Gunakan $objectToArray.
  const agentTrueGeneric = await col.countDocuments({ "aiTrading.agentConsensus.enabled": true });
  const llmTrueGeneric = await col.countDocuments({ "aiTrading.llmConsensus.enabled": true });
  const brokerAgentTrue = await col
    .aggregate([
      { $project: { spc: { $objectToArray: { $ifNull: ["$savedPipelineConfigs", {}] } } } },
      { $match: { "spc.v.agentConsensus.enabled": true } },
      { $count: "n" },
    ])
    .toArray();
  const agentTrueAnyBroker = brokerAgentTrue.length ? brokerAgentTrue[0].n : 0;

  console.log("\n--- Agregasi (jumlah dokumen) ---");
  console.log(`aiTrading.agentConsensus.enabled = true : ${agentTrueGeneric}`);
  console.log(`aiTrading.llmConsensus.enabled   = true : ${llmTrueGeneric}`);
  console.log(`savedPipelineConfigs[*].agentConsensus.enabled = true : ${agentTrueAnyBroker}`);

  // Snapshot mentah satu dokumen pertama (field agentConsensus/llmConsensus saja)
  const sample = docs[0];
  if (sample) {
    console.log("\n--- RAW JSON (dokumen pertama, field relevan) ---");
    console.log(JSON.stringify({
      _id: sample._id,
      userId: sample.userId,
      "aiTrading.agentConsensus": sample.aiTrading?.agentConsensus ?? null,
      "aiTrading.llmConsensus": sample.aiTrading?.llmConsensus ?? null,
      "savedPipelineConfigs": sample.savedPipelineConfigs ?? null,
    }, null, 2));
  }

  await mongoose.disconnect();
  console.log("\n[OK] STEP 1 selesai.");
} catch (e) {
  console.error(`\n[FAIL] ${e.name}: ${e.message}`);
  process.exitCode = 1;
} finally {
  try { await mongoose.disconnect(); } catch { /* ignore */ }
}
