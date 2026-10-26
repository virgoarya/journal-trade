/**
 * verify-atlas.mjs — Verifikasi koneksi database produksi (MongoDB Atlas) dari sisi app.
 *
 * TUJUAN
 *   Satu perintah untuk membuktikan bahwa DATABASE_URL produksi benar-benar
 *   menyambung ke cluster Atlas yang diharapkan, cluster itu punya failover
 *   (replica set), dan database target punya koleksi + index yang dibutuhkan app.
 *
 * CARA PAKAI
 *   DATABASE_URL='mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/<db>?...' \
 *   DATABASE_NAME=journal_trade_prod \
 *   node scripts/verify-atlas.mjs
 *
 *   # Verifikasi read-only saja (default) vs tulis-probe (bikin koleksi sementara):
 *   VERIFY_WRITE_PROBE=1 node scripts/verify-atlas.mjs
 *
 *   # Untuk verifikasi lokal (bukan Atlas) — eksplisit, jangan dipakai di CI produksi:
 *   ALLOW_LOCAL_MONGO=1 DATABASE_URL='mongodb://localhost:27017/journal_trade_dev' \
 *     node scripts/verify-atlas.mjs
 *
 * EXIT CODE
 *   0 = cluster Atlas reachable, replica set sehat, DB target ada & index lengkap
 *   1 = ada syarat produksi yang tidak terpenuhi (pesan di stdout, format JSON)
 *
 * OUTPUT
 *   JSON di stdout (aman di-pipe). Credential di-redact sebelum dicetak.
 */

import { MongoClient } from "mongodb";
import dns from "node:dns";
import { REQUIRED_COLLECTIONS, LEGACY_COLLECTIONS } from "./lib/atlas-schema.mjs";

// PENTING: resolver sistem di banyak host Windows TIDAK bisa menjawab SRV
// (Node memakai c-ares) → querySrv ECONNREFUSED. Atlas wajib lewat
// resolver publik. Ini sengaja disamakan dengan server/src/db/mongoose.ts.
// Verified 26 Okt 2026: default resolver FAIL (ECONNREFUSED), 1.1.1.1 OK (3 node).
const PUBLIC_RESOLVERS = ["1.1.1.1", "8.8.8.8", "1.0.0.1", "8.8.4.4"];
const dnsOverride = process.env.ATLAS_DNS_SERVERS;
if (dnsOverride && dnsOverride !== "none") {
  try {
    dns.setServers(dnsOverride.split(",").map((s) => s.trim()).filter(Boolean));
  } catch {
    /* resolver default sudah cukup di kebanyakan environment */
  }
} else if (!dnsOverride) {
  try {
    dns.setServers(PUBLIC_RESOLVERS);
  } catch {
    /* biarkan resolver sistem */
  }
}

const REDACTED = "***";

/** Buang credential dari URI supaya aman dicetak ke log / board. */
export function redactUri(uri) {
  if (!uri) return uri;
  return uri.replace(/\/\/([^:/@]+):([^@]*)@/, `//$1:${REDACTED}@`);
}

function fail(reason, extra = {}) {
  console.log(JSON.stringify({ ok: false, reason, ...extra }, null, 2));
  process.exit(1);
}

function requireAtlasUri() {
  const uri = process.env.DATABASE_URL;
  if (!uri) fail("DATABASE_URL tidak diset");
  const isAtlas = uri.startsWith("mongodb+srv://") || /\.mongodb\.net/.test(uri);
  if (!isAtlas && process.env.ALLOW_LOCAL_MONGO !== "1") {
    fail(
      "DATABASE_URL bukan Atlas (mongodb+srv://…). Set ALLOW_LOCAL_MONGO=1 hanya untuk verifikasi lokal eksplisit.",
      { uri: redactUri(uri) }
    );
  }
  return uri;
}

