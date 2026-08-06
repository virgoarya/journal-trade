import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { broadcast } from "./ws-server";
import { silentLogger } from "./utils/silent-logger";
import { env } from "./config/env";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";

const execFileAsync = promisify(execFile);
// ─── State ─────────────────────────────────────────────────────────────────
let cachedPositions: any[] = [];
let cachedAccountInfo: any = null;
let mcpClient: Client | null = null;
let pollTimer: NodeJS.Timeout | null = null;
let isConnected = false;
let reconnectTimer: NodeJS.Timeout | null = null;

const POLL_INTERVAL_MS = 1500;   // Poll every 1.5s
const RECONNECT_DELAY_MS = 5000; // Retry connection every 5s

// ─── Normalizers ────────────────────────────────────────────────────────────
function normalizeAccountInfo(raw: any): any {
   if (!raw) return null;
   // Native MCP sends account info nested under 'account' key
   const acct = raw.account || raw;
   const balance = Number(acct.balance ?? 0);
   const equity = Number(acct.equity ?? balance);
   const margin = Number(acct.margin ?? 0);
   const freeMargin = Number(acct.margin_free ?? acct.freeMargin ?? balance);
   const marginLevel = acct.margin_level ?? (margin > 0 ? (equity / margin) * 100 : 0);

   return {
     login: Number(acct.login ?? 0),
     server: String(acct.server ?? ""),
     broker: String(acct.broker ?? ""),
     name: String(acct.name ?? ""),
     currency: String(acct.currency ?? "USD"),
     balance,
     equity,
     margin,
     freeMargin,
     marginFree: freeMargin,
     marginLevel,
     leverage: Number(acct.leverage ?? 100),
     profit: Number(acct.profit ?? 0),
     type: String(acct.type ?? "demo"),
     read_only: Boolean(acct.read_only ?? false),
   };
 }

function normalizePosition(p: any): any {
   let timeVal = 0;
   const timeStr = p.create_time ?? p.update_time ?? p.time;
   if (typeof timeStr === "string") {
     // Native MCP: "2026.08.05 14:00:22"
     timeVal = Math.floor(new Date(timeStr.replace(/\./g, "-")).getTime() / 1000);
   } else if (typeof timeStr === "number") {
     timeVal = timeStr;
   }

   const pType = String(p.action ?? p.type ?? "").toLowerCase();
   const normalizedType = (pType === "buy" || pType === "0" || p.type === 0) ? "BUY" : "SELL";

   return {
     ticket: Number(p.position_id ?? p.ticket ?? p.id ?? 0),
     symbol: String(p.symbol ?? ""),
     type: normalizedType,
     volume: Number(p.volume ?? p.lots ?? 0),
     priceOpen: Number(p.price_open ?? p.priceOpen ?? p.open_price ?? 0),
     priceCurrent: Number(p.price_last ?? p.price_current ?? p.priceCurrent ?? p.price ?? 0),
     sl: Number(p.stop_loss ?? p.sl ?? 0),
     tp: Number(p.take_profit ?? p.tp ?? 0),
     profit: Number(p.profit ?? 0),
     swap: Number(p.swap ?? p.swaps ?? 0),
     commission: Number(p.commission ?? p.commissions ?? 0),
     comment: String(p.comment ?? ""),
     time: timeVal,
     magic: Number(p.magic ?? 0),
   };
 }

// ─── Public Cache API ───────────────────────────────────────────────────────
export const mt5StreamCache = {
  getPositions: () => cachedPositions,
  getAccountInfo: () => cachedAccountInfo,
  isConnected: () => isConnected,
};

// ─── MCP Tool Call Helper ───────────────────────────────────────────────────
async function callTool(name: string, args: Record<string, any> = {}): Promise<any> {
  if (!mcpClient) throw new Error("MT5 MCP client not initialized");
  const result = await mcpClient.callTool({ name, arguments: args });
  if (result?.content && Array.isArray(result.content)) {
    const text = result.content.find((c: any) => c.type === "text")?.text;
    if (text) {
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }
  }
  return result;
}

