"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { LiquidityData } from "@/components/macro-terminal/MacroTerminalContext";

interface QuotePayload {
  symbol: string;
  data: { dp?: number };
}

interface VixPayload {
  value: number;
  source: "yahoo" | "fred";
}

interface WebSocketMessage {
  type: "quote_update" | "liquidity_update" | "vix_update";
  data: QuotePayload | LiquidityData | VixPayload;
}

export function useWebSocket(
  onQuoteUpdate: (data: QuotePayload) => void,
  onLiquidityUpdate: (data: LiquidityData) => void,
  onVixUpdate: (data: VixPayload) => void,
) {
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected" | "error">("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(false);
  const connectingRef = useRef(false);

  const WS_RECONNECT_MS = 3_000;
  const connectRef = useRef<() => void>(() => {});

  // Keep latest callbacks in a ref so connect() stays stable across re-renders
  const callbacksRef = useRef({ onQuoteUpdate, onLiquidityUpdate, onVixUpdate });
  useEffect(() => {
    callbacksRef.current = { onQuoteUpdate, onLiquidityUpdate, onVixUpdate };
  });

  const getWebSocketUrl = useCallback(() => {
    if (typeof window === "undefined") return "";
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    return `${protocol}://${window.location.host}`;
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current || connectingRef.current) return;

    try {
      connectingRef.current = true;
      setStatus("connecting");
      const ws = new WebSocket(getWebSocketUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        connectingRef.current = false;
        setStatus("connected");
        console.log("[Macro Terminal] WebSocket connected");
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          const { onQuoteUpdate, onLiquidityUpdate, onVixUpdate } = callbacksRef.current;

          if (message.type === "quote_update") {
            onQuoteUpdate(message.data as QuotePayload);
          }

          if (message.type === "liquidity_update") {
            onLiquidityUpdate(message.data as LiquidityData);
          }

          if (message.type === "vix_update") {
            onVixUpdate(message.data as { value: number; source: "yahoo" | "fred" });
          }
        } catch (error) {
          console.error("[Macro Terminal] WebSocket parse error:", error);
        }
      };

      ws.onclose = () => {
        connectingRef.current = false;
        setStatus("disconnected");
        if (mountedRef.current) {
          reconnectTimerRef.current = setTimeout(() => connectRef.current(), WS_RECONNECT_MS);
        }
      };

      ws.onerror = () => {
        connectingRef.current = false;
        setStatus("error");
        ws.close();
      };
    } catch (error) {
      connectingRef.current = false;
      console.error("[Macro Terminal] WebSocket connect error:", error);
      setStatus("error");
      if (mountedRef.current) {
        reconnectTimerRef.current = setTimeout(() => connectRef.current(), WS_RECONNECT_MS);
      }
    }
  }, [getWebSocketUrl]);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    mountedRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    connect();

    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [connect, disconnect]);

  return { status };
}