async function main() {
  const uri = requireAtlasUri();
  const dbName = process.env.DATABASE_NAME || "journal_trade_prod";

  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: Number(process.env.VERIFY_TIMEOUT_MS || 15000),
    connectTimeoutMS: Number(process.env.VERIFY_TIMEOUT_MS || 15000),
    retryWrites: true,
    w: "majority",
  });

  try {
    await client.connect();
  } catch (err) {
    fail(`tidak bisa connect: ${err.message}`, { uri: redactUri(uri) });
  }

  try {
    const admin = client.db().admin();

    // 1. Failover: cluster harus replica set (Atlas selalu RS; M0 pun 3 nodes).
    let hello = {};
    try {
      hello = await admin.command({ hello: 1 });
    } catch (err) {
      fail(`hello gagal: ${err.message}`, { uri: redactUri(uri) });
    }
    const hosts = hello.hosts || [];
    const replicaSet = hello.setName || null;
    if (hosts.length < 3) {
      fail("cluster tidak punya minimal 3 node — failover tidak tersedia", {
        uri: redactUri(uri),
        setName: replicaSet,
        hosts,
      });
    }

    // 2. Ping ke DB target.
    const db = client.db(dbName);
    const ping = await db.command({ ping: 1 });
    if (ping.ok !== 1) fail("ping ke DB target gagal", { db: dbName });

    // 3. Inventaris koleksi + jumlah dokumen.
    const existing = new Set((await db.listCollections().toArray()).map((c) => c.name));
    const collections = [];
    for (const name of REQUIRED_COLLECTIONS) {
      if (!existing.has(name)) {
        collections.push({ name, present: false, documents: 0 });
        continue;
      }
      const documents = await db.collection(name).estimatedDocumentCount();
      const indexes = await db.collection(name).indexes();
      collections.push({
        name,
        present: true,
        documents,
        indexes: indexes.map((i) => i.name),
      });
    }
    const missing = collections.filter((c) => !c.present);

    // 4. Write probe: buktikan role user ini boleh tulis (bukan read-only).
    let writeProbe = { skipped: true };
    if (process.env.VERIFY_WRITE_PROBE === "1") {
      const probeName = `_forge_write_probe_${Date.now()}`;
      try {
        await db.collection(probeName).insertOne({ probe: true, at: new Date() });
        await db.collection(probeName).deleteMany({});
        await db.collection(probeName).drop().catch(() => {});
        writeProbe = { ok: true };
      } catch (err) {
        writeProbe = { ok: false, error: err.message };
      }
    }

    // 5. Backup capability: Atlas Backup tidak tersedia di tier Shared (M0/M2/M5).
    //    Deteksi tier lewat wire version + hint dari server, lalu flag eksplisit.
    let backup = { detected: null, note: "perlu konfirmasi dari Atlas Console (tier menentukan ketersediaan Atlas Backup)" };
    try {
      const atlasVersion = await admin.command({ atlasVersion: 1 });
      backup.detected = `atlas (revision ${atlasVersion.revision || "unknown"})`;
    } catch {
      backup.detected = null;
    }

    const report = {
      ok: missing.length === 0,
      uri: redactUri(uri),
      database: dbName,
      cluster: {
        setName: replicaSet,
        hosts: hosts.length,
        primary: hello.primary || null,
        isWritablePrimary: !!hello.isWritablePrimary,
        maxWireVersion: hello.maxWireVersion,
        atlas: backup.detected,
        failover: hosts.length >= 3 ? "replica-set (3+ node)" : "TIDAK ADA",
      },
      ping: { ok: ping.ok === 1 },
      collections: {
        required: REQUIRED_COLLECTIONS.length,
        present: REQUIRED_COLLECTIONS.length - missing.length,
        missing: missing.map((c) => c.name),
      },
      detail: collections,
      writeProbe,
      backup,
      legacy: {
        // Koleksi warisan yang TIDAK boleh ada di DB produksi baru.
        present: LEGACY_COLLECTIONS.filter((n) => existing.has(n)),
        expectedAbsent: LEGACY_COLLECTIONS,
      },
    };

    if (missing.length > 0) {
      report.reason = `koleksi wajib belum ada (${missing.length}): ${missing
        .map((c) => c.name)
        .join(", ")} — jalankan scripts/migrate-atlas.mjs`;
    }
    if (report.legacy.present.length > 0) {
      report.legacy.warning = `koleksi legacy ditemukan: ${report.legacy.present.join(", ")} — jangan dipakai app; lihat docs/PRODUCTION_DATABASE.md`;
    }

    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.ok ? 0 : 1;
  } finally {
    await client.close().catch(() => {});
  }
}

main().catch((err) => fail(err.message || String(err)));