// ─── Public RPC Interface (Unified with native MT5 MCP tools) ────────────────
export const executeMt5Command = async (action: string, payload: any = {}): Promise<any> => {
  if (!isConnected || !mcpClient) {
    throw new Error("MT5 Streamer (Native MCP) is not connected.");
  }

  switch (action) {
    case "mt5_account_info":
    case "get_trading_account_info": {
      const res = await callTool("get_trading_account_info", {});
      const normalized = normalizeAccountInfo(res);
      if (normalized) cachedAccountInfo = normalized;
      return normalized;
    }

    case "mt5_positions_get":
    case "get_trading_open_positions": {
      const res = await callTool("get_trading_open_positions", payload.symbol ? { symbol: payload.symbol } : {});
      const rawPositions = Array.isArray(res) ? res : (res?.positions ?? []);
      const normalized = rawPositions.map(normalizePosition);
      cachedPositions = normalized;
      return { positions: normalized };
    }

    case "mt5_symbols_get":
    case "get_marketwatch_symbols": {
      const res = await callTool("get_marketwatch_symbols", {});
      const rawSymbols = Array.isArray(res) ? res : (res?.symbols ?? []);
      const filtered = payload.symbol
        ? rawSymbols.filter((s: any) => String(s.name ?? s.symbol ?? "").toLowerCase().includes(String(payload.symbol ?? "").toLowerCase()))
        : rawSymbols;
      const symbols = filtered.map((s: any) => ({
        name: s.name ?? s.symbol ?? "",
        description: s.description ?? "",
        bid: Number(s.bid ?? 0),
        ask: Number(s.ask ?? 0),
        spread: Number(s.spread ?? 0),
        point: Number(s.point ?? 0.00001),
        digits: Number(s.digits ?? 5),
        tradeContractSize: Number(s.trade_contract_size ?? s.contract_size ?? 100000),
        volumeMin: Number(s.volume_min ?? 0.01),
        volumeMax: Number(s.volume_max ?? 100),
        volumeStep: Number(s.volume_step ?? 0.01),
        visible: true,
      }));
      return { symbols };
    }

    case "mt5_symbol_info": {
      const res = await callTool("get_marketwatch_symbols", {}); // Call native MCP tool
      const rawSymbols = Array.isArray(res) ? res : (res?.symbols ?? []);
      const s = rawSymbols.find((item: any) => item.name?.toLowerCase() === payload.symbol?.toLowerCase() || item.symbol?.toLowerCase() === payload.symbol?.toLowerCase());
      if (!s) return null;
      return {
        name: s.name ?? s.symbol ?? "",
        description: s.description || "",
        bid: Number(s.bid ?? 0),
        ask: Number(s.ask ?? 0),
        spread: (Number(s.ask) > 0 && Number(s.bid) > 0 && Number(s.point ?? 0) > 0)
          ? Math.round((Number(s.ask) - Number(s.bid)) / Number(s.point))
          : (Number(s.spread) || 0),
        point: Number(s.point ?? 0.00001),
        digits: Number(s.digits ?? 5),
        tradeContractSize: Number(s.trade_contract_size ?? s.contract_size ?? 100000), // Ensure contract size is correct
        volumeMin: Number(s.volume_min ?? 0.01),
        volumeMax: Number(s.volume_max ?? 100),
        volumeStep: Number(s.volume_step ?? 0.01),
        visible: Boolean(s.selected ?? true),
      };
    }

    case "mt5_symbol_tick": {
      const res = await callTool("get_marketwatch_symbols", {}); // Use native MCP tool
      const rawSymbols = Array.isArray(res) ? res : (res?.symbols ?? []);
      const s = rawSymbols.find((item: any) => item.name?.toLowerCase() === payload.symbol?.toLowerCase() || item.symbol?.toLowerCase() === payload.symbol?.toLowerCase());
      if (!s) return null;
      return {
        bid: Number(s.bid ?? 0),
        ask: Number(s.ask ?? 0),
        spread: Number(s.ask - s.bid),
        time: Date.now(),
      };
    }

    case "mt5_order_send": {
      const actionType = String(payload.action ?? "BUY").toUpperCase();
      if (actionType === "BUY" || actionType === "SELL") {
        const orderArgs: any = {
          symbol: payload.symbol,
          type: actionType.toLowerCase(),
          volume: Number(payload.volume),
        };
        if (payload.sl) orderArgs.sl = Number(payload.sl);
        if (payload.tp) orderArgs.tp = Number(payload.tp);
        if (payload.comment) orderArgs.comment = String(payload.comment).slice(0, 31);

        const res = await callTool("trade_send_market_order", orderArgs);
        return {
          success: !res?.error && !res?.isError,
          ticket: res?.order ?? res?.ticket ?? res?.deal ?? 0,
          price: res?.price,
          volume: res?.volume ?? payload.volume,
          comment: res?.comment ?? payload.comment,
          error: res?.error || (res?.isError ? JSON.stringify(res) : undefined),
        };
      } else {
        const orderArgs: any = {
          symbol: payload.symbol,
          type: actionType.toLowerCase(),
          volume: Number(payload.volume),
          price: Number(payload.price),
        };
        if (payload.sl) orderArgs.sl = Number(payload.sl);
        if (payload.tp) orderArgs.tp = Number(payload.tp);
        if (payload.comment) orderArgs.comment = String(payload.comment).slice(0, 31);

        const res = await callTool("trade_send_pending_order", orderArgs);
        return {
          success: !res?.error && !res?.isError,
          ticket: res?.order ?? res?.ticket ?? res?.order_ticket ?? 0,
          price: res?.price ?? payload.price,
          volume: res?.volume ?? payload.volume,
          comment: res?.comment ?? payload.comment,
          error: res?.error || (res?.isError ? JSON.stringify(res) : undefined),
        };
      }
    }

    case "mt5_position_close": {
      let targetSymbol = payload.symbol;
      if (!targetSymbol) {
        const found = cachedPositions.find((p) => p.ticket === payload.ticket);
        if (found) targetSymbol = found.symbol;
      }
      // MT5 native tool: trade_close_single_position
      const res = await callTool("trade_close_single_position", {
        symbol: targetSymbol || "",
        position_ticket: Number(payload.ticket),
      });
      return {
        success: !res?.error && !res?.isError,
        ticket: payload.ticket,
        error: res?.error || (res?.isError ? JSON.stringify(res) : undefined),
      };
    }

    case "mt5_position_modify": {
      let targetSymbol = payload.symbol;
      if (!targetSymbol) {
        const found = cachedPositions.find((p) => p.ticket === payload.ticket);
        if (found) targetSymbol = found.symbol;
      }
      const modifyArgs: any = {
        symbol: targetSymbol || "EURUSD",
        position_ticket: Number(payload.ticket),
      };
      if (payload.sl !== undefined) modifyArgs.sl = Number(payload.sl);
      if (payload.tp !== undefined) modifyArgs.tp = Number(payload.tp);

      const res = await callTool("trade_modify_sl_tp", modifyArgs);
      return {
        success: !res?.error && !res?.isError,
        ticket: payload.ticket,
        error: res?.error || (res?.isError ? JSON.stringify(res) : undefined),
      };
    }

    case "mt5_connect": {
      const res = await callTool("get_trading_account_info", {});
      const normalized = normalizeAccountInfo(res);
      if (normalized) cachedAccountInfo = normalized;
      return { success: true, accountInfo: normalized };
    }

    case "mt5_disconnect": {
      return { success: true };
    }

    case "mt5_copy_rates": {
      try {
        const scriptPath = path.join(__dirname, "..", "fetch_rates.py");
        const { stdout } = await execFileAsync("python", [
          scriptPath,
          payload.symbol,
          payload.timeframe,
          "count",
          String(payload.count)
        ]);
        const result = JSON.parse(stdout);
        if (result.error) {
          throw new Error(result.error);
        }
        return { rates: result.rates };
      } catch (err: any) {
        silentLogger.error(`[MT5-Streamer] Python fetch_rates (count) failed: ${err.message}`);
        return { rates: [] };
      }
    }

    case "mt5_copy_rates_range": {
      try {
        const scriptPath = path.join(__dirname, "..", "fetch_rates.py");
        const { stdout } = await execFileAsync("python", [
          scriptPath,
          payload.symbol,
          payload.timeframe,
          "range", // we must pass a string that is not "count"
          String(payload.from),
          String(payload.to)
        ]);
        const result = JSON.parse(stdout);
        if (result.error) {
          throw new Error(result.error);
        }
        return { rates: result.rates };
      } catch (err: any) {
        silentLogger.error(`[MT5-Streamer] Python fetch_rates failed: ${err.message}`);
        return { rates: [] };
      }
    }

    default:
      return callTool(action, payload);
  }
};

