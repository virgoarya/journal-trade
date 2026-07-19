"use client";

import { useState, useCallback, useEffect } from "react";
import { aiTradingService } from "@/services/ai-trading.service";
import { toast } from "sonner";

interface MT5Credentials {
  server: string;
  login: string;
  password: string;
}

export function useMT5Connection() {
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async (credentials: MT5Credentials) => {
    setIsConnecting(true);
    setError(null);
    try {
      const result = await aiTradingService.connect(credentials);
      if (result.success && result.data?.connected) {
        setIsConnected(true);
        toast.success("Connected to MT5 successfully");
        return true;
      } else {
        const msg = result.error || "Failed to connect";
        setError(msg);
        toast.error(msg);
        return false;
      }
    } catch (e: any) {
      const msg = e.message || "Connection failed";
      setError(msg);
      toast.error(msg);
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await aiTradingService.disconnect();
      setIsConnected(false);
      setIsReconnecting(false);
      toast.success("Disconnected from MT5");
    } catch (e: any) {
      toast.error(e.message || "Disconnect failed");
    }
  }, []);

  // ── Check existing session on mount ───────────────────────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await aiTradingService.getStatus();
        if (mounted && res.success && res.data?.connected) {
          setIsConnected(true);
        }
      } catch {
        // Silently ignore — user will see connection panel
      } finally {
        if (mounted) {
          setIsCheckingSession(false);
        }
      }
    })();
    return () => { mounted = false; };
  }, []);

  // ── Poll session status periodically ──────────────────────────────────
  useEffect(() => {
    if (!isConnected) return;
    let mounted = true;
    
    const interval = setInterval(async () => {
      try {
        const res = await aiTradingService.getStatus();
        if (mounted && res.success) {
          if (!res.data?.connected) {
            setIsReconnecting(true);
          } else {
            setIsReconnecting(false);
          }
        }
      } catch (err) {
        if (mounted) setIsReconnecting(true);
      }
    }, 5000); // Check every 5 seconds

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [isConnected]);

  return { isConnected, isReconnecting, isConnecting, isCheckingSession, error, connect, disconnect };
}
