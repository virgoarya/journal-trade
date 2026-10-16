/**
 * memory-extractor.service.ts — Background Memory Reflection Engine
 *
 * Fungsi utama: extractUserFacts(chatHistory, userProfile)
 *
 * Alur:
 * 1. Kirim chat history terbaru ke LLM (9Router) dengan prompt ekstraksi fakta
 * 2. LLM memproduksi JSON array fakta: { category, content, confidence }
 * 3. Filter fakta dengan confidence >= 0.8
 * 4. Return fakta yang siap di-save ke PostgreSQL
 *
 * Called secara async (non-blocking) setelah chat reply terkirim.
 */

import { env } from "../config/env";
import { silentLogger } from "../utils/silent-logger";
import { prismaAgent } from "../lib/agent/prisma-agent";

// ─────────────────────────────────────────────────────────────
// Interface untuk hasil ekstraksi
// ─────────────────────────────────────────────────────────────

export interface ExtractedFact {
  category: "IDENTITY" | "TRADING_RULE" | "RISK_PREFERENCE";
  content: string;
  confidence: number; // 0.0 – 1.0
}

export interface ExtractUserFactsParams {
  chatHistory: Array<{ role: string; content: string }>;
  userProfile?: {
    preferredName: string;
    tradingStyles: string[];
    favoriteAssets: string[];
    riskTolerance: string;
  } | null;
}

// ─────────────────────────────────────────────────────────────
// Kategori yang boleh diekstrak (sesuai schema Prisma)
// ─────────────────────────────────────────────────────────────

const ALLOWED_CATEGORIES = [
  "IDENTITY",
  "TRADING_RULE",
  "RISK_PREFERENCE",
] as const;

// ─────────────────────────────────────────────────────────────
// Prompt ekstraksi fakta untuk LLM
// ─────────────────────────────────────────────────────────────

function buildExtractionPrompt(params: ExtractUserFactsParams): string {
  const { chatHistory, userProfile } = params;

  const historyText =
    chatHistory.length > 0
      ? chatHistory
          .slice(-10) // hanya 10 pesan terbaru
          .map((h) => `${h.role === "user" ? "USER" : "ASSISTANT"}: ${h.content}`)
          .join("\n\n")
      : "Tidak ada riwayat obrolan.";

  const profileContext = userProfile
    ? `Profile yang sudah ada:\n- Nama: ${userProfile.preferredName}\n- Gaya Trading: ${userProfile.tradingStyles.join(", ")}\n- Aset Favorit: ${userProfile.favoriteAssets.join(", ")}\n- Risiko: ${userProfile.riskTolerance}\n`
    : "Belum ada profil user.";

  return `Anda adalah MEMORY EXTRACTOR — tugas Anda menganalisis percakapan antara USER dan ASSISTANT,
dan mengekstrak fakta baru tentang USER yang belum ada di profilnya.

PROFILE USER SEBELUMNYA:
${profileContext}

RICHTLINIEN (WAJIB DIKITI):
1. Hanya ekstrak fakta yang BENAR-BENAR BARU — jangan ulang apa yang sudah ada di profil.
2. Fakta yang diekstrak wajib cocok dengan salah satu kategori:
   - IDENTITY: informasi Personal (nama panggilan, background, hobi, pekerjaan, preferensi umum)
   - TRADING_RULE: aturan/gaya/setup trading yang disebutkan user
   - RISK_PREFERENCE: preference risiko, limit, target, approach manajemen risiko
3. Confidence harus jujur:
   - 0.95 = fakta sangat jelas dan eksplisit disebutkan
   - 0.85 = fakta cukup jelas
   - 0.80 = fakta agak tersirat tapi masuk akal
   - < 0.80 = JANGAN EKSTRAK (confidence terlalu rendah)
4. Format output WAJIB JSON array, contoh:
   [
     {"category": "TRADING_RULE", "content": "User menyukai setup liquidity sweep di M15", "confidence": 0.95},
     {"category": "IDENTITY", "content": "User menyebut dirinya trader retail", "confidence": 0.9}
   ]
5. JANGAN ekstrak lebih dari 3 fakta per eksekusi.
6. HANYA output JSON array, tidak ada teks lain.

RIWAYAT PERCAKAPAN (10 pesan terakhir):
${historyText}

TUGAS:
Ekstrak fakta baru dari percakapan di atas. Jika tidak ada fakta baru yang worth ekstrak, return [] (array kosong).
Output WAJIB dalam format JSON array[];
`;
}

// ─────────────────────────────────────────────────────────────
// Ekstraksi fakta (sinkron terhadap LLM call)
// ─────────────────────────────────────────────────────────────

export async function extractUserFacts(
  params: ExtractUserFactsParams
): Promise<ExtractedFact[]> {
  const prompt = buildExtractionPrompt(params);

  const baseUrl = env.NINE_ROUTER_URL || "http://localhost:20128/v1";
  const apiKey = env.NINE_ROUTER_API_KEY || "sk-dummy";
  const model = "gemini/gemini-3.5-flash-lite";

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: prompt,
          },
        ],
        max_tokens: 500,
        temperature: 0.3, // rendah agar konsisten
        stream: false,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`9Router extraction error ${response.status}: ${errorText}`);
    }

    const data: any = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || "[]";

    // Parse JSON
    let facts: ExtractedFact[] = [];
    try {
      facts = JSON.parse(rawContent);
    } catch {
      silentLogger.warn("[MEMORY-EXTRACTOR] Gagal parse JSON dari LLM:", rawContent);
      return [];
    }

    // Validate setiap fakta
    facts = facts.filter((f: any) => {
      if (!ALLOWED_CATEGORIES.includes(f.category)) {
        silentLogger.warn(`[MEMORY-EXTRACTOR] Kategori tidak valid: ${f.category}`);
        return false;
      }
      if (typeof f.content !== "string" || f.content.trim().length < 5) {
        silentLogger.warn("[MEMORY-EXTRACTOR] Content fakta terlalu pendek atau bukan string");
        return false;
      }
      if (typeof f.confidence !== "number" || f.confidence < 0 || f.confidence > 1) {
        silentLogger.warn("[MEMORY-EXTRACTOR] Confidence tidak valid:", f.confidence);
        return false;
      }
      return true;
    });

    // Filter confidence >= 0.8
    const highConfidenceFacts = facts.filter((f) => f.confidence >= 0.8);

    silentLogger.info(
      `[MEMORY-EXTRACTOR] Ekstraksi selesai — total: ${facts.length}, high-confidence (>=0.8): ${highConfidenceFacts.length}`
    );

    return highConfidenceFacts;
  } catch (error) {
    silentLogger.error("[MEMORY-EXTRACTOR] Ekstraksi gagal:", error);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────
// Save fakta ke PostgreSQL (jika belum ada di database)
// ─────────────────────────────────────────────────────────────

export async function saveFactsToUserProfile(
  userId: string,
  facts: ExtractedFact[]
): Promise<number> {
  if (facts.length === 0) return 0;

  // Cek apakah profil user ada
  const profile = await prismaAgent.userProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    silentLogger.warn(`[MEMORY-EXTRACTOR] Profile tidak ditemukan untuk userId=${userId}`);
    return 0;
  }

  // Deduplikasi: cek apakah konten sudah ada di memoryNotes
  const existingNotes = await prismaAgent.userMemoryNote.findMany({
    where: { profileId: profile.id },
    select: { content: true },
  });

  const existingContents = new Set(existingNotes.map((n) => n.content.toLowerCase().trim()));

  // Filter fakta yang belum ada
  const newFacts = facts.filter(
    (f) => !existingContents.has(f.content.toLowerCase().trim())
  );

  if (newFacts.length === 0) {
    silentLogger.info("[MEMORY-EXTRACTOR] Semua fakta sudah ada di database, skip save");
    return 0;
  }

  // Insert fakta baru
  await prismaAgent.userMemoryNote.createMany({
    data: newFacts.map((f) => ({
      profileId: profile.id,
      category: f.category,
      content: f.content.trim(),
      confidence: f.confidence,
    })),
  });

  silentLogger.info(
    `[MEMORY-EXTRACTOR] Saved ${newFacts.length} fakta baru ke UserProfile userId=${userId}`
  );

  return newFacts.length;
}
