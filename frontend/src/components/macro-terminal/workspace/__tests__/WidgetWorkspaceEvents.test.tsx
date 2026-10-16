/**
 * Test EVENT BRIDGE Command Palette -> Widget Workspace.
 *
 * MENGAPA TEST INI ADA:
 * Dulu 7 dari 21 perintah Command Palette (6x "Toggle Widget" + "Reset Layout")
 * NO-OP SENYAP, karena `onToggleWidget`/`onResetLayout` tidak pernah di-pass dari
 * layout.tsx ke CommandPaletteProvider — dan `?.()` membuat kegagalannya tidak
 * terlihat sama sekali. Bug itu LOLOS dari test suite lama karena test hanya
 * menguji handler "kalau diberikan", bukan apakah penyambungannya nyata.
 *
 * Test ini menguji RANTAI PENUH: event DOM yang dikirim layout -> didengar
 * WidgetWorkspaceProvider -> state widget benar-benar berubah.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import React from "react";
import { WidgetWorkspaceProvider, useWidgetWorkspace } from "../WidgetWorkspaceProvider";

// localStorage disediakan oleh src/setupTests.ts (dijalankan sebelum module ini
// di-import), karena Zustand persist membacanya saat module load.

// Menangkap nilai context dari dalam provider.
let ctx: ReturnType<typeof useWidgetWorkspace>;

function Probe() {
  ctx = useWidgetWorkspace();
  return <div data-testid="hidden">{ctx.layout.hidden.join(",")}</div>;
}

function renderProvider() {
  return render(
    <WidgetWorkspaceProvider tab="overview">
      <Probe />
    </WidgetWorkspaceProvider>
  );
}

/** Dispatch CustomEvent lalu flush React. */
function fire(name: string, detail?: unknown) {
  act(() => {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  });
}

beforeEach(() => {
  try {
    globalThis.localStorage?.clear();
  } catch {
    /* storage tidak tersedia — store di-reset lewat ctx.resetLayout() di tiap test */
  }
});

afterEach(() => {
  cleanup();
});

describe("Event bridge Command Palette -> Widget Workspace", () => {
  it("macro:toggle-widget menyembunyikan widget", () => {
    renderProvider();
    act(() => {
      ctx.resetLayout();
    });
    expect(ctx.isHidden("heatmap")).toBe(false);

    fire("macro:toggle-widget", { widgetId: "heatmap" });

    expect(ctx.isHidden("heatmap")).toBe(true);
  });

  it("macro:toggle-widget kedua kalinya menampilkan kembali widget (toggle)", () => {
    renderProvider();
    act(() => {
      ctx.resetLayout();
    });

    fire("macro:toggle-widget", { widgetId: "heatmap" });
    expect(ctx.isHidden("heatmap")).toBe(true);

    fire("macro:toggle-widget", { widgetId: "heatmap" });
    expect(ctx.isHidden("heatmap")).toBe(false);
  });

  it("hanya menyembunyikan widget yang disebut, bukan yang lain", () => {
    renderProvider();
    act(() => {
      ctx.resetLayout();
    });

    fire("macro:toggle-widget", { widgetId: "heatmap" });

    expect(ctx.isHidden("heatmap")).toBe(true);
    expect(ctx.isHidden("macro-regime")).toBe(false);
    expect(ctx.isHidden("news-feed")).toBe(false);
  });

  it("macro:reset-layout mengembalikan seluruh layout ke default", () => {
    renderProvider();
    act(() => {
      ctx.resetLayout();
    });

    fire("macro:toggle-widget", { widgetId: "heatmap" });
    fire("macro:toggle-widget", { widgetId: "macro-regime" });
    expect(ctx.isHidden("heatmap")).toBe(true);
    expect(ctx.isHidden("macro-regime")).toBe(true);

    fire("macro:reset-layout");

    expect(ctx.isHidden("heatmap")).toBe(false);
    expect(ctx.isHidden("macro-regime")).toBe(false);
  });

  it("berhenti merespons event setelah provider di-unmount (listener dibersihkan)", () => {
    const first = renderProvider();
    act(() => {
      ctx.resetLayout();
    });
    first.unmount();

    // Dispatch saat TIDAK ada provider ter-mount. Kalau cleanup gagal,
    // listener yatim akan menulis ke store dan bocor ke kunjungan berikutnya.
    window.dispatchEvent(
      new CustomEvent("macro:toggle-widget", { detail: { widgetId: "heatmap" } })
    );

    renderProvider();
    expect(ctx.isHidden("heatmap")).toBe(false);
  });

  it("tidak melempar saat event tidak membawa widgetId", () => {
    renderProvider();

    expect(() => {
      fire("macro:toggle-widget", {});
    }).not.toThrow();
  });
});
