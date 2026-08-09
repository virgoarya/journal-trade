import { useEffect, useState } from "react";
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

// ─── Singleton WebSocket Manager ──────────────────────────────
const subscribers = new Set<{
  onTick?: (data: any) => void;
  onStatus?: (data: any) => void;
}>();
let reconnectTimeout: NodeJS.Timeout | null = null;
let isConnecting = false;
let wsRef: WebSocket | null = null;

function getWsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.hostname}:5000`;
}

function broadcastToSubscribers(message: any) {
  subscribers.forEach((sub) => {
    if (message.type === "mt5_tick" && sub.onTick) {
      sub.onTick(message.data);
    }
    if (message.type === "mt5_status" && sub.onStatus) {
      sub.onStatus(message.data);
    }
  });
}

function connect() {
  if (isConnecting || (wsRef && wsRef.readyState === WebSocket.OPEN)) return;
  
  isConnecting = true;
  const wsUrl = getWsUrl();
  
  const ws = new WebSocket(wsUrl);
  wsRef = ws;

  ws.onopen = () => {
    isConnecting = false;
    broadcastToSubscribers({ type: "mt5_status", data: { connected: true } });
    console.log("[MT5 Stream] Connected to backend WS server.");
  };

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      broadcastToSubscribers(message);
    } catch (e) {
      console.error("[MT5 Stream] Parse error:", e);
    }
  };

  ws.onclose = () => {
    console.log("[MT5 Stream] Disconnected. Reconnecting...");
    wsRef = null;
    broadcastToSubscribers({ type: "mt5_status", data: { connected: false } });
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    reconnectTimeout = setTimeout(connect, 3000);
  };

  ws.onerror = (err) => {
    console.error("[MT5 Stream] WebSocket error:", err);
    ws.close();
  };
}

function subscribe(callbacks: { onTick?: (data: any) => void; onStatus?: (data: any) => void }) {
  subscribers.add(callbacks);
  
  // If this is the first subscriber, connect
  if (subscribers.size === 1) {
    connect();
  }
  
  // Return unsubscribe function
  return () => {
    subscribers.delete(callbacks);
    if (subscribers.size === 0) {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (wsRef) {
        wsRef.close();
        wsRef = null;
      }
    }
  };
}

function cleanup() {
  if (reconnectTimeout) clearTimeout(reconnectTimeout);
  if (wsRef) {
    wsRef.close();
    wsRef = null;
  }
  subscribers.clear();
}

// ─── Hook ─────────────────────────────────────────────────────
export function useMT5Stream(
  onTick?: (data: MT5TickPayload) => void,
  onStatus?: (data: MT5StatusPayload) => void,
) {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const unsub = subscribe({
      onTick: (data) => {
        onTick?.(data);
      },
      onStatus: (data) => {
        setIsConnected(data.connected);
        onStatus?.(data);
      },
    });

    return () => {
      unsub();
    };
  }, [onTick, onStatus]);

  return { isConnected };
}

export { cleanup as cleanupMt5Stream };
