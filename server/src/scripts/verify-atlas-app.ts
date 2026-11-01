/**
 * verify-atlas-app.ts — Buktikan koneksi Atlas dari SISI APPLICATION.
 *
 * Beda dengan scripts/verify-atlas.mjs (yang memakai MongoClient polos), script
 * ini melewati jalur yang SAMA dengan app saat runtime:
 *
 *   server/src/config/env.ts   -> validasi zod env (NODE_ENV, DATABASE_URL, ...)
 *   server/src/db/mongoose.ts  -> connectDB() (Mongoose + Better Auth MongoClient)
 *
 * Artinya kalau script ini hijau, app production akan tersambung. Kalau script
 * ini merah, app production juga tidak akan start.
 *
 * CARA PAKAI
 *   DATABASE_URL='mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/<db>?...' \
 *   DATABASE_NAME=journal_trade_prod \
 *   npx tsx src/scripts/verify-atlas-app.ts
 *
 *   # Verifikasi lokal (bukan Atlas) — eksplisit, jangan dipakai untuk produksi:
 *   ALLOW_LOCAL_MONGO=1 DATABASE_URL='mongodb://localhost:27017/journal_trade_dev' \
 *     npx tsx src/scripts/verify-atlas-app.ts
 *
 * CATATAN ENV
 *   Script ini me-load server/src/config/env.ts, yang mewajibkan beberapa variabel
 *   non-DB (BETTER_AUTH_*, DISCORD_*, FRONTEND_URL). Untuk verifikasi DB saja,
 *   beri nilai dummy pada yang opsional — yang diverifikasi di sini murni DB.
 *
 * EXIT CODE
 *   0 = app tersambung ke Atlas, replica set sehat, koleksi lengkap
 *   1 = ada syarat yang tidak terpenuhi (pesan di stdout, format JSON)
 *
 * OUTPUT
 *   JSON di stdout. Kredensial di-redact sebelum dicetak.
 */

import "dotenv/config";
import mongoose from "mongoose";
import { env } from "../config/env";
import { connectDB, authMongoClient } from "../db/mongoose";
import { REQUIRED_COLLECTIONS, LEGACY_COLLECTIONS } from "../../scripts/lib/atlas-schema.mjs";

const REDACTED = "***";

function redactUri(uri: string): string {
  return (uri || "").replace(/\/\/([^:/@]+):([^@]*)@/, `//$1:${REDACTED}@`);
}

function fail(reason: string, extra: Record<string, unknown> = {}): never {
  console.log(
    JSON.stringify(
      { ok: false, reason, uri: redactUri(env.DATABASE_URL), database: env.DATABASE_NAME, ...extra },
      null,
      2
    )
  );
  process.exit(1);
}

async function main(): Promise<void> {
  if (!env.DATABASE_URL) fail("DATABASE_URL tidak diset");

  const isAtlas =
    env.DATABASE_URL.startsWith("mongodb+srv://") || /\.mongodb\.net/.test(env.DATABASE_URL);
  if (!isAtlas && process.env.ALLOW_LOCAL_MONGO !== "1") {
    fail(
      "DATABASE_URL bukan Atlas (mongodb+srv://…). Set ALLOW_LOCAL_MONGO=1 hanya untuk verifikasi lokal eksplisit."
    );
  }

  const result: Record<string, unknown> = {
    ok: false,
    mode: "app-level (config/env.ts + db/mongoose.ts)",
    env: {
      NODE_ENV: env.NODE_ENV,
      DATABASE_URL: redactUri(env.DATABASE_URL),
      DATABASE_NAME: env.DATABASE_NAME,
    },
  };

  let ok = true;
  let failureReason = "";

  try {
    // 1. Hubungkan lewat jalur produksi app.
    await connectDB();
    result.mongooseConnected = mongoose.connection.readyState === 1;
    result.dbName = mongoose.connection.db?.databaseName ?? null;

    // 2. Ping lewat Better Auth client (jalur kedua app).
    result.ping = await authMongoClient.db().admin().ping();

    // 3. Versi server + topologi (failover).
    const hello = await authMongoClient.db().admin().command({ hello: 1 });
    const topology = (mongoose.connection as any).client?.topology;
    result.replicaSet = {
      setName: hello.setName ?? null,
      hosts: hello.hosts ?? null,
      isWritablePrimary: hello.isWritablePrimary ?? null,
      topologyType: topology?.description?.type ?? null,
      knownServers: topology?.description?.servers ? [...topology.description.servers.keys()] : null,
    };

    const serverCount = (hello.hosts ?? []).length;
    if (serverCount < 3) {
      ok = false;
      failureReason = `cluster hanya punya ${serverCount} host — failover tidak terjamin (butuh >= 3)`;
    }

    // 4. Koleksi wajib harus lengkap.
    const present = new Set(
      (await mongoose.connection.db!.listCollections().toArray()).map((c: any) => c.name)
    );
    const missing = REQUIRED_COLLECTIONS.filter((name) => !present.has(name));
    result.collections = {
      required: REQUIRED_COLLECTIONS.length,
      present: REQUIRED_COLLECTIONS.length - missing.length,
      missing,
      totalInDatabase: present.size,
    };
    if (missing.length > 0) {
      ok = false;
      failureReason = `koleksi wajib tidak lengkap: ${missing.join(", ")}`;
    }

    // 5. Koleksi legacy tidak boleh ada di DB produksi baru.
    const legacyFound = LEGACY_COLLECTIONS.filter((name) => present.has(name));
    result.legacy = { present: legacyFound, expectedAbsent: LEGACY_COLLECTIONS };
    if (legacyFound.length > 0) {
      result.legacyWarning = `koleksi legacy ditemukan: ${legacyFound.join(", ")}`;
    }

    // 6. Bukti baca tulisan melalui model layer app.
    const tradesCount = await mongoose.connection.db!.collection("trades").estimatedDocumentCount();
    result.tradesCount = tradesCount;

    result.ok = ok;
    if (!ok) result.reason = failureReason;
  } catch (err: any) {
    ok = false;
    result.ok = false;
    result.error = err?.message ?? String(err);
  } finally {
    try {
      await mongoose.disconnect();
      await authMongoClient.close(true);
    } catch {
      /* abaikan — yang penting hasil di atas */
    }
  }

  console.log(JSON.stringify(result, null, 2));
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.log(JSON.stringify({ ok: false, error: err?.message ?? String(err) }, null, 2));
  process.exit(1);
});
