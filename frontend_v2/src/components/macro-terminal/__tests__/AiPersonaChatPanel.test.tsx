import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AiPersonaChatPanel } from "../AiPersonaChatPanel";

vi.mock("../MacroTerminalContext", () => ({
  useMacroTerminal: () => ({
    currentRegime: "RISK_ON",
    assets: [],
    liquidity: { status: "AMPLE" },
    regimeData: null,
    vix: { value: 16.2, regime: "CALM" },
    yieldCurve: { inverted: false, curveRegime: "NORMAL" },
    geoRisk: { scores: {}, topDriver: "LOW" },
    nextEvent: null,
    isAnalyzing: false,
  }),
}));

describe("AiPersonaChatPanel composer", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url === "/api/v1/chat/profile") {
        return Promise.resolve({ ok: true, json: async () => ({ factsCount: 0 }) });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ reply: "Jawaban agent", toolsUsed: [], reasoning: "" }),
      });
    }));
  });

  it("Enter mengirim, Shift+Enter menambah baris baru", async () => {
    render(<AiPersonaChatPanel />);
    const composer = screen.getByPlaceholderText(/Tanya 🦅 Hawk/i);

    fireEvent.change(composer, { target: { value: "baris pertama" } });
    fireEvent.keyDown(composer, { key: "Enter", code: "Enter", shiftKey: true });
    expect((composer as HTMLTextAreaElement).value).toBe("baris pertama");
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1); // profile saja

    fireEvent.keyDown(composer, { key: "Enter", code: "Enter" });
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2));
    expect(screen.getByText("baris pertama")).toBeInTheDocument();
  });

  it("menyalin jawaban assistant dari tombol hover", async () => {
    render(<AiPersonaChatPanel />);
    const copyButton = screen.getByTitle("Salin jawaban");

    fireEvent.click(copyButton);
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining("HAWK QUANT DESK ONLINE")
      );
    });
    expect(screen.getByTitle("Tersalin")).toBeInTheDocument();
  });
});
