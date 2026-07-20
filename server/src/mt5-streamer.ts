import { WebSocket } from "ws";
import { broadcast } from "./ws-server";
import { silentLogger } from "./utils/silent-logger";

let cachedPositions: any[] = [];
let cachedAccountInfo: any = null;

export const mt5StreamCache = {
  getPositions: () => cachedPositions,
  getAccountInfo: () => cachedAccountInfo,
};

export const handleMt5StreamConnection = (socket: WebSocket) => {
  silentLogger.info("[MT5-WS] Python MT5 Streamer connected.");

  socket.on("message", (data) => {
    try {
      const payload = JSON.parse(data.toString());
      if (payload.type === "mt5_tick") {
        const { positions, accountInfo } = payload.data;
        if (positions) cachedPositions = positions;
        if (accountInfo) cachedAccountInfo = accountInfo;

        // Broadcast to all frontend clients subscribed to "mt5" channel
        // Cast "mt5" to any since MacroChannel type might not include it yet
        broadcast("mt5_tick", { positions: cachedPositions, accountInfo: cachedAccountInfo }, "mt5" as any);
      }
    } catch (e) {
      silentLogger.error("[MT5-WS] Error parsing stream payload:", e);
    }
  });

  socket.on("close", () => {
    silentLogger.warn("[MT5-WS] Python MT5 Streamer disconnected.");
    // We keep the cache so the UI doesn't crash, but maybe flag it as disconnected
    broadcast("mt5_status", { connected: false }, "mt5" as any);
  });
};
