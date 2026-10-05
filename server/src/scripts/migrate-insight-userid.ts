/**
 * TEMP migration — isi field `userId` pada AgentInsight lama yang belum punya.
 *
 * Insight dibuat sebelum field userId ditambahkan ke schema, sehingga tidak
 * punya field tersebut. Query filter `{ userId: X }` tidak akan mencocokkannya,
 * jadi data ini "yatim" — tidak muncul untuk user mana pun.
 *
 * Strategi: tandai sebagai "global" (arsip sistem) supaya tidak mengambang,
 * dan bisa dibedakan dari insight per-user yang baru.
 *
 * Jalankan: npx tsx src/scripts/migrate-insight-userid.ts
 */

import "dotenv/config";
import mongoose from "mongoose";
import { AgentInsight } from "../models/AgentInsight";

async function main() {
  const uri = process.env.DATABASE_URL;
  if (!uri) {
    console.error("❌ DATABASE_URL (MongoDB) tidak ditemukan");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("✅ MongoDB connected");

  const total = await AgentInsight.countDocuments({});
  // Dokumen yang tidak punya field userId sama sekali (bukan yang null)
  const missing = await AgentInsight.countDocuments({ userId: { $exists: false } });
  console.log(`Total insight          : ${total}`);
  console.log(`Tanpa field userId     : ${missing}`);

  if (missing === 0) {
    console.log("✅ Semua insight sudah punya field userId — tidak ada yang perlu dimigrasi.");
    await mongoose.disconnect();
    return;
  }

  // Tandai sebagai arsip global
  const res = await AgentInsight.updateMany(
    { userId: { $exists: false } },
    { $set: { userId: "global", "metadata.legacy": true } }
  );
  console.log(`✅ Dimigrasi ke "global": ${res.modifiedCount}`);

  // Verifikasi
  const after = await AgentInsight.countDocuments({ userId: { $exists: false } });
  const globalCount = await AgentInsight.countDocuments({ userId: "global" });
  console.log(`Sisa tanpa userId      : ${after}`);
  console.log(`Ditandai "global"      : ${globalCount}`);

  await mongoose.disconnect();
  console.log("✅ Selesai");
}

main().catch((e) => {
  console.error("❌ Error:", e.message);
  process.exit(1);
});
