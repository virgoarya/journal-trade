/**
 * migrate-atlas.mjs — Migrasi idempoten database produksi (MongoDB Atlas).
 *
 * TUJUAN
 *   Menyiapkan database produksi di Atlas sampai state yang dipakai app:
 *   koleksi lengkap + index sesuai model Mongoose. Aman dijalankan ulang
 *   (idempotent) dan TIDAK PERNAH menghapus/mengubah data yang sudah ada.
 *
 * CARA PAKAI
 *   DATABASE_URL='mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/journal_trade_prod?retryWrites=true&w=majority' \
 *   DATABASE_NAME=journal_trade_prod \
 *   node scripts/migrate-atlas.mjs
 *
 *   # Lihat rencana tanpa menulis apa pun:
 *   MIGRATE_DRY_RUN=1 node scripts/migrate-atlas.mjs
 *
 *   # Verifikasi setelah migrasi:
 *   node scripts/verify-atlas.mjs
 *
 * ATURAN KEAMANAN
 *   - Menolak DATABASE_URL non-Atlas kecuali ALLOW_LOCAL_MONGO=1 (eksplisit).
 *   - Tidak ada operasi drop/delete. Index yang sudah ada tapi definisinya
 *     berbeda dilaporkan sebagai MISMATCH dan TIDAK diutak-atik — harus
 *     ditinjau manual (lihat docs/PRODUCTION_DATABASE.md).
 *   - Koleksi better-auth (user/session/account/verification) dibuat jika
 *     belum ada; index-nya dikelola better-auth sendiri.
 *
 * EXIT CODE
 *   0 = database sudah/telah converged
 *   1 = ada MISMATCH yang perlu review manual, atau koneksi gagal
 */

import { MongoClient } from "mongodb";
import dns from "node:dns";
import { SPEC, REQUIRED_COLLECTIONS } from "./lib/atlas-schema.mjs";

// Atlas wajib resolver publik — resolver sistem di host Windows sering
// gagal menjawab SRV (querySrv ECONNREFUSED). Lihat verify-atlas.mjs.
const PUBLIC_RESOLVERS = ["1.1.1.1", "8.8.8.8", "1.0.0.1", "8.8.4.4"];
if (process.env.ATLAS_DNS_SERVERS && process.env.ATLAS_DNS_SERVERS !== "none") {
  try {
    dns.setServers(process.env.ATLAS_DNS_SERVERS.split(",").map((s) => s.trim()).filter(Boolean));
  } catch {}
} else if (!process.env.ATLAS_DNS_SERVERS) {
  try {
    dns.setServers(PUBLIC_RESOLVERS);
  } catch {}
}

const DRY_RUN = process.env.MIGRATE_DRY_RUN === "1";
const redact = (u) => (u || "").replace(/\/\/([^:/@]+):([^@]*)@/, "//$1:***@");

const COLLECTIONS = REQUIRED_COLLECTIONS;

function requireAtlasUri() {
  const uri = process.env.DATABASE_URL;
  if (!uri) throw new Error("DATABASE_URL tidak diset");
  const isAtlas = uri.startsWith("mongodb+srv://") || /\.mongodb\.net/.test(uri);
  if (!isAtlas && process.env.ALLOW_LOCAL_MONGO !== "1") {
    throw new Error(
      "Menolak DATABASE_URL non-Atlas. Set ALLOW_LOCAL_MONGO=1 hanya untuk verifikasi lokal eksplisit."
    );
  }
  return uri;
}

function sameKey(a, b) {
  const ka = JSON.stringify(Object.keys(a).sort().map((k) => [k, a[k]]));
  const kb = JSON.stringify(Object.keys(b).sort().map((k) => [k, b[k]]));
  return ka === kb;
}

