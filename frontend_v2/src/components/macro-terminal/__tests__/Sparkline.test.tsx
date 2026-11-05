import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Sparkline } from "../Sparkline";

describe("Sparkline", () => {
  it("return div kosong bila data kurang dari 2 titik", () => {
    const { container } = render(<Sparkline data={[]} />);
    expect(container.querySelector("svg")).toBeNull();
    expect(container.querySelector("div")).not.toBeNull();
  });

  it("return svg dengan polyline bila data cukup", () => {
    const { container } = render(<Sparkline data={[10, 20, 15, 25, 30]} />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    const polyline = container.querySelector("polyline");
    expect(polyline).not.toBeNull();
  });

  it("warna hijau saat harga naik", () => {
    const { container } = render(<Sparkline data={[10, 20]} />);
    const polyline = container.querySelector("polyline");
    expect(polyline?.getAttribute("stroke")).toContain("data-profit");
  });

  it("warna merah saat harga turun", () => {
    const { container } = render(<Sparkline data={[20, 10]} />);
    const polyline = container.querySelector("polyline");
    expect(polyline?.getAttribute("stroke")).toContain("data-loss");
  });

  it("pakai warna custom bila diberikan", () => {
    const { container } = render(<Sparkline data={[10, 20]} color="#FF00FF" />);
    const polyline = container.querySelector("polyline");
    expect(polyline?.getAttribute("stroke")).toBe("#FF00FF");
  });

  it("handle data dengan nilai sama (range = 0)", () => {
    const { container } = render(<Sparkline data={[5, 5, 5, 5]} />);
    const polyline = container.querySelector("polyline");
    expect(polyline).not.toBeNull();
  });

  it("render dimensi custom", () => {
    const { container } = render(<Sparkline data={[1, 2, 3]} width={120} height={30} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("120");
    expect(svg?.getAttribute("height")).toBe("30");
  });
});
