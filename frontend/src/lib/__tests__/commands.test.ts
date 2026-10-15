import { describe, it, expect } from "vitest";
import {
  scoreCommand,
  filterCommands,
  groupCommands,
  COMMAND_DEFINITIONS,
  type Command,
} from "../commands";

// ── helper ───────────────────────────────────────────────────────────────────

function makeCommand(partial: Partial<Command> & { id: string }): Command {
  return {
    type: "action",
    title: partial.title ?? partial.id,
    description: "",
    icon: (() => null) as never,
    category: "AKSI",
    action: () => void 0,
    ...partial,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// scoreCommand
// ─────────────────────────────────────────────────────────────────────────────

describe("scoreCommand", () => {
  it("100 untuk title exact match", () => {
    const cmd = makeCommand({ id: "a", title: "Refresh All Data" });
    expect(scoreCommand(cmd, "refresh all data")).toBe(100);
  });

  it("50 untuk title startsWith query", () => {
    const cmd = makeCommand({ id: "a", title: "Go to Overview" });
    expect(scoreCommand(cmd, "go to")).toBe(50);
  });

  it("45 untuk keywords exact match", () => {
    const cmd = makeCommand({ id: "a", title: "X", keywords: ["home"] });
    expect(scoreCommand(cmd, "home")).toBe(45);
  });

  it("25 untuk title contains query", () => {
    const cmd = makeCommand({ id: "a", title: "Toggle Yield Curve Panel" });
    expect(scoreCommand(cmd, "yield")).toBe(25);
  });

  it("15 untuk description contains query", () => {
    const cmd = makeCommand({ id: "a", title: "X", description: "force refresh data" });
    expect(scoreCommand(cmd, "refresh")).toBe(15);
  });

  it("5 untuk fuzzy match (karakter berurutan)", () => {
    const cmd = makeCommand({ id: "a", title: "Go to Overview" });
    expect(scoreCommand(cmd, "gto")).toBe(5);
  });

  it("0 bila tidak ada yang cocok", () => {
    const cmd = makeCommand({ id: "a", title: "Refresh All Data" });
    expect(scoreCommand(cmd, "zzzz")).toBe(0);
  });

  it("0 untuk query kosong", () => {
    const cmd = makeCommand({ id: "a", title: "Refresh All Data" });
    expect(scoreCommand(cmd, "")).toBe(0);
    expect(scoreCommand(cmd, "   ")).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// filterCommands
// ─────────────────────────────────────────────────────────────────────────────

describe("filterCommands", () => {
  it("mengembalikan semua bila query kosong", () => {
    const cmds = [
      makeCommand({ id: "a", title: "Alpha" }),
      makeCommand({ id: "b", title: "Beta" }),
    ];
    expect(filterCommands(cmds, "")).toHaveLength(2);
    expect(filterCommands(cmds, "   ")).toHaveLength(2);
  });

  it("memfilter hanya yang cocok", () => {
    const cmds = [
      makeCommand({ id: "a", title: "Go to Overview" }),
      makeCommand({ id: "b", title: "Go to COT" }),
      makeCommand({ id: "c", title: "Refresh All Data" }),
    ];
    const out = filterCommands(cmds, "cot");
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("b");
  });

  it("mengurutkan berdasarkan skor (exact > contains)", () => {
    const cmds = [
      makeCommand({ id: "a", title: "Refresh Data" }),
      makeCommand({ id: "b", title: "Refresh All Data" }),
    ];
    const out = filterCommands(cmds, "refresh all data");
    expect(out[0].id).toBe("b"); // exact 100
  });

  it("mengembalikan array kosong bila tidak ada match", () => {
    const cmds = [makeCommand({ id: "a", title: "Alpha" })];
    expect(filterCommands(cmds, "zzzz")).toEqual([]);
  });

  it("memakai keywords untuk pencarian", () => {
    const cmds = [
      makeCommand({ id: "a", title: "Go to Overview", keywords: ["home"] }),
      makeCommand({ id: "b", title: "Go to COT" }),
    ];
    expect(filterCommands(cmds, "home")).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// groupCommands
// ─────────────────────────────────────────────────────────────────────────────

describe("groupCommands", () => {
  it("mengelompokkan per kategori dengan urutan navigation→instrument→widget→action", () => {
    const cmds = [
      makeCommand({ id: "1", type: "action", title: "A", category: "AKSI" }),
      makeCommand({ id: "2", type: "navigation", title: "B", category: "NAVIGASI" }),
      makeCommand({ id: "3", type: "instrument", title: "C", category: "INSTRUMEN" }),
      makeCommand({ id: "4", type: "widget", title: "D", category: "WIDGET" }),
    ];
    const groups = groupCommands(cmds);
    expect(groups.map((g) => g.category)).toEqual([
      "NAVIGASI",
      "INSTRUMEN",
      "WIDGET",
      "AKSI",
    ]);
  });

  it("tidak membuat grup kosong", () => {
    const cmds = [makeCommand({ id: "1", type: "action", title: "A", category: "AKSI" })];
    expect(groupCommands(cmds)).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// COMMAND_DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

describe("COMMAND_DEFINITIONS", () => {
  it("mengandung 5 perintah navigasi tab", () => {
    expect(COMMAND_DEFINITIONS.filter((c) => c.type === "navigation")).toHaveLength(5);
  });

  it("mengandung 8 perintah instrumen", () => {
    expect(COMMAND_DEFINITIONS.filter((c) => c.type === "instrument")).toHaveLength(8);
  });

  it("semua id unik", () => {
    const ids = COMMAND_DEFINITIONS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("semua punya icon & kategori", () => {
    for (const c of COMMAND_DEFINITIONS) {
      expect(c.icon).toBeDefined();
      expect(c.category).toBeTruthy();
    }
  });

  it("perintah navigasi punya shortcut ⌥1–⌥5", () => {
    const nav = COMMAND_DEFINITIONS.filter((c) => c.type === "navigation");
    expect(nav.map((c) => c.shortcut?.join(" "))).toEqual([
      "⌥ 1", "⌥ 2", "⌥ 3", "⌥ 4", "⌥ 5",
    ]);
  });
});
