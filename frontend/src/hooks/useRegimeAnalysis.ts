"use client";

import { useState, useCallback } from "react";
import type { Asset } from "@/components/macro-terminal/MacroTerminalContext";

export function useRegimeAnalysis() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [reasoning, setReasoning] = useState<string | null>(null);

  const analyzeRegime = useCallback(
    async (params: {
      assets: Asset[];
      regime: string | null;
      liquidityStatus: string | null;
      sentiment: string;
      context: Record<string, unknown>;
    }) => {
      setIsAnalyzing(true);
      setReasoning(null);

      try {
        const response = await fetch("/api/v1/macro-ai/analyze-regime", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });

        const data = await response.json();

        if (data.success && data.reasoning) {
          setReasoning(data.reasoning.trim());
        } else {
          setReasoning(`Error API: ${data.error || 'Terjadi kesalahan'}. (Regime: ${params.regime})`);
        }
      } catch (error: any) {
        console.error("Regime Analysis Error:", error);
        setReasoning(
          `Error: ${error?.message || 'Unknown error'}. (Regime: ${params.regime})`
        );
      } finally {
        setIsAnalyzing(false);
      }
    },
    [],
  );

  const analyzeNexus = useCallback(
    async (params: {
      nodesData: Record<string, unknown>;
      context: Record<string, unknown>;
    }) => {
      setIsAnalyzing(true);
      setReasoning(null);

      try {
        const response = await fetch("/api/v1/macro-ai/analyze-nexus", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });

        const data = await response.json();

        if (data.success) {
          setReasoning(data.reasoning);
        } else {
          setReasoning("Gagal mendapatkan analisis: " + data.error);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setReasoning("Terjadi kesalahan saat memanggil AI: " + message);
      } finally {
        setIsAnalyzing(false);
      }
    },
    [],
  );

  return {
    isAnalyzing,
    reasoning,
    setReasoning,
    analyzeRegime,
    analyzeNexus,
  };
}