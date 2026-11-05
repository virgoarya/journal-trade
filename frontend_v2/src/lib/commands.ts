/**
 * Command registry + fuzzy filter untuk Command Palette (⌘K).
 * Spec: docs/design/macro-charting-and-palette-spec.md §4
 *
 * Sengaja dipisah dari hook supaya definisi & filter bisa di-unit-test tanpa React.
 * Context ditaruh di sini (bukan di hook) untuk memutus impor melingkar
 * hook ↔ komponen overlay.
 */
import { createContext } from "react";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  LineChart,
  Grid3X3,
  Droplets,
  Calendar,
  Newspaper,
  Brain,
  Eye,
  RefreshCw,
  RotateCcw,
  TrendingUp,
  Activity,
} from "lucide-react";
import { DEFAULT_INSTRUMENTS } from "@/services/macro-candles.service";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type CommandType = "navigation" | "instrument" | "widget" | "action";

export interface Command {
  id: string;
  type: CommandType;
  title: string;
  description: string;
  keywords?: string[];
  shortcut?: string[];
  icon: LucideIcon;
  category: string;
  action: () => void;
}

/** Definisi perintah tanpa aksi — aksi di-inject oleh provider (butuh router/context). */
export type CommandDefinition = Omit<Command, "action">;

export interface CommandPaletteContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  query: string;
  setQuery: (q: string) => void;
  commands: Command[];
  filteredCommands: Command[];
  groupedCommands: { category: string; items: Command[] }[];
  executeCommand: (cmd: Command) => void;
}

export const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// KATEGORI
// ─────────────────────────────────────────────────────────────────────────────

