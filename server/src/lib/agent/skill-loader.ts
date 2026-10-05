/**
 * skill-loader.ts — Sistem Skill Agent untuk Hunter Trades
 *
 * Skill adalah file markdown (.md) berisi panduan/prosedur spesialis yang
 * di-load OTOMATIS ke system prompt sesuai konteks pertanyaan user.
 *
 * Tujuan: mencegah persona jadi terlalu kaku. Kalau user bertanya hal spesifik
 * (mis. "berapa saldo ON RRP?"), skill yang relevan dipakai supaya agent
 * menjawab tepat sasaran — bukan melenceng ke analisis teknikal.
 *
 * Format file skill:
 * ─────────────────────────────────────────────
 * ---
 * name: liquidity-macro
 * description: Cara membaca & melaporkan data likuiditas makro (ON RRP, TGA, Net Liquidity)
 * triggers: on rrp, tga, likuiditas, liquidity, net liquidity, saldo
 * priority: 10
 * ---
 * (isi markdown...)
 * ─────────────────────────────────────────────
 *
 * Loader membaca frontmatter, lalu memilih skill yang trigger-nya cocok dengan
 * pesan user. Skill terpilih disuntikkan sebagai blok "SKILL AKTIF" di prompt.
 */

import fs from "fs";
import path from "path";

// ─────────────────────────────────────────────────────────────
// Tipe
// ─────────────────────────────────────────────────────────────

export interface AgentSkill {
  /** identifier unik (dari frontmatter `name`) */
  name: string;
  /** deskripsi singkat — dipakai untuk logging & seleksi */
  description: string;
  /** kata kunci pemicu (lowercase). Bisa frasa multi-kata. */
  triggers: string[];
  /** makin tinggi = makin prioritas kalau banyak skill cocok */
  priority: number;
  /** isi markdown (tanpa frontmatter) */
  body: string;
}

// ─────────────────────────────────────────────────────────────
// Resolusi direktori skill
// ─────────────────────────────────────────────────────────────

/**
 * Cari direktori skill. Cek beberapa kandidat supaya jalan di dev (tsx → src)
 * maupun production (node → dist).
 */
function resolveSkillsDir(): string | null {
  const candidates = [
    path.join(__dirname, "skills"), // dist/lib/agent/skills atau src/lib/agent/skills
    path.join(process.cwd(), "src", "lib", "agent", "skills"),
    path.join(process.cwd(), "dist", "lib", "agent", "skills"),
  ];

  for (const dir of candidates) {
    try {
      if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
        // pastikan ada minimal satu .md
        const hasMd = fs.readdirSync(dir).some((f) => f.endsWith(".md"));
        if (hasMd) return dir;
      }
    } catch {
      // lanjut ke kandidat berikutnya
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// Parser frontmatter sederhana (tanpa dependency eksternal)
// ─────────────────────────────────────────────────────────────

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const meta: Record<string, string> = {};
  const trimmed = raw.replace(/^\uFEFF/, ""); // buang BOM

  if (!trimmed.startsWith("---")) {
    return { meta, body: trimmed.trim() };
  }

  const endIdx = trimmed.indexOf("\n---", 3);
  if (endIdx === -1) {
    return { meta, body: trimmed.trim() };
  }

  const fmBlock = trimmed.slice(3, endIdx);
  const body = trimmed.slice(endIdx + 4).trim();

  for (const line of fmBlock.split("\n")) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const colon = s.indexOf(":");
    if (colon === -1) continue;
    const key = s.slice(0, colon).trim();
    const value = s.slice(colon + 1).trim();
    meta[key] = value;
  }

  return { meta, body };
}

function parseTriggers(value: string | undefined): string[] {
  if (!value) return [];
  // format: "on rrp, tga, likuiditas"  atau  "[on rrp, tga]"
  return value
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

// ─────────────────────────────────────────────────────────────
// Cache skill (dibaca sekali, lalu di-reuse)
// ─────────────────────────────────────────────────────────────

let cachedSkills: AgentSkill[] | null = null;
let cachedDir: string | null = null;
let cacheMtimeMs = 0;

function loadSkillsFromDisk(): AgentSkill[] {
  const dir = resolveSkillsDir();
  if (!dir) return [];

  // Invalidasi cache kalau direktori berubah (mtime berubah)
  try {
    const stat = fs.statSync(dir);
    if (cachedSkills && cachedDir === dir && stat.mtimeMs === cacheMtimeMs) {
      return cachedSkills;
    }
    cacheMtimeMs = stat.mtimeMs;
  } catch {
    // ignore
  }

  const skills: AgentSkill[] = [];

  try {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(dir, file), "utf-8");
        const { meta, body } = parseFrontmatter(raw);
        if (!body) continue;

        skills.push({
          name: meta.name || file.replace(/\.md$/, ""),
          description: meta.description || "",
          triggers: parseTriggers(meta.triggers),
          priority: Number(meta.priority) || 0,
          body,
        });
      } catch {
        // skip file yang gagal dibaca
      }
    }
  } catch {
    return [];
  }

  cachedSkills = skills;
  cachedDir = dir;
  return skills;
}

