"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { aiTradingService, type ACCOUNTInfo } from "@/services/ai-trading.service";
import { useMT5Connection } from "./useMT5Connection";

export function useAccountInfo(pollInterval = 30000) {
  const [accountInfo, setAccountInfo] = useState<ACCOUNTInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const { isConnected } = useMT5Connection();

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
        timeoutId = setTimeout(tick, isSuccess ? pollInterval : 10000);
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