export const COMMAND_CATEGORIES = {
  navigation: "NAVIGASI",
  instrument: "INSTRUMEN",
  widget: "WIDGET",
  action: "AKSI",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// DEFINISI — TAB NAVIGASI
// ─────────────────────────────────────────────────────────────────────────────

export const TAB_COMMANDS: CommandDefinition[] = [
  {
    id: "tab-overview",
    type: "navigation",
    title: "Go to Overview",
    description: "Macro regime, chart, liquidity, heatmap",
    keywords: ["home", "overview", "utama", "chart"],
    shortcut: ["⌥", "1"],
    icon: LayoutDashboard,
    category: COMMAND_CATEGORIES.navigation,
  },
  {
    id: "tab-cot",
    type: "navigation",
    title: "Go to COT",
    description: "Commitment of Traders, divergence scanner",
    keywords: ["cot", "positioning", "posisi"],
    shortcut: ["⌥", "2"],
    icon: TrendingUp,
    category: COMMAND_CATEGORIES.navigation,
  },
  {
    id: "tab-quant-lab",
    type: "navigation",
    title: "Go to Quant Lab",
    description: "Yield curve, real yield, duration risk",
    keywords: ["quant", "yield", "curve", "durasi"],
    shortcut: ["⌥", "3"],
    icon: Activity,
    category: COMMAND_CATEGORIES.navigation,
  },
  {
    id: "tab-nexus",
    type: "navigation",
    title: "Go to Nexus",
    description: "Peta relasi antar aset makro",
    keywords: ["nexus", "graph", "relasi"],
    shortcut: ["⌥", "4"],
    icon: Grid3X3,
    category: COMMAND_CATEGORIES.navigation,
  },
  {
    id: "tab-intelligence",
    type: "navigation",
    title: "Go to Intelligence",
    description: "Panel AI, berita, analisis",
    keywords: ["intelligence", "ai", "berita", "news"],
    shortcut: ["⌥", "5"],
    icon: Brain,
    category: COMMAND_CATEGORIES.navigation,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// DEFINISI — INSTRUMEN
// ─────────────────────────────────────────────────────────────────────────────

export const INSTRUMENT_COMMANDS: CommandDefinition[] = DEFAULT_INSTRUMENTS.map((inst) => ({
  id: `instrument-${inst.symbol}`,
  type: "instrument" as const,
  title: `${inst.symbol} — ${inst.name}`,
  description: `Buka di chart · ${inst.category}`,
  keywords: [inst.symbol.toLowerCase(), inst.name.toLowerCase(), inst.category.toLowerCase()],
  icon: LineChart,
  category: COMMAND_CATEGORIES.instrument,
}));

// ─────────────────────────────────────────────────────────────────────────────
// DEFINISI — TOGGLE WIDGET
// ─────────────────────────────────────────────────────────────────────────────

export const WIDGET_COMMANDS: CommandDefinition[] = [
  { id: "widget-toggle-macro-regime", title: "Toggle Macro Regime", description: "Tampilkan/sembunyikan panel regime makro", keywords: ["regime"], icon: Activity },
  { id: "widget-toggle-heatmap", title: "Toggle ETF Heatmap", description: "Tampilkan/sembunyikan heatmap ETF", keywords: ["heatmap", "etf"], icon: Grid3X3 },
  { id: "widget-toggle-liquidity-gauge", title: "Toggle Liquidity Flow", description: "Tampilkan/sembunyikan gauge likuiditas", keywords: ["liquidity", "likuiditas"], icon: Droplets },
  { id: "widget-toggle-ai-reasoning", title: "Toggle AI Reasoning", description: "Tampilkan/sembunyikan panel penalaran AI", keywords: ["ai", "reasoning"], icon: Brain },
  { id: "widget-toggle-economic-calendar", title: "Toggle Economic Calendar", description: "Tampilkan/sembunyikan kalender ekonomi", keywords: ["calendar", "kalender"], icon: Calendar },
  { id: "widget-toggle-news-feed", title: "Toggle News Feed", description: "Tampilkan/sembunyikan feed berita", keywords: ["news", "berita"], icon: Newspaper },
].map((c) => ({
  ...c,
  type: "widget" as const,
  category: COMMAND_CATEGORIES.widget,
}));

// ─────────────────────────────────────────────────────────────────────────────
// DEFINISI — AKSI CEPAT
// ─────────────────────────────────────────────────────────────────────────────

export const ACTION_COMMANDS: CommandDefinition[] = [
  {
    id: "action-refresh",
    type: "action",
    title: "Refresh All Data",
    description: "Paksa muat ulang seluruh data makro",
    keywords: ["refresh", "reload", "muat ulang"],
    icon: RefreshCw,
    category: COMMAND_CATEGORIES.action,
  },
  {
    id: "action-reset-layout",
    type: "action",
    title: "Reset Layout",
    description: "Pulihkan susunan panel ke default",
    keywords: ["reset", "layout", "default"],
    icon: RotateCcw,
    category: COMMAND_CATEGORIES.action,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRY LENGKAP
// ─────────────────────────────────────────────────────────────────────────────

export const COMMAND_DEFINITIONS: CommandDefinition[] = [
  ...TAB_COMMANDS,
  ...INSTRUMENT_COMMANDS,
  ...WIDGET_COMMANDS,
  ...ACTION_COMMANDS,
];

// ─────────────────────────────────────────────────────────────────────────────
// FUZZY FILTER + SCORING (spec §4.4)
//   exact 100 · keywords-exact 45 · startsWith 50 · contains 25 · desc 15 · fuzzy 10
// ─────────────────────────────────────────────────────────────────────────────

export function scoreCommand(
  cmd: Pick<Command, "title" | "description" | "keywords">,
  query: string
): number {
  const q = query.toLowerCase().trim();
  if (!q) return 0;

  const title = cmd.title.toLowerCase();
  const desc = cmd.description.toLowerCase();
  const keywords = cmd.keywords ?? [];

  if (title === q) return 100;
  if (title.startsWith(q)) return 50;
  if (keywords.some((k) => k === q)) return 45;
  if (title.includes(q)) return 25;
  if (desc.includes(q)) return 15;
  if (keywords.some((k) => k.includes(q))) return 10;

  // fuzzy: setiap karakter query muncul berurutan di title
  let qi = 0;
  for (let i = 0; i < title.length && qi < q.length; i++) {
    if (title[i] === q[qi]) qi++;
  }
  return qi === q.length ? 5 : 0;
}

/** Urutkan sesuai prioritas + skor: navigation → instrument → widget → action. */
const TYPE_ORDER: Record<CommandType, number> = {
  navigation: 0,
  instrument: 1,
  widget: 2,
  action: 3,
};

export function filterCommands(commands: Command[], query: string): Command[] {
  const q = query.trim();
  if (!q) return commands;

  return commands
    .map((cmd) => ({ cmd, score: scoreCommand(cmd, q) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return TYPE_ORDER[a.cmd.type] - TYPE_ORDER[b.cmd.type];
    })
    .map((x) => x.cmd);
}

/** Kelompokkan hasil per kategori — untuk render bergrup. */
export function groupCommands(
  commands: Command[]
): { category: string; items: Command[] }[] {
  const order: CommandType[] = ["navigation", "instrument", "widget", "action"];
  const groups: { category: string; items: Command[] }[] = [];

  for (const type of order) {
    const items = commands.filter((c) => c.type === type);
    if (items.length > 0) {
      groups.push({ category: COMMAND_CATEGORIES[type], items });
    }
  }
  return groups;
}
