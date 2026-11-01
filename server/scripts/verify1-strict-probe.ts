/**
 * VERIFY-1 / Step 1c — Bukti root-cause: Mongoose `strict` mode menelan write
 * ke `aiTrading.agentConsensus` karena key itu TIDAK ada di UserSettingsSchema.
 *
 * Script ini memakai model Mongoose yang SAMA dengan yang dipakai route
 * produksi (`src/models/UserSettings.ts`) dan konek ke DB yang sama, lalu
 * mencoba operasi persis seperti settings.routes.ts:143-147.
 *
 * Jalankan: npx tsx scripts/verify1-strict-probe.ts   (dari server/)
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv(file: string) {
  const out: Record<string, string> = {};
  try {
    const raw = readFileSync(file, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq === -1) continue;
      out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
    }
  } catch (e) {
    console.error(`[env] gagal baca ${file}: ${(e as Error).message}`);
  }
  return out;
}

async function main() {
  const env = loadEnv(join(__dirname, "..", ".env"));

  // Muat model produksi melalui tsx (TypeScript).
  const { default: mongoose } = await import("mongoose");
  const { UserSettings } = await import(join(__dirname, "..", "src", "models", "UserSettings.ts"));

  const USER = "verify1_strict_probe";

  const readBack = async () => (UserSettings as any).findOne({ userId: USER }).lean();

  console.log("=== VERIFY-1 STEP 1c: Mongoose strict-mode probe ===");
  console.log(`DATABASE_URL : ${env.DATABASE_URL?.replace(/\/\/([^@/]+)@/, "//***:***@")}`);

  await mongoose.connect(env.DATABASE_URL!, { dbName: env.DATABASE_NAME || undefined });
  console.log(`connect      : OK (${mongoose.connection.host}) db=${mongoose.connection.db?.databaseName}`);

  // Bersihkan dulu
  await (UserSettings as any).deleteOne({ userId: USER });
  await (UserSettings as any).create({ userId: USER });

  const payload = { enabled: true, debateMode: "parallel", memoryEnabled: true, toolEnabled: true, threshold: 0.6 };

  console.log("\n--- A. $set persis seperti settings.routes.ts:138-140 ---");
  await (UserSettings as any).findOneAndUpdate(
    { userId: USER },
    { $set: { "aiTrading.agentConsensus": payload } },
    { returnDocument: "after", upsert: true },
  );
  let doc: any = await readBack();
  console.log(`aiTrading.agentConsensus        = ${JSON.stringify(doc?.aiTrading?.agentConsensus ?? null)}`);
  console.log(`aiTrading.llmConsensus          = ${JSON.stringify(doc?.aiTrading?.llmConsensus ?? null)}`);

  console.log("\n--- B. Kontrol: $set ke field yang ADA di schema (aiTrading.llmConsensus) ---");
  await (UserSettings as any).findOneAndUpdate(
    { userId: USER },
    { $set: { "aiTrading.llmConsensus": { enabled: true, minProviders: 3 } } },
    { returnDocument: "after", upsert: true },
  );
  doc = await readBack();
  console.log(`aiTrading.llmConsensus          = ${JSON.stringify(doc?.aiTrading?.llmConsensus ?? null)}`);

  console.log("\n--- C. Kontrol: $set ke savedPipelineConfigs.* (Schema.Types.Mixed) ---");
  await (UserSettings as any).findOneAndUpdate(
    { userId: USER },
    { $set: { "savedPipelineConfigs.BrokerX.agentConsensus": payload } },
    { returnDocument: "after", upsert: true },
  );
  doc = await readBack();
  console.log(`savedPipelineConfigs.BrokerX    = ${JSON.stringify(doc?.savedPipelineConfigs?.BrokerX ?? null)}`);

  console.log("\n--- D. Apakah skema punya path agentConsensus? ---");
  const schemaPaths = Object.keys((UserSettings as any).schema.paths);
  console.log(`paths aiTrading.* = ${schemaPaths.filter((p) => p.startsWith("aiTrading")).join(", ")}`);
  console.log(`punya "aiTrading.agentConsensus"? ${schemaPaths.includes("aiTrading.agentConsensus") ? "YA" : "TIDAK"}`);

  // Bersihkan
  await (UserSettings as any).deleteOne({ userId: USER });
  console.log("\n[OK] probe selesai (dokumen probe dihapus).");
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(`[FAIL] ${e?.name}: ${e?.message}`);
  process.exitCode = 1;
});
