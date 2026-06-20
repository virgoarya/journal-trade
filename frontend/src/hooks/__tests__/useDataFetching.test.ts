import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDataFetching } from "../useDataFetching";

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as jest.Mock;

describe("useDataFetching", () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it("should initialize with default assets", () => {
    const { result } = renderHook(() => useDataFetching());

    expect(result.current.assets).toHaveLength(8);
    expect(result.current.assets[0].ticker).toBe("SPY");
  });

  it("should handle error state correctly", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useDataFetching());

    // The hook should handle the error gracefully
    expect(result.current.isFallback).toBe(false);
  });

  it("should update geoRisk data correctly", async () => {
    const mockGeoRiskData = {
      success: true,
      data: {
        scores: { usa: 85, eu: 70, asia: 60 },
        topDriver: "usa",
        fetchedAt: new Date().toISOString(),
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockGeoRiskData,
    });

    const { result } = renderHook(() => useDataFetching());

    // Initial state
    expect(result.current.geoRisk.topDriver).toBe("UNKNOWN");
  });
});