import { WebSocket } from "ws";
import { broadcast } from "./ws-server";
import { silentLogger } from "./utils/silent-logger";

let cachedPositions: any[] = [];
let cachedAccountInfo: any = null;
let activeMt5Socket: WebSocket | null = null;

// Store pending RPC requests
const pendingRequests = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void; timeout: NodeJS.Timeout }>();

export const mt5StreamCache = {
  getPositions: () => cachedPositions,
  getAccountInfo: () => cachedAccountInfo,
};

export const executeMt5Command = async (action: string, payload: any = {}): Promise<any> => {
  if (!activeMt5Socket || activeMt5Socket.readyState !== WebSocket.OPEN) {
    throw new Error("MT5 Streamer (Python .exe) is not connected to Railway.");
  }

  return new Promise((resolve, reject) => {
    const id = Math.random().toString(36).substring(2, 9);
    
    // Timeout after 30 seconds
    const timeout = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error(`MT5 RPC timeout for action: ${action}`));
    }, 30000);

    pendingRequests.set(id, { resolve, reject, timeout });

    const requestMessage = {
      type: "rpc_request",
      id,
      action,
      payload,
    };

    activeMt5Socket!.send(JSON.stringify(requestMessage), (err) => {
      if (err) {
        clearTimeout(timeout);
        pendingRequests.delete(id);
        reject(err);
      }
    });
  });
};

export const handleMt5StreamConnection = (socket: WebSocket) => {
  silentLogger.info("[MT5-WS] Python MT5 Streamer connected.");
  activeMt5Socket = socket;
  broadcast("mt5_status", { connected: true, reconnecting: false }, "mt5" as any);

  socket.on("message", (data) => {
    try {
      const payload = JSON.parse(data.toString());
      
      if (payload.type === "mt5_tick") {
        const { positions, accountInfo } = payload.data;
        if (positions) cachedPositions = positions;
        if (accountInfo) cachedAccountInfo = accountInfo;

        // Broadcast to all frontend clients subscribed to "mt5" channel
        broadcast("mt5_tick", { positions: cachedPositions, accountInfo: cachedAccountInfo }, "mt5" as any);
      } 
      else if (payload.type === "rpc_response") {
        const { id, result, error } = payload;
        const pending = pendingRequests.get(id);
        if (pending) {
          clearTimeout(pending.timeout);
          pendingRequests.delete(id);
          if (error) {
            pending.reject(new Error(error));
          } else {
            pending.resolve(result);
          }
        }
      }
    } catch (e) {
      silentLogger.error("[MT5-WS] Error parsing stream payload:", e);
    }
  });

  socket.on("close", () => {
    silentLogger.warn("[MT5-WS] Python MT5 Streamer disconnected.");
    if (activeMt5Socket === socket) {
      activeMt5Socket = null;
    }
    broadcast("mt5_status", { connected: false }, "mt5" as any);
    
    // Fail all pending requests
    for (const [id, req] of pendingRequests.entries()) {
      clearTimeout(req.timeout);
      req.reject(new Error("MT5 disconnected while waiting for RPC response"));
    }
    pendingRequests.clear();
  });
};
