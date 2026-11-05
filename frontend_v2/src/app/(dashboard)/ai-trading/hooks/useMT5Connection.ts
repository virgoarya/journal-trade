"use client";

import { useState, useCallback, useEffect } from "react";
import { aiTradingService } from "@/services/ai-trading.service";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

export interface MT5Credentials {
  apiKey?: string;
  mcpUrl?: string;
  server?: string;
  login?: string;
  password?: string;
  tunnelUrl?: string;
}

export type MT5ConnectionStatus = "connected" | "reconnecting" | "trading_disabled";

export function useMT5Connection() {
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<MT5ConnectionStatus>("reconnecting");

  const connect = useCallback(async (credentials: MT5Credentials) => {
    setIsConnecting(true);
    setError(null);
    setConnectionStatus("reconnecting");
    try {
      const result = await aiTradingService.connect(credentials);
      if (result.success && result.data?.connected) {
        setIsConnected(true);
        setConnectionStatus("connected");
        toast.success("Connected to MT5 successfully");
        return true;
      } else {
        const msg = result.error || "Failed to connect";
        setError(msg);
        setConnectionStatus("reconnecting");
        toast.error(msg);
        return false;
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Connection failed";
      setError(msg);
      setConnectionStatus("reconnecting");
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
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Disconnect failed");
    }
  }, []);

  // ── Single source of truth for a /status payload ──────────────────────
  // Both the mount check and the interval poll funnel through here so the
  // three connection states are derived identically.
  const applyStatus = useCallback(
    (data: { connected?: boolean; reconnecting?: boolean; pipeline?: { lastError?: string | null } | null } | null | undefined) => {
      const connected = Boolean(data?.connected);
      const reconnecting = Boolean(data?.reconnecting);

      // `reconnecting` still means a session exists — MT5 is being brought back
      // in the background. Treating it as "not connected" would drop the user to
      // the connect panel mid-reconnect, so the reconnect overlay owns that case.
      setIsConnected(connected || reconnecting);
      setIsReconnecting(reconnecting);

      if (!connected) {
        setConnectionStatus("reconnecting");
        return;
      }

      // Broker up, but rejecting orders → Algo Trading disabled in MT5
      const lastError = data?.pipeline?.lastError ?? null;
      setConnectionStatus(
        lastError?.toLowerCase().includes("trading not permitted")
          ? "trading_disabled"
          : "connected",
      );
    },
    [],
  );

  // ── Check existing session on mount ───────────────────────────────────
  // Shares `applyStatus` with the poll below so the two can never disagree:
  // previously the mount check ignored `connectionStatus`, which hid the
  // "broker rejects orders" banner for the first poll interval after load.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await aiTradingService.getStatus();
        if (!mounted || !res.success) return;
        applyStatus(res.data);
        // Auto open MT5 Desktop if reconnecting in dev mode
        if (res.data?.reconnecting && process.env.NODE_ENV === "development") {
          apiClient.get("/api/v1/mt5/open-desktop").catch(() => {});
        }
      } catch {
        // Silently ignore — user will see connection panel
        if (mounted) setIsReconnecting(true);
      } finally {
        if (mounted) {
          setIsCheckingSession(false);
        }
      }
    })();
    return () => { mounted = false; };
  }, [applyStatus]);

  // ── Poll session status periodically ──────────────────────────────────
  // Poll even while disconnected: MT5 can come back on its own, and the UI
  // must notice without the user reloading the app. Cadence backs off while
  // offline to keep the poll cheap; it snaps back to 5s once reconnected.
  useEffect(() => {
    let mounted = true;

    const poll = async () => {
      try {
        const res = await aiTradingService.getStatus();
        if (!mounted || !res.success) return;
        applyStatus(res.data);
      } catch {
        // A failed /status call is a network blip, not proof the MT5 session is
        // gone — leave isConnected alone so the user is not ejected to the
        // connect panel; the next successful poll settles the real state.
        if (mounted) {
          setIsReconnecting(true);
          setConnectionStatus("reconnecting");
        }
      }
    };

    const interval = setInterval(poll, isConnected ? 5000 : 15000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [isConnected, applyStatus]);

  return { isConnected, isReconnecting, isConnecting, isCheckingSession, error, connect, disconnect, connectionStatus };
}