// ─── Connection ─────────────────────────────────────────────────────────────
let activeMcpUrl: string = env.MT5_MCP_URL ?? "http://127.0.0.1:22346/mcp";
let activeApiKey: string = env.MT5_MCP_API_KEY ?? "";

export async function connectWithMcpConfig(config: { mcpUrl?: string; apiKey?: string }): Promise<{ success: boolean; accountInfo?: any; error?: string }> {
  if (config.mcpUrl) activeMcpUrl = config.mcpUrl;
  if (config.apiKey !== undefined) activeApiKey = config.apiKey;

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  stopPolling();
  
  if (mcpClient) {
    try {
      await mcpClient.close();
    } catch {
      // ignore
    }
    mcpClient = null;
  }
  isConnected = false;

  await connectToNativeMcp();

  if (isConnected) {
    try {
      const acct = await callTool("get_trading_account_info", {});
      cachedAccountInfo = normalizeAccountInfo(acct);
      return { success: true, accountInfo: cachedAccountInfo };
    } catch (err: any) {
      return { success: true, accountInfo: cachedAccountInfo };
    }
  }

  return { success: false, error: "Gagal terhubung ke MT5 MCP server. Pastikan MetaTrader 5 menyala dan Enable Internal Server aktif di Options -> MCP." };
}