async function main() {
  const uri = requireAtlasUri();
  const dbName = process.env.DATABASE_NAME || "journal_trade_prod";
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: Number(process.env.MIGRATE_TIMEOUT_MS || 20000),
    connectTimeoutMS: Number(process.env.MIGRATE_TIMEOUT_MS || 20000),
    retryWrites: true,
    w: "majority",
  });

  try {
    await client.connect();
  } catch (err) {
    console.log(JSON.stringify({ ok: false, reason: `tidak bisa connect: ${err.message}`, uri: redact(uri) }, null, 2));
    process.exit(1);
  }

  const db = client.db(dbName);
  const created = [];
  const indexesCreated = [];
  const mismatches = [];
  const skippedManaged = [];

  try {
    // Pastikan database ada: Atlas baru membuat DB saat ada tulisan pertama.
    if (!DRY_RUN) {
      await db.collection("trades").findOne({}, { projection: { _id: 1 } }).catch(() => null);
      if (!(await db.listCollections().toArray()).length) {
        await db.collection("_migration_marker").insertOne({
          migratedAt: new Date(),
          by: "scripts/migrate-atlas.mjs",
          collections: COLLECTIONS.length,
        });
        created.push("(database)");
      }
    }

    for (const name of COLLECTIONS) {
      const spec = SPEC[name];
      const exists = (await db.listCollections({ name }).hasNext());

      if (!exists) {
        if (DRY_RUN) {
          created.push(name);
        } else {
          await db.createCollection(name);
          created.push(name);
        }
      }

      if (spec.managedBy) {
        skippedManaged.push({ collection: name, managedBy: spec.managedBy });
        continue;
      }

      const current = exists ? await db.collection(name).indexes() : [];
      for (const want of spec) {
        const found = current.find((i) => i.name === want.name);
        if (!found) {
          if (DRY_RUN) {
            indexesCreated.push(`${name}.${want.name} (dry-run)`);
            continue;
          }
          const opts = { name: want.name };
          if (want.unique) opts.unique = true;
          if (want.sparse) opts.sparse = true;
          if (want.expireAfterSeconds) opts.expireAfterSeconds = want.expireAfterSeconds;
          if (want.partialFilterExpression) opts.partialFilterExpression = want.partialFilterExpression;
          try {
            await db.collection(name).createIndex(want.key, opts);
            indexesCreated.push(`${name}.${want.name}`);
          } catch (err) {
            mismatches.push({
              collection: name,
              index: want.name,
              problem: `gagal dibuat: ${err.codeName || err.message}`,
            });
          }
          continue;
        }
        // Sudah ada — cek definisinya masih cocok.
        const problems = [];
        if (!sameKey(found.key, want.key)) problems.push("key berbeda");
        if (!!found.unique !== !!want.unique) problems.push(`unique ${!!found.unique} != ${!!want.unique}`);
        if (!!found.sparse !== !!want.sparse) problems.push(`sparse ${!!found.sparse} != ${!!want.sparse}`);
        if (want.expireAfterSeconds && found.expireAfterSeconds !== want.expireAfterSeconds) {
          problems.push(`TTL ${found.expireAfterSeconds} != ${want.expireAfterSeconds}`);
        }
        if (want.partialFilterExpression) {
          const a = JSON.stringify(found.partialFilterExpression);
          const b = JSON.stringify(want.partialFilterExpression);
          if (a !== b) problems.push("partialFilterExpression berbeda");
        }
        if (problems.length) {
          mismatches.push({ collection: name, index: want.name, problem: problems.join("; ") });
        }
      }
    }

    const report = {
      ok: mismatches.length === 0,
      dryRun: DRY_RUN,
      uri: redact(uri),
      database: dbName,
      collectionsExpected: COLLECTIONS.length,
      collectionsCreated: created,
      indexesCreated,
      indexesCreatedCount: indexesCreated.filter((i) => !i.includes("dry-run")).length,
      mismatches,
      managedByOther: skippedManaged,
      nextStep:
        mismatches.length === 0
          ? "jalankan: node scripts/verify-atlas.mjs"
          : "review mismatch di atas — JANGAN drop index manual tanpa dokumentasi",
    };

    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.ok ? 0 : 1;
  } finally {
    await client.close().catch(() => {});
  }
}

main().catch((err) => {
  console.log(JSON.stringify({ ok: false, reason: err.message, stack: err.stack }, null, 2));
  process.exitCode = 1;
});
