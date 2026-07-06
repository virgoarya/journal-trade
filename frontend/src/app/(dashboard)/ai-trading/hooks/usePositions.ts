"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  aiTradingService,
  type Position,
  type OrderResult,
} from "@/services/ai-trading.service";
import { toast } from "sonner";

export function usePositions(pollInterval = 10000) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchPositions = useCallback(async () => {
    try {
      const result = await aiTradingService.getPositions();
      if (result.success && result.data) {
        setPositions(result.data.positions);
        setTotal(result.data.total);
      }
    } catch {
      // silently fail on poll
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPositions();
    intervalRef.current = setInterval(fetchPositions, pollInterval);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchPositions, pollInterval]);

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
    refetch: fetchPositions,
    closePosition,
    modifyPosition,
  };
}
