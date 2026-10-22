import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import type { Strategy } from "@/services/playbook.service";

/**
 * TC-A11Y-01 regression — tombol close di halaman Playbook.
 *
 * Sebelum fix, accessibility tree membaca `Button "✕"` — simbol saja,
 * tidak informatif untuk screen reader. Ketiga tombol close wajib punya
 * accessible name yang deskriptif.
 *
 * Assertion memakai role/name queries dari Testing Library (yang menghitung
 * accessible name sendiri), jadi TIDAK ada dependency baru.
 *
 * Bukti RED (sebelum fix):
 *   Unable to find role="button" and name "Close strategy form"
 *   Name "✕"
 * Setelah fix: hijau.
 */

const STRATEGY: Strategy = {
  id: "s1",
  userId: "u1",
  name: "London Breakout",
  description: "Breakout di sesi London",
  methodology: "ICT",
  timeframe: "H1",
  markets: ["XAUUSD"],
  rules: ["Wait for LTF confirmation"],
  tags: ["breakout"],
  isArchived: false,
  stats: { totalTrades: 0, wins: 0, losses: 0, totalPnL: 0, avgRr: 0, winRate: 0 },
  entryChecklist: [],
  createdAt: "2026-10-22",
  updatedAt: "2026-10-22",
};

const getAll = vi.fn();

vi.mock("@/services/playbook.service", () => ({
  playbookService: {
    getAll: (...args: unknown[]) => getAll(...args),
    delete: vi.fn(),
    duplicate: vi.fn(),
  },
}));

import PlaybookPage from "../page";

describe("PlaybookPage — aksesibilitas tombol close", () => {
  beforeEach(() => {
    cleanup();
    getAll.mockReset();
  });

  it("tombol close form create terbaca 'Close strategy form'", async () => {
    getAll.mockResolvedValue({ success: true, data: [] });
    render(<PlaybookPage />);

    fireEvent.click(await screen.findByRole("button", { name: "New Strategy" }));

    const closeBtn = await screen.findByRole("button", { name: "Close strategy form" });
    expect(closeBtn).toBeInTheDocument();
    // Konten visual tetap simbol, tapi accessible name-nya deskriptif.
    expect(closeBtn.textContent?.trim()).toBe("✕");
    expect(closeBtn.getAttribute("aria-label")).toBe("Close strategy form");
  });

  it("tombol close modal detail terbaca 'Close strategy details'", async () => {
    getAll.mockResolvedValue({ success: true, data: [STRATEGY] });
    render(<PlaybookPage />);

    // Kartu tidak membuka modal saat diklik (onClick hanya untuk mode selectable),
    // jadi modal detail dibuka lewat tombol View di kartu.
    fireEvent.click(await screen.findByRole("button", { name: "View" }));

    const closeBtn = await screen.findByRole("button", { name: "Close strategy details" });
    expect(closeBtn.getAttribute("aria-label")).toBe("Close strategy details");
  });

  it("tombol close form edit terbaca 'Close edit strategy form'", async () => {
    getAll.mockResolvedValue({ success: true, data: [STRATEGY] });
    render(<PlaybookPage />);

    // Buka detail dulu, lalu pindah ke modal edit (Edit Strategy).
    fireEvent.click(await screen.findByRole("button", { name: "View" }));
    fireEvent.click(await screen.findByRole("button", { name: "Edit Strategy" }));

    const closeBtn = await screen.findByRole("button", { name: "Close edit strategy form" });
    expect(closeBtn.getAttribute("aria-label")).toBe("Close edit strategy form");
  });

  it("tidak ada tombol yang accessible name-nya simbol mentah", async () => {
    getAll.mockResolvedValue({ success: true, data: [STRATEGY] });
    render(<PlaybookPage />);

    // Buka ketiga modal agar semua tombol close ikut ter-render.
    fireEvent.click(await screen.findByRole("button", { name: "New Strategy" }));
    await screen.findByRole("button", { name: "Close strategy form" });
    fireEvent.click(screen.getByRole("button", { name: "Close strategy form" }));

    fireEvent.click(await screen.findByRole("button", { name: "View" }));
    await screen.findByRole("button", { name: "Close strategy details" });
    fireEvent.click(screen.getByRole("button", { name: "Edit Strategy" }));
    await screen.findByRole("button", { name: "Close edit strategy form" });

    // Testing Library menghitung accessible name sendiri — cari tombol
    // yang namanya masih simbol mentah.
    const symbolOnly = screen.queryAllByRole("button", { name: /^[✕×✖]+$/ });
    expect(symbolOnly).toEqual([]);
  });

  it("tombol close form hilang dari DOM setelah diklik", async () => {
    getAll.mockResolvedValue({ success: true, data: [] });
    render(<PlaybookPage />);

    fireEvent.click(await screen.findByRole("button", { name: "New Strategy" }));
    fireEvent.click(await screen.findByRole("button", { name: "Close strategy form" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Close strategy form" })).not.toBeInTheDocument();
    });
  });
});
