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
let attempt = 0;

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
    attempt = 0;
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

  ws.onclose = (event) => {
    const code = event.code ?? "?";
    const reason = event.reason ?? "";
    console.log(
      `[MT5 Stream] Disconnected (code=${code}${reason ? `, reason=${reason}` : ""}). Reconnecting...`,
    );
    isConnecting = false;
    wsRef = null;
    broadcastToSubscribers({ type: "mt5_status", data: { connected: false } });
    scheduleReconnect();
  };

  ws.onerror = (err) => {
    isConnecting = false;
    // Browser always fires onerror right before onclose. When CLOSED, onclose
    // already carries the real code/reason (4011 auth, 4003 origin) — so skip
    // this generic "error" noise. Only log when not yet closed (genuine mid-flight error).
    if (ws.readyState === WebSocket.CLOSED) {
      try { ws.close(); } catch { /* already closed */ }
      scheduleReconnect();
      return;
    }
    const detail = (err as ErrorEvent | undefined)?.message ?? (err as Event | undefined)?.type ?? "no detail";
    console.warn(
      `[MT5 Stream] WebSocket error (attempt=${attempt}, url=${wsUrl}, readyState=${ws.readyState}): ${detail}`,
    );
    try { ws.close(); } catch { /* already closed */ }
    scheduleReconnect();
  };
}

function scheduleReconnect() {
  if (reconnectTimeout) clearTimeout(reconnectTimeout);
  attempt += 1;
  // Exponential backoff: 3s, 4.5s, ~7s, ~10s ... capped at 30s
  const delay = Math.min(3000 * Math.pow(1.5, attempt - 1), 30000);
  reconnectTimeout = setTimeout(connect, delay);
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
