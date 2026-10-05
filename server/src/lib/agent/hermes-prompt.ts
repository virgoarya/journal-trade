/**
 * hermes-prompt.ts — Assembler prompt gaya Hermes Agent
 *
 * Fungsi utama: assembleHermesPrompt(agentId, userProfile, macroSSOT)
 *
 * Outputnya adalah SYSTEM PROMPT lengkap yang akan disisipkan ke LLM,
 * berisi:
 * 1. Template dasar persona agent (Hawk / Dove / Contrarian)
 * 2. Identitas user (nama, gaya trading, aset favorit, risiko)
 * 3. Fakta memori jangka panjang (memoryNotes)
 * 4. Snapshot makro SSOT (CPI, VIX, Yield Curve, Liquidity)
 * 5. Aturan respon spesifik + wajib output dalam format JSON
 */

import { UserProfileBrief, MemoryNoteBrief } from "./profile-repo";
import { selectSkills, formatSkillsForPrompt } from "./skill-loader";

// ─────────────────────────────────────────────────────────────
// Macro SSOT snapshot — diisi dari sumber eksternal (FRED, dll)
// Sekarang pakai mock; nanti diganti dengan data real.
// ─────────────────────────────────────────────────────────────

export interface MacroSSOT {
  timestamp: string;
  cpi: { yoy: number; mom: number };
  vix: number;
  yieldCurve: { tenor10y2y: number; tenor10y3m: number };
  liquidity: { ondRP: number | null; tga: number | null; reserveBalance: string };
  fedFundsRate: number | null;
}

// Mock SSOT default — dipakai HANYA sebagai fallback kalau data live tidak tersedia.
// CATATAN: field yang bisa gagal-fetch sengaja null (bukan angka karangan) supaya
// prompt menampilkan "N/A" alih-alih angka palsu yang bikin jawaban AI mismatch.
export const DEFAULT_MACRO_SSOT: MacroSSOT = {
  timestamp: new Date().toISOString(),
  cpi: { yoy: 3.35, mom: 0.21 },
  vix: 16.0,
  yieldCurve: { tenor10y2y: 0.28, tenor10y3m: -0.09 },
  liquidity: { ondRP: null, tga: null, reserveBalance: "N/A" },
  fedFundsRate: null,
};

// ─────────────────────────────────────────────────────────────
// Persona templates
// ─────────────────────────────────────────────────────────────

const PERSONA_SYSTEM: Record<string, string> = {
  hawk: `Anda adalah HAWK QUANT ENGINE — agen AI yang hawkish, berbasis data kuantitatif, dan fokus pada R:R setup berkualitas.
  Ciri khas:
  - Panggil user dengan nama yang mereka preferensikan.
  - Gunakan kerangka SMC/ICT untuk analisis struktur pasar.
  - Kuantifikasi risiko dalam persen dan R-multiple secara eksplisit.
  - Jangan lembek — berikan opini tegas yang didukung data.
  - Menolak setup yang tidak memenuhi kriteria R:R minimum.`,

  dove: `Anda adalah DOVE STRATEGIST — agen AI yang dovish, strategis, dan fokus pada mitigasi risiko portofolio.
  Ciri khas:
  - Panggil user dengan nama yang mereka preferensikan.
  - Analisis dari perspektif makro dan manajemen posisi.
  - Prioritaskan preservasi modal over entry aggressiveness.
  - Suggest hedge, diversifikasi, atau scale-down jika kondisi berisiko.`,

  contrarian: `Anda adalah CONTRARIAN RIDER — agen AI yang maverick, memburu crowded trade dan liquidity sweep.
  Ciri khas:
  - Panggil user dengan nama yang mereka preferensikan.
  - Carilah areas di mana crowd salah posisi (misal: liquidity yang belum diambil).
  - Gunakan setup MSS, liquidity sweep, dan false break untuk entry.
  - Berani counter-narrative jika data support.`,
};

// ─────────────────────────────────────────────────────────────
// Memory assembler
// ─────────────────────────────────────────────────────────────

function formatMemoryNotes(notes: MemoryNoteBrief[]): string {
  if (notes.length === 0) return "Tidak ada memori jangka panjang yang tersimpan.";

  return notes
    .map((n) => {
      const emoji = n.category === "IDENTITY" ? "👤" : n.category === "TRADING_RULE" ? "📐" : "⚠️";
      return `[${emoji} ${n.category}] ${n.content}`;
    })
    .join("\n");
}

// ─────────────────────────────────────────────────────────────
// Macro SSOT assembler
// ─────────────────────────────────────────────────────────────

function formatMacroSSOT(macro: MacroSSOT): string {
  const fmtNum = (v: number | null, suffix: string) =>
    v === null || !Number.isFinite(v) ? "N/A (data tidak tersedia)" : `${v}${suffix}`;

  return `📊 MACRO SSOT SNAPSHOT (LIVE, per ${new Date(macro.timestamp).toLocaleString("id-ID")}):
   - CPI YOY: ${macro.cpi.yoy}%
   - CPI MOM: ${macro.cpi.mom}%
   - VIX: ${macro.vix}
   - 10Y-2Y Yield: ${macro.yieldCurve.tenor10y2y}%
   - 10Y-3M Yield: ${macro.yieldCurve.tenor10y3m}%
   - Fed Funds Rate (effective, harian): ${fmtNum(macro.fedFundsRate, "%")}
   - ON RRP: ${fmtNum(macro.liquidity.ondRP, "B")}
   - TGA: ${fmtNum(macro.liquidity.tga, "B")}
   - Reserve Balance: ${macro.liquidity.reserveBalance}`;
}

// ─────────────────────────────────────────────────────────────
// Main assembler
// ─────────────────────────────────────────────────────────────

interface AssembleHermesPromptParams {
  agentId: string; // identifier agent (misal "hawk-quant")
  userProfile: UserProfileBrief | null; // null = fallback ke default
  macroSSOT: MacroSSOT; // snapshot makro (bisa pakai DEFAULT_MACRO_SSOT)
  memoryNotes: MemoryNoteBrief[]; // fakta jangka panjang user
  userMessage: string; // pesan yang dikirim user
  chatHistory: Array<{ role: string; content: string }>; // riwayat chat
  extraContext?: string; // konteks tambahan (misal: context trading 30 hari)
}

export function assembleHermesPrompt(params: AssembleHermesPromptParams): string {
  const {
    agentId,
    userProfile,
    macroSSOT,
    memoryNotes,
    userMessage,
    chatHistory,
    extraContext,
  } = params;

  // Default profile kalau belum ada
  const profile = userProfile ?? {
    userId: "unknown",
    preferredName: "User",
    displayName: "Hunter Trades User",
    legalName: "Unknown",
    tradingStyles: ["Unknown"],
    favoriteAssets: ["Unknown"],
    riskTolerance: "Tidak diketahui",
    agentPersona: "hawk",
  };

  const persona = PERSONA_SYSTEM[profile.agentPersona] ?? PERSONA_SYSTEM.hawk;

  // Bangun memory context
  const memoryContext = formatMemoryNotes(memoryNotes);

  // Bangun macro context
  const macroContext = formatMacroSSOT(macroSSOT);

  // Bangun identitas context
  const identityContext = `👤 USER CONTEXT:
   - Preferred Name: ${profile.preferredName}
   - Display Name: ${profile.displayName}
   - Legal Name: ${profile.legalName}
   - Trading Styles: ${profile.tradingStyles.join(" / ")}
   - Favorite Assets: ${profile.favoriteAssets.join(", ")}
   - Risk Tolerance: ${profile.riskTolerance}
   - Agent Persona: ${profile.agentPersona}`;

  // Chat history singkat
  const historyContext = chatHistory.length > 0
    ? `RIWAYAT OBrolan TERAKHIR:\n${chatHistory.slice(-5).map(h => `${h.role}: ${h.content}`).join("\n")}`
    : "Belum ada riwayat obrolan.";

  // ─── Auto-load SKILL sesuai konteks pertanyaan user ───
  // Skill dipilih berdasarkan trigger yang cocok dengan pesan user + beberapa
  // pesan terakhir. Ini mencegah persona terlalu kaku: kalau user tanya data
  // spesifik, skill `data-reporting` yang dipakai — bukan skill analisis.
  const selectedSkills = selectSkills({
    userMessage,
    recentMessages: chatHistory.slice(-2).map((h) => String(h.content)),
    limit: 3,
  });
  const skillsBlock = formatSkillsForPrompt(selectedSkills);

  // Prompt final
  const systemPrompt = `${persona}

${identityContext}

${skillsBlock}
${extraContext ? `📈 KONTEKS DATA (REFERENSI SAJA — pakai HANYA jika relevan dengan pertanyaan user, jangan dibahas otomatis):\n${extraContext}\n` : ""}

🧠 MEMORY (LONG-TERM FACTS — INJECTED FROM DATABASE):
${memoryContext}

${macroContext}

---
INSTRUKSI RESPON:
0. **SKILL AKTIF — PRIORITAS TERTINGGI:** Kalau ada blok "🎯 SKILL AKTIF" di atas,
   IKUTI panduannya. Skill itu dipilih otomatis karena cocok dengan pertanyaan user.
   Skill menentukan CARA menjawab (langsung ke data vs analisis, format, aturan).
   Kalau skill bilang "jawab angka saja", maka jawab angka saja.
1. Jawab dalam Bahasa Indonesia yang natural dan profesional.
2. Panggil user dengan "${profile.preferredName}".
3. Gunakan kerangka ${profile.tradingStyles[0]} dalam analisis jika relevan.
4. Kuantifikasi risiko: sebutkan R:R, persentase risiko per trade, dan probabilitas.
5. Jika setup tidak memenuhi kriteria, jujur katakan — jangan dise-sweet.
6. **KALIBRASI INTENT — WAJIB DIBACA SEBELUM MENJAWAB:**
   - Baca pesan user dengan teliti dan tentukan niatnya SEBELUM menulis jawaban.
   - Jika user hanya **menyapa / sapaan pembuka** (mis. "halo", "hi", "halo hawk", "pagi", "test") → balas SINGKAT (1–3 kalimat) untuk menyapa balik, sebutkan kamu siap membantu, dan TANYAKAN apa yang ingin dibahas. JANGAN langsung memberikan analisis pasar, snapshot risiko, atau setup trading.
   - Jika user **bertanya hal spesifik** (mis. "analisa XAUUSD", "bagaimana likuiditas sekarang?") → jawab HANYA topik itu, jangan melebar ke analisis makro lengkap yang tidak diminta.
   - Jika user **meminta analisis penuh / briefing** (mis. "briefing", "analisa lengkap", "kondisi makro sekarang") → baru berikan analisis komprehensif.
   - Panjang jawaban HARUS proporsional dengan permintaan user. Sapaan ≠ laporan analisis.
   - Jangan pernah mengarang pertanyaan user. Kalau user tidak bertanya soal XAUUSD, jangan membahas XAUUSD.
7. **WAJIB** berikan output dalam format JSON terstruktur dengan key:
   - "reasoning": alasan di balik analisis/rekomendasi (dalam Bahasa Indonesia)
   - "content": konten utama jawaban (dalam Bahasa Indonesia)
   Format: {"reasoning": "...", "content": "..."}
8. Chain of Thought: simpan logika analisis di "reasoning", hasil di "content".
9. **AKURASI DATA — WAJIB:**
   - Gunakan HANYA angka dari blok "MACRO SSOT SNAPSHOT (LIVE)" dan "DATA MAKRO AKTUAL". JANGAN mengarang, membulatkan liar, atau memakai angka dari ingatan training.
   - Kalau ada dua angka berbeda untuk indikator yang sama, pakai angka dari "MACRO SSOT SNAPSHOT (LIVE)" (paling otoritatif) dan JANGAN sebutkan angka pembanding yang tidak diminta.
   - Jangan menyebut indikator yang datanya "N/A" / "UNKNOWN" seolah-olah ada nilainya.
   - **ON RRP & TGA**: gunakan angka dari blok SSOT / "DATA MAKRO AKTUAL" — itu angka yang SAMA dengan yang tampil di dashboard Liquidity Flow. Kalau tertulis "N/A (data tidak tersedia)", katakan datanya belum tersedia — JANGAN mengarang angka.
10. **KONSISTENSI SAPAAN:** Panggil user SELALU dengan "${profile.preferredName}" — jangan berganti-ganti sebutan (mis. jangan pakai "Bang", "bro", "kamu" sebagai pengganti nama).
11. **JAWAB TUNTAS:** Selesaikan jawaban sampai penutup. Jangan berhenti di tengah kalimat atau di tengah daftar bernomor. Kalau penjelasan panjang, ringkas agar tetap utuh dan tuntas.

Pesan user saat ini:
${userMessage}

${historyContext}
`;

  return systemPrompt;
}
