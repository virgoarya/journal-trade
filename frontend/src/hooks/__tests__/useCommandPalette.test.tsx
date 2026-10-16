/**
 * Test CommandPaletteProvider — routing aksi perintah.
 *
 * Memverifikasi bahwa tiap tipe perintah memanggil handler yang benar:
 * navigation → router.push, instrument → onSelectInstrument,
 * widget → onToggleWidget, action → onRefreshAll.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import React from "react";
import { CommandPaletteProvider, useCommandPalette } from "../useCommandPalette";

// ─────────────────────────────────────────────────────────────────────────────
// MOCK: next/navigation
// ─────────────────────────────────────────────────────────────────────────────

const h = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: h.push, replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));

// ─────────────────────────────────────────────────────────────────────────────
// PROBE — menangkap nilai context agar bisa memanggil executeCommand
// ─────────────────────────────────────────────────────────────────────────────

let ctx: ReturnType<typeof useCommandPalette>;

function Probe() {
  ctx = useCommandPalette();
  return <div data-testid="is-open">{String(ctx.isOpen)}</div>;
}

function renderProvider(props: Partial<React.ComponentProps<typeof CommandPaletteProvider>> = {}) {
  return render(
    <CommandPaletteProvider {...props}>
      <Probe />
    </CommandPaletteProvider>
  );
}

/** Cari perintah berdasarkan id lalu jalankan. */
function run(id: string) {
  const cmd = ctx.commands.find((c) => c.id === id);
  expect(cmd, `perintah "${id}" tidak ditemukan di registry`).toBeDefined();
  act(() => {
    ctx.executeCommand(cmd!);
  });
}

beforeEach(() => {
  h.push.mockClear();
});

// ─────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("CommandPaletteProvider — routing aksi", () => {
  it("meneruskan simbol instrumen ke onSelectInstrument", () => {
    const onSelectInstrument = vi.fn();
    renderProvider({ onSelectInstrument });

    run("instrument-GC=F");

    expect(onSelectInstrument).toHaveBeenCalledTimes(1);
    expect(onSelectInstrument).toHaveBeenCalledWith("GC=F");
  });

  it("meneruskan simbol dengan karakter khusus apa adanya", () => {
    const onSelectInstrument = vi.fn();
    renderProvider({ onSelectInstrument });

    run("instrument-DX-Y.NYB");

    expect(onSelectInstrument).toHaveBeenCalledWith("DX-Y.NYB");
  });

  it("navigasi tab lewat router.push", () => {
    renderProvider();

    run("tab-quant-lab");

    expect(h.push).toHaveBeenCalledWith("/macro-terminal/quant-lab");
  });

  it("meneruskan widgetId ke onToggleWidget", () => {
    const onToggleWidget = vi.fn();
    renderProvider({ onToggleWidget });

    run("widget-toggle-heatmap");

    expect(onToggleWidget).toHaveBeenCalledWith("heatmap");
  });

  it("memanggil onRefreshAll untuk action-refresh", () => {
    const onRefreshAll = vi.fn();
    renderProvider({ onRefreshAll });

    run("action-refresh");

    expect(onRefreshAll).toHaveBeenCalledTimes(1);
  });

  it("memanggil onResetLayout untuk action-reset-layout", () => {
    const onResetLayout = vi.fn();
    renderProvider({ onResetLayout });

    run("action-reset-layout");

    expect(onResetLayout).toHaveBeenCalledTimes(1);
  });

  it("menutup palette setelah perintah dijalankan", () => {
    renderProvider();

    act(() => {
      ctx.open();
    });
    expect(ctx.isOpen).toBe(true);

    run("tab-overview");

    expect(ctx.isOpen).toBe(false);
  });

  it("tidak melempar bila handler instrumen tidak diberikan", () => {
    renderProvider();

    expect(() => run("instrument-^GSPC")).not.toThrow();
  });
});

