"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { aiTradingService, type ACCOUNTInfo } from "@/services/ai-trading.service";
import { useMT5Stream } from "./useMT5Stream";

export function useAccountInfo(isConnected: boolean, pollInterval = 30000) {
  const [accountInfo, setAccountInfo] = useState<ACCOUNTInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchInfo = useCallback(async (): Promise<boolean> => {
    try {
      const result = await aiTradingService.getAccountInfo();
      if (result.success && result.data) {
        setAccountInfo(result.data);
        setError(null);
        return true;
      }
      return false;
    } catch (e: any) {
      setError(e.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useMT5Stream((data) => {
    if (data.accountInfo) {
      setAccountInfo(prev => ({ ...prev, ...data.accountInfo }));
    }
  });

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const tick = async () => {
      if (!isConnected) {
        timeoutId = setTimeout(tick, 5000);
        return;
      }

      const isSuccess = await fetchInfo();
      if (isMounted) {
        timeoutId = setTimeout(tick, pollInterval);
      }
    };

    setIsLoading(true);
    setError(null);
    tick();

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [fetchInfo, pollInterval, isConnected]);

  const refetch = useCallback(() => {
    setIsLoading(true);
    fetchInfo();
  }, [fetchInfo]);

  return { accountInfo, isLoading, error, refetch };
}
