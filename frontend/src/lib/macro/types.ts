"use client";

import { useMacroTerminal } from "@/components/macro-terminal/MacroTerminalContext";

export interface QuoteApiResponse {
  success: boolean;
  data: {
    symbol: string;
    data: {
      dp?: number | null;
    };
  }[];
}

export interface NewsApiItem {
  id: number | string;
  datetime: number;
  headline: string;
  summary?: string;
}

export interface NewsApiResponse {
  success: boolean;
  data: NewsApiItem[];
}

export function useMacroTypedData() {
  const { assets, liquidity } = useMacroTerminal();

  return {
    assets,
    liquidity,
  };
}