// ─────────────────────────────────────────────────────────────
// Seleksi skill
// ─────────────────────────────────────────────────────────────

export interface SelectSkillsOptions {
  /** pesan terakhir user */
  userMessage: string;
  /** beberapa pesan terakhir (opsional) — untuk konteks percakapan */
  recentMessages?: string[];
  /** maksimum skill yang di-inject */
  limit?: number;
  /** paksa load skill tertentu (by name) — mis. dari test */
  forceSkills?: string[];
}

export interface SelectedSkill {
  skill: AgentSkill;
  matchedTriggers: string[];
  score: number;
}

/**
 * Cek apakah trigger cocok di dalam teks.
 *
 * PENTING: pakai word-boundary untuk trigger pendek/satu kata, supaya
 * "rr" tidak cocok di "sekarang" dan "hi" tidak cocok di "ini".
 * Trigger multi-kata tetap pakai substring (frasa utuh).
 */
function matchesTrigger(haystack: string, trigger: string): boolean {
  const t = trigger.toLowerCase().trim();
  if (!t) return false;

  // Frasa multi-kata: substring biasa
  if (t.includes(" ")) return haystack.includes(t);

  // Satu kata: word boundary, escape regex char khusus
  const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // \b tidak bekerja baik dengan simbol (mis. "1%") — pakai lookaround
  const re = new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "i");
  return re.test(haystack);
}

/**
 * Pilih skill yang relevan dengan pesan user.
 *
 * Skor = (jumlah trigger cocok × 10) + priority.
 * Kalau tidak ada yang cocok sama sekali, return array kosong (prompt tetap valid).
 */
export function selectSkills(options: SelectSkillsOptions): SelectedSkill[] {
  const { userMessage, recentMessages = [], limit = 3, forceSkills } = options;
  const all = loadSkillsFromDisk();
  if (all.length === 0) return [];

  // Paksa skill tertentu kalau diminta
  if (forceSkills && forceSkills.length > 0) {
    return all
      .filter((s) => forceSkills.includes(s.name))
      .map((s) => ({ skill: s, matchedTriggers: ["(forced)"], score: 9999 }));
  }

  const haystack = [userMessage, ...recentMessages.slice(-2)]
    .join(" \n ")
    .toLowerCase();

  const scored: SelectedSkill[] = [];

  for (const skill of all) {
    const matched = skill.triggers.filter((t) => matchesTrigger(haystack, t));
    if (matched.length === 0) continue;
    scored.push({
      skill,
      matchedTriggers: matched,
      score: matched.length * 10 + skill.priority,
    });
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

// ─────────────────────────────────────────────────────────────
// Format untuk prompt
// ─────────────────────────────────────────────────────────────

/**
 * Ubah skill terpilih jadi blok teks siap-inject ke system prompt.
 */
export function formatSkillsForPrompt(selected: SelectedSkill[]): string {
  if (selected.length === 0) return "";

  const parts = selected.map(({ skill }) => {
    return `### SKILL: ${skill.name}\n_${skill.description}_\n\n${skill.body}`;
  });

  return `\n---\n🎯 SKILL AKTIF (WAJIB DIIKUTI — dipilih otomatis sesuai konteks pertanyaan user):\n\n${parts.join(
    "\n\n"
  )}\n`;
}

/**
 * Ambil semua skill yang tersedia (untuk logging/debug).
 */
export function listAllSkills(): AgentSkill[] {
  return loadSkillsFromDisk();
}

/**
 * Reset cache — dipakai saat hot-reload / test.
 */
export function resetSkillCache(): void {
  cachedSkills = null;
  cachedDir = null;
  cacheMtimeMs = 0;
}
