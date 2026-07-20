"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  aiTradingService,
  type Position,
} from "@/services/ai-trading.service";
import { toast } from "sonner";

export function usePositions(isConnected: boolean, pollInterval = 10000) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchPositions = useCallback(async (): Promise<boolean> => {
    try {
      const result = await aiTradingService.getPositions();
      if (result.success && result.data) {
        setPositions(result.data.positions || []);
        setOrders(result.data.orders || []);
        setTotal(result.data.total || 0);
        setFetchError(null);
        return true;
      } else {
        if (!result.error?.includes("aborted")) {
          setFetchError(result.error || "Failed to fetch positions");
        }
        return false;
      }
    } catch (e: any) {
      if (e.message !== "Request was aborted") {
        setFetchError(e.message || "Network error");
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const tick = async () => {
      if (!isConnected) {
        timeoutId = setTimeout(tick, 5000);
        return;
      }

      const isSuccess = await fetchPositions();
      if (isMounted) {
        timeoutId = setTimeout(tick, isSuccess ? pollInterval : 10000);
      }
    };

    setIsLoading(true);
    setFetchError(null);
    tick();

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
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

  const refetch = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setFetchError(null);
    await fetchPositions();
  }, [fetchPositions]);

  return {
    positions,
    orders,
    total,
    isLoading,
    fetchError,
    refetch,
    closePosition,
    modifyPosition,
  };
}