describe("CommandPaletteProvider — keyboard & filter", () => {
  it("membuka palette dengan Ctrl+K dan menutupnya lagi", () => {
    renderProvider();
    expect(ctx.isOpen).toBe(false);

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
    });
    expect(ctx.isOpen).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
    });
    expect(ctx.isOpen).toBe(false);
  });

  it("membuka palette dengan Cmd+K (metaKey)", () => {
    renderProvider();

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "K", metaKey: true }));
    });

    expect(ctx.isOpen).toBe(true);
  });

  it("mengosongkan query saat ditutup", () => {
    renderProvider();

    act(() => {
      ctx.open();
      ctx.setQuery("gold");
    });
    expect(ctx.query).toBe("gold");

    act(() => {
      ctx.close();
    });
    expect(ctx.query).toBe("");
  });

  it("menyediakan hasil terfilter + bergrup", () => {
    renderProvider();

    act(() => {
      ctx.setQuery("gold");
    });

    expect(ctx.filteredCommands.length).toBeGreaterThan(0);
    expect(ctx.groupedCommands.length).toBeGreaterThan(0);
    // semua item di grup instrumen
    const instGroup = ctx.groupedCommands.find((g) => g.category === "INSTRUMEN");
    expect(instGroup?.items.some((c) => c.id === "instrument-GC=F")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SHORTCUT Alt+1..Alt+5
//
// MENGAPA TEST INI ADA: shortcut ini DITAMPILKAN di UI Command Palette
// (commands.ts) sejak awal, tetapi listener-nya tidak pernah didaftarkan —
// jadi UI mempromosikan shortcut yang tidak berfungsi. Test ini mengunci
// perilakunya supaya tidak kembali jadi label kosong.
// ─────────────────────────────────────────────────────────────────────────────

describe("CommandPaletteProvider — shortcut Alt+1..Alt+5", () => {
  /** Dispatch keydown lalu flush React. */
  function press(key: string, opts: KeyboardEventInit = {}) {
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key, altKey: true, ...opts }));
    });
  }

  it("Alt+1 membuka tab Overview", () => {
    renderProvider();
    press("1");
    expect(h.push).toHaveBeenCalledWith("/macro-terminal/overview");
  });

  it("Alt+3 membuka tab Quant Lab", () => {
    renderProvider();
    press("3");
    expect(h.push).toHaveBeenCalledWith("/macro-terminal/quant-lab");
  });

  it("Alt+5 membuka tab Intelligence", () => {
    renderProvider();
    press("5");
    expect(h.push).toHaveBeenCalledWith("/macro-terminal/intelligence");
  });

  it("memetakan seluruh 5 tab sesuai urutan", () => {
    const expected: Record<string, string> = {
      "1": "/macro-terminal/overview",
      "2": "/macro-terminal/cot",
      "3": "/macro-terminal/quant-lab",
      "4": "/macro-terminal/nexus",
      "5": "/macro-terminal/intelligence",
    };

    for (const [key, path] of Object.entries(expected)) {
      h.push.mockClear();
      const { unmount } = renderProvider();
      press(key);
      expect(h.push).toHaveBeenCalledWith(path);
      unmount();
    }
  });

  it("tidak menavigasi tanpa tombol Alt", () => {
    renderProvider();
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "3" }));
    });
    expect(h.push).not.toHaveBeenCalled();
  });

  it("tidak menavigasi untuk angka di luar 1..5", () => {
    renderProvider();
    press("9");
    press("0");
    expect(h.push).not.toHaveBeenCalled();
  });

  it("tidak menavigasi saat palette sedang terbuka", () => {
    renderProvider();

    act(() => {
      ctx.open();
    });
    expect(ctx.isOpen).toBe(true);

    press("3");
    expect(h.push).not.toHaveBeenCalled();
  });

  it("tidak mencuri fokus saat user sedang mengetik di input", () => {
    renderProvider();

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    act(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "3", altKey: true, bubbles: true }));
    });

    expect(h.push).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it("tidak mencuri fokus saat user mengetik di textarea", () => {
    renderProvider();

    const ta = document.createElement("textarea");
    document.body.appendChild(ta);
    ta.focus();

    act(() => {
      ta.dispatchEvent(new KeyboardEvent("keydown", { key: "2", altKey: true, bubbles: true }));
    });

    expect(h.push).not.toHaveBeenCalled();
    document.body.removeChild(ta);
  });
});
