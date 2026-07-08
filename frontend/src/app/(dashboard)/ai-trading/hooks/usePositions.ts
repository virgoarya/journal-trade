"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  aiTradingService,
  type Position,
  type OrderResult,
} from "@/services/ai-trading.service";
import { toast } from "sonner";

export function usePositions(pollInterval = 10000, isConnected?: boolean) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchPositions = useCallback(async () => {
    if (isConnected === false) return;
    try {
      const result = await aiTradingService.getPositions();
      if (result.success && result.data) {
        setPositions(result.data.positions);
        setTotal(result.data.total);
        setFetchError(null);
      } else {
        setFetchError(result.error || "Failed to fetch positions");
      }
    } catch (e: any) {
      if (e.message !== "Request was aborted") {
        setFetchError(e.message || "Network error");
      }
    } finally {
      setIsLoading(false);
    }
  }, [isConnected]);

  useEffect(() => {
    if (isConnected === false) return;
    setIsLoading(true);
    setFetchError(null);
    fetchPositions();
    intervalRef.current = setInterval(fetchPositions, pollInterval);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchPositions, pollInterval, isConnected]);

  const closePosition = useCallback(
    async (ticket: number) => {
      try {
        const result = await aiTradingService.closeOrder(ticket);
        if (result.success) {
          toast.success(`Position ${ticket} closed`);
          fetchPositions();
        } else {
          toast.error(result.error || "Failed to close position");
        }
      } catch (e: any) {
        toast.error(e.message || "Close failed");
      }
    },
    [fetchPositions],
  );

  const modifyPosition = useCallback(
    async (ticket: number, sl?: number, tp?: number) => {
      try {
        const result = await aiTradingService.modifyOrder(ticket, sl, tp);
        if (result.success) {
          toast.success(`Position ${ticket} modified`);
          fetchPositions();
        } else {
          toast.error(result.error || "Failed to modify position");
        }
      } catch (e: any) {
        toast.error(e.message || "Modify failed");
      }
    },
    [fetchPositions],
  );

  return {
    positions,
    total,
    isLoading,
    fetchError,
    refetch: fetchPositions,
    closePosition,
    modifyPosition,
  };
}
