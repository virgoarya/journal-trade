import { WebSocket, WebSocketServer } from "ws";
import { IncomingMessage } from "http";
import { authInstance } from "./auth-context";
import { silentLogger } from "./utils/silent-logger";

// Extend WebSocket to store authentication state and subscriptions
export type MacroChannel = "market" | "vix" | "liquidity" | "quant" | "nexus" | "all";
export interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  channels: Set<MacroChannel>;
  isAuthenticated: boolean;
}

let wss: WebSocketServer | undefined;

export const setWebSocketServer = (server: WebSocketServer) => {
  wss = server;
};

export const getWebSocketServer = () => {
  if (!wss) {
    throw new Error("WebSocketServer not initialized");
  }
  return wss;
};

/**
 * Authenticates a WebSocket client using Better Auth session cookies.
 * This is called during the WebSocket handshake.
 */
export const authenticateWebSocket = async (
  req: IncomingMessage,
): Promise<{ userId: string; isAuthenticated: boolean }> => {
  try {
    if (!authInstance) {
      silentLogger.error("[WS Auth] Auth instance not initialized.");
      return { userId: "unauthenticated", isAuthenticated: false };
    }

    // Pass relevant headers (especially 'Cookie') to getSession
    const session = await authInstance.api.getSession({
      headers: { cookie: req.headers.cookie ?? "" },
    });

    if (session && session.session && session.user) {
      return { userId: session.user.id, isAuthenticated: true };
    }
    return { userId: "unauthenticated", isAuthenticated: false };
  } catch (error) {
    silentLogger.error("[WS Auth] Authentication error:", error);
    return { userId: "unauthenticated", isAuthenticated: false };
  }
};

export const getAuthenticatedClientCount = () => {
  if (!wss) return 0;
  let count = 0;
  wss.clients.forEach((client) => {
    const ws = client as AuthenticatedWebSocket;
    if (ws.isAuthenticated) {
      count++;
    }
  });
  return count;
};

export const getClientCount = () => {
  if (!wss) return 0;
  return wss.clients.size;
};

export const subscribeToChannel = (
  ws: AuthenticatedWebSocket,
  channel: MacroChannel,
) => {
  ws.channels.add(channel);
  ws.channels.add("all"); // Always add "all" to simplify broadcast logic
  silentLogger.info(
    `[WS] Client ${ws.userId} subscribed to ${channel}. Current channels: ${Array.from(ws.channels).join(",")}`,
  );
};

export const unsubscribeFromChannel = (
  ws: AuthenticatedWebSocket,
  channel: MacroChannel,
) => {
  ws.channels.delete(channel);
  if (ws.channels.size === 1 && ws.channels.has("all")) { // If only "all" remains, client is effectively unsubscribed
    ws.channels.delete("all");
  }
  silentLogger.info(
    `[WS] Client ${ws.userId} unsubscribed from ${channel}. Current channels: ${Array.from(ws.channels).join(",")}`,
  );
};

export const getActiveChannels = (): Set<MacroChannel> => {
  const activeChannels = new Set<MacroChannel>();
  if (!wss) return activeChannels;

  wss.clients.forEach((client) => {
    const ws = client as AuthenticatedWebSocket;
    if (ws.isAuthenticated) {
      ws.channels.forEach((channel) => activeChannels.add(channel));
    }
  });
  return activeChannels;
};

export const broadcast = (type: string, data: any, channel?: MacroChannel) => {
  if (wss) {
    wss.clients.forEach((client) => {
      const ws = client as AuthenticatedWebSocket;
      if (
        ws.readyState === WebSocket.OPEN &&
        ws.isAuthenticated &&
        (!channel || ws.channels.has(channel) || ws.channels.has("all"))
      ) {
        client.send(JSON.stringify({ type, data }));
      }
    });
  }
};
