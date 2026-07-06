"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { aiTradingService, type ACCOUNTInfo } from "@/services/ai-trading.service";

export function useAccountInfo(pollInterval = 10000) {
  const [accountInfo, setAccountInfo] = useState<ACCOUNTInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchInfo = useCallback(async () => {
    try {
      const result = await aiTradingService.getAccountInfo();
      if (result.success && result.data) {
        setAccountInfo(result.data);
        setError(null);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInfo();
    intervalRef.current = setInterval(fetchInfo, pollInterval);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchInfo, pollInterval]);

  const refetch = useCallback(() => {
    setIsLoading(true);
    fetchInfo();
  }, [fetchInfo]);

  return { accountInfo, isLoading, error, refetch };
}