export async function disconnectMcp(): Promise<void> {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  stopPolling();
  if (mcpClient) {
    try {
      await mcpClient.close();
    } catch {
      // ignore
    }
    mcpClient = null;
  }
  isConnected = false;
  cachedPositions = [];
  cachedAccountInfo = null;
  broadcast("mt5_status", { connected: false }, "mt5" as any);
}

async function connectToNativeMcp(): Promise<void> {
  const mcpUrl = activeMcpUrl;
  const apiKey = activeApiKey;

  silentLogger.info(`[MT5-MCP] Connecting to native MT5 MCP at ${mcpUrl} (Streamable HTTP)...`);

  try {
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    // MT5 built-in MCP uses the new 2025-06-18 Streamable HTTP protocol
    const transport = new StreamableHTTPClientTransport(new URL(mcpUrl), {
      requestInit: { headers },
    });

    const client = new Client(
      { name: "hunter-trades-backend", version: "1.0.0" },
      { capabilities: {} }
    );

    await client.connect(transport);
    mcpClient = client;
    isConnected = true;

    silentLogger.info("[MT5-MCP] ✅ Connected to native MT5 MCP server (Streamable HTTP).");
    broadcast("mt5_status", { connected: true, reconnecting: false }, "mt5" as any);

    // Initial fetch of account info
    try {
      const initialAcct = await callTool("mt5_account_info", {});
      cachedAccountInfo = normalizeAccountInfo(initialAcct);
    } catch {
      // ignore
    }

    // Start polling loop
    startPolling();

    // Handle disconnect
    transport.onclose = () => {
      silentLogger.warn("[MT5-MCP] Connection to native MT5 MCP closed.");
      handleDisconnect();
    };
    transport.onerror = (err: Error) => {
      silentLogger.warn(`[MT5-MCP] Transport error: ${err.message}`);
      handleDisconnect();
    };

  } catch (err: any) {
    silentLogger.warn(`[MT5-MCP] Failed to connect to native MT5 MCP: ${err.message}`);
    scheduleReconnect();
  }
}

function handleDisconnect() {
  if (!isConnected) return;
  isConnected = false;
  mcpClient = null;
  stopPolling();
  broadcast("mt5_status", { connected: false }, "mt5" as any);
  scheduleReconnect();
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  silentLogger.info(`[MT5-MCP] Scheduling reconnect in ${RECONNECT_DELAY_MS}ms...`);
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    await connectToNativeMcp();
  }, RECONNECT_DELAY_MS);
}

// ─── Polling ────────────────────────────────────────────────────────────────
function startPolling() {
  stopPolling();
  pollTimer = setInterval(async () => {
    if (!isConnected || !mcpClient) return;
    try {
      const [posResult, acctResult] = await Promise.allSettled([
        callTool("get_trading_open_positions"),
        callTool("get_trading_account_info"),
      ]);

      if (posResult.status === "fulfilled") {
        const raw = posResult.value;
        const rawPositions = Array.isArray(raw) ? raw : (raw?.positions ?? []);
        cachedPositions = rawPositions.map(normalizePosition);
      }
      if (acctResult.status === "fulfilled") {
        const raw = acctResult.value;
        cachedAccountInfo = normalizeAccountInfo(raw);
      }

      // Broadcast to all frontend clients
      broadcast("mt5_tick", {
        positions: cachedPositions,
        accountInfo: cachedAccountInfo,
      }, "mt5" as any);

    } catch (err: any) {
      silentLogger.warn(`[MT5-MCP] Poll error: ${err.message}`);
      if (err.message?.includes("not connected") || err.message?.includes("closed")) {
        handleDisconnect();
      }
    }
  }, POLL_INTERVAL_MS);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

// ─── Entry Point ─────────────────────────────────────────────────────────────
export function initMt5NativeMcp(): void {
  silentLogger.info("[MT5-MCP] Initializing native MT5 MCP streamer...");
  connectToNativeMcp();
}

export const handleMt5StreamConnection = (_socket: any) => {
  silentLogger.warn("[MT5-MCP] handleMt5StreamConnection called but Python bridge is deprecated. Using native MCP instead.");
};
