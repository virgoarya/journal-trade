/**
 * seed.ts — Inisialisasi UserProfile default untuk akun 'Virga Ariyanto' / 'VTrades'
 *
 * Jalankan:
 *   npx prisma db push        (buat tabel)
 *   npx tsx prisma/seed.ts    (insert seed data)
 *
 * Environment:
 *   DATABASE_URL_AGENT  → connection string PostgreSQL (wajib di .env)
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding UserProfile...");

  // ── Cleanup (opsional — uncomment jika ingin re-seed dari nol)
  // await prisma.userMemoryNote.deleteMany();
  // await prisma.userProfile.deleteMany();

  // ── Cek apakah profile sudah ada
  const existing = await prisma.userProfile.findUnique({
    where: { userId: "virga" },
  });

  if (existing) {
    console.log(`ℹ️  UserProfile untuk userId="virga" sudah ada, skip seed.`);
    console.log(`   displayName: ${existing.displayName}`);
    console.log(`   preferredName: ${existing.preferredName}`);
    console.log(`   agentPersona: ${existing.agentPersona}`);
    return;
  }

  // ── Insert default profile
  const profile = await prisma.userProfile.create({
    data: {
      userId: "virga",
      displayName: "VTrades",
      legalName: "Virga Talita Ariyanto",
      preferredName: "Virga",
      tradingStyles: ["SMC", "ICT", "MSNR"],
      favoriteAssets: ["XAUUSD", "EURUSD"],
      riskTolerance: "Selective / High R:R",
      agentPersona: "hawk", // default persona: Hawk Quant Engine
      memoryNotes: {
        create: [
          // IDENTITY
          {
            category: "IDENTITY",
            content: "User dipanggil Virga. Menyukai setup liquidity sweep M15.",
            confidence: 0.95,
          },
          {
            category: "IDENTITY",
            content: "User operator Hunter Trades Journal — developer & trader.",
            confidence: 0.9,
          },
          // TRADING_RULE
          {
            category: "TRADING_RULE",
            content: "Gaya trading: SMC (Smart Money Concepts) + ICT (Inner Circle Trader) + MSNR.",
            confidence: 0.95,
          },
          {
            category: "TRADING_RULE",
            content: "Favorite asset: XAUUSD dan EURUSD. Preferential setup: liquidity sweep, BOS, MSS.",
            confidence: 0.9,
          },
          {
            category: "TRADING_RULE",
            content: "Timeframe utama: M15 / H1 untuk entry. Daily/Weekly untuk bias makro.",
            confidence: 0.85,
          },
          // RISK_PREFERENCE
          {
            category: "RISK_PREFERENCE",
            content: "Risk tolerance: Selective / High R:R. Tidak sekadar high frequency — quality setups hanya.",
            confidence: 0.95,
          },
          {
            category: "RISK_PREFERENCE",
            content: "Prefers definable risk (1–2% per trade) dengan target R:R ≥ 1:2.",
            confidence: 0.9,
          },
        ],
      },
    },
    include: { memoryNotes: true },
  });

  console.log("✅ UserProfile created:");
  console.log(`   id: ${profile.id}`);
  console.log(`   userId: ${profile.userId}`);
  console.log(`   preferredName: ${profile.preferredName}`);
  console.log(`   agentPersona: ${profile.agentPersona}`);
  console.log(`   memoryNotes count: ${profile.memoryNotes.length}`);
  console.log("\n🎉 Seed complete.");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
