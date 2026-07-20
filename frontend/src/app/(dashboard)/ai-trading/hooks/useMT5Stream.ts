"use client";

import { useEffect, useRef, useState } from "react";
import type { Position } from "@/services/ai-trading.service";

interface MT5TickPayload {
  positions: Position[];
  accountInfo: any;
}

interface MT5StatusPayload {
  connected: boolean;
}

interface WebSocketMessage {
  type: "mt5_tick" | "mt5_status";
  data: MT5TickPayload | MT5StatusPayload;
}

export function useMT5Stream(
  onTick?: (data: MT5TickPayload) => void,
  onStatus?: (data: MT5StatusPayload) => void,
) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimeout: NodeJS.Timeout;

    const connect = () => {
      // Determine backend WS URL
      const host = window.location.host;
      const isLocal = host.includes("localhost");
      
      // We connect directly to Railway WS backend in production
      const wsUrl = isLocal 
        ? "ws://localhost:5000" // Backend port is 5000 in dev
        : "wss://journal-trade-production.up.railway.app";
        
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        console.log("[MT5 Stream] Connected to Railway backend.");
        // Subscribe to MT5 channel? Wait, in ws-server.ts, we need to send a subscribe message?
        // Let's just listen. If we need to authenticate or subscribe, we can do it here.
        // But ws-server.ts in backend doesn't require explicit subscribe if we just broadcast to "mt5".
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          if (message.type === "mt5_tick" && onTick) {
            onTick(message.data as MT5TickPayload);
          }
          if (message.type === "mt5_status" && onStatus) {
            onStatus(message.data as MT5StatusPayload);
          }
        } catch (e) {
          console.error("[MT5 Stream] Parse error:", e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        console.log("[MT5 Stream] Disconnected. Reconnecting...");
        reconnectTimeout = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []); // Remove dependencies to avoid reconnects on function change unless memoized

  return { isConnected };
}
