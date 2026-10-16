/**
 * TEMP cleanup — hapus AgentInsight yang isinya pesan error, bukan analisis.
 *
 * Sebelumnya, saat semua model LLM gagal, base.agent menulis string
 * "Agent mengalami kendala koneksi ke 9Router LLM consensus." dan
 * proactive-alert menyimpannya sebagai insight. Hasilnya feed penuh
 * sampah yang terlihat seperti analisis.
 *
 * Jalankan: npx tsx src/scripts/cleanup-error-insights.ts
 */

import "dotenv/config";
import mongoose from "mongoose";
import { AgentInsight } from "../models/AgentInsight";

const ERROR_PATTERNS = [
  "kendala koneksi",
  "gagal mendapatkan respons",
  "analisis ai saat ini tidak tersedia",
  "analisis gagal dihasilkan",
  "no ai api keys configured",
];

async function main() {
  const uri = process.env.DATABASE_URL;
  if (!uri) {
    console.error("❌ DATABASE_URL tidak ditemukan");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("✅ MongoDB connected");

  const total = await AgentInsight.countDocuments({});
  const orFilter = ERROR_PATTERNS.map((p) => ({
    content: { $regex: p, $options: "i" },
  }));

  const bad = await AgentInsight.countDocuments({ $or: orFilter });
  console.log(`Total insight      : ${total}`);
  console.log(`Insight pesan error: ${bad}`);

  if (bad > 0) {
    const res = await AgentInsight.deleteMany({ $or: orFilter });
    console.log(`🗑️  Dihapus         : ${res.deletedCount}`);
  } else {
    console.log("Tidak ada yang perlu dihapus.");
  }

  const after = await AgentInsight.countDocuments({});
  console.log(`Sisa insight       : ${after}`);

  await mongoose.disconnect();
  console.log("✅ Selesai");
}

main().catch((e) => {
  console.error("❌ Error:", e.message);
  process.exit(1);
});
