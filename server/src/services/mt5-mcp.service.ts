import { silentLogger } from "../utils/silent-logger";
import path from "node:path";
import fs from "node:fs";
import { mt5StreamCache, executeMt5Command } from "../mt5-streamer";
import { execSync } from 'child_process';

// ─── Circuit Breaker ────────────────────────────────────────────────────
export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly timeoutMs: number;

  constructor(
    failureThreshold = 5,
    successThreshold = 2,
    timeoutMs = 30000
  ) {
    this.failureThreshold = failureThreshold;
    this.successThreshold = successThreshold;
    this.timeoutMs = timeoutMs;
  }

  getState(): CircuitState {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureTime >= this.timeoutMs) {
        this.state = "HALF_OPEN";
        this.successCount = 0;
      }
    }
    return this.state;
  }

  recordSuccess(): void {
    this.failureCount = 0;
    if (this.state === "HALF_OPEN") {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = "CLOSED";
      }
    }
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.state === "HALF_OPEN") {
      this.state = "OPEN";
      this.successCount = 0;
    } else if (this.failureCount >= this.failureThreshold) {
      this.state = "OPEN";
    }
  }

  canExecute(): boolean {
    return this.getState() !== "OPEN";
  }

  reset(): void {
    this.state = "CLOSED";
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
  }
}

// ─── Retry Helper ───────────────────────────────────────────────────────
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000,
  isRetryable: (error: Error) => boolean = () => true
): Promise<T> {
  let lastError: Error;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries && isRetryable(lastError)) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        silentLogger.warn(`[MT5-MCP] Retry ${attempt}/${maxRetries} after ${delay}ms: ${lastError.message}`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw lastError;
      }
    }
  }
  throw lastError!;
}

// ─── Structured Logging ─────────────────────────────────────────────────
export function logErrorStructured(
  method: string,
  error: any,
  context?: any,
  level: "error" | "warn" | "info" = "error"
): void {
  const errorMsg = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  // Supress verbose JSON logging for expected secondary drops while reconnecting
  if (errorMsg === "MT5 not connected") {
    return;
  }

  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    source: "MT5-MCP",
    method,
    message: errorMsg,
    context,
    stack,
  };

  const logLine = JSON.stringify(logEntry);

  if (level === "error") {
    silentLogger.error(logLine);
  } else if (level === "warn") {
    silentLogger.warn(logLine);
  } else {
    silentLogger.info(logLine);
  }

  // Also append to file
  try {
    const logDir = path.join(__dirname, "..", "..", "logs");
    const logFile = path.join(logDir, "mt5-errors.log");
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    fs.appendFileSync(logFile, logLine + "\n");
  } catch {
    // ignore file write errors
  }
}

// ─── Types ───────────────────────────────────────────────────────────

export interface MT5Config {
  server: string;
  login: string;
  password: string;
  tunnelUrl?: string;
}

export interface MT5AccountInfo {
  login: number;
  server: string;
  currency: string;
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  leverage: number;
  profit: number;
  name: string;
}

export interface MT5Position {
  ticket: number;
  symbol: string;
  type: "BUY" | "SELL";
  volume: number;
  priceOpen: number;
  priceCurrent: number;
  sl: number;
  tp: number;
  profit: number;
  swap: number;
  commission: number;
  comment: string;
  time: number;
  magic: number;
}

export interface MT5Symbol {
  name: string;
  description: string;
  bid: number;
  ask: number;
  spread: number;
  point: number;
  digits: number;
  tradeContractSize: number;
  volumeMin: number;
  volumeMax: number;
  volumeStep: number;
  visible: boolean;
}

export interface MT5Rate {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MT5Tick {
  bid: number;
  ask: number;
  spread: number;
  time: number;
}

export interface MT5OrderResult {
  success: boolean;
  ticket?: number;
  price?: number;
  volume?: number;
  comment?: string;
  error?: string;
}

export interface MT5Deal {
  ticket: number;
  order: number;
  symbol: string;
  type: "BUY" | "SELL";
  volume: number;
  price: number;
  profit: number;
  commission: number;
  swap: number;
  time: number;
  comment: string;
  position_id?: number;
  entry?: number;
}

// ─── Service ─────────────────────────────────────────────────────────

class MT5MCPService {
  private connected = false;
  private accountInfo: MT5AccountInfo | null = null;
  private _circuitBreaker: CircuitBreaker;

  private currentTunnelUrl?: string;
  private keepAliveTimer: NodeJS.Timeout | null = null;
  private lastConfig?: MT5Config;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isReconnecting = false;

  constructor() {
    this._circuitBreaker = new CircuitBreaker();
  }

  get isConnected(): boolean {
    return this.connected;
  }

  get isReconnectingStatus(): boolean {
    return this.isReconnecting;
  }

  get circuitBreakerState(): string {
    return this._circuitBreaker.getState();
  }

  get circuitBreaker(): CircuitBreaker {
    return this._circuitBreaker;
  }

  forceDisconnect() {
    this.stopAutoReconnect();
    this.stopKeepAlive();
    this.connected = false;
  }

  private startAutoReconnect() {
    if (this.isReconnecting || !this.lastConfig) return;
    this.isReconnecting = true;
    silentLogger.info("[MT5-MCP] Starting auto-reconnect loop...");

    this.reconnectTimer = setInterval(async () => {
      if (!this.lastConfig) return;
      silentLogger.info("[MT5-MCP] Auto-reconnect attempt...");
      try {
        const res = await this.connectToMT5(this.lastConfig);
        if (res.success) {
          silentLogger.info("[MT5-MCP] Auto-reconnect successful!");
        }
      } catch (err: any) {
        silentLogger.warn(`[MT5-MCP] Auto-reconnect failed: ${err.message}`);
      }
    }, 10000); // Try every 10 seconds
  }

  private stopAutoReconnect() {
    this.isReconnecting = false;
    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startKeepAlive() {
    this.stopKeepAlive();
    // Ping every 30 seconds to keep connection alive
    this.keepAliveTimer = setInterval(() => {
      if (this.connected) {
        this.callWithCircuit("mt5_account_info", {}).catch((err) => {
          silentLogger.debug(`[MT5-MCP] Keep-alive ping failed: ${err.message}`);
        });
      }
    }, 30000);
  }

  private stopKeepAlive() {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  get account(): MT5AccountInfo | null {
    return this.accountInfo;
  }

  /** Register & connect to the MT5 MCP server (stdio or sse). */
  async init(tunnelUrl?: string): Promise<void> {
    this.currentTunnelUrl = tunnelUrl;
    // With two-way RPC, the Python client connects to the Node server.
    // There is no MCP transport to initialize here.
    silentLogger.info("[MT5-MCP] RPC interface ready");
  }

  /** Connect to MT5 terminal with broker credentials. */
  async connectToMT5(config: MT5Config): Promise<{ success: boolean; accountInfo?: MT5AccountInfo; error?: string }> {
    this.lastConfig = config;

    try {
      const result = await withRetry(
        () => executeMt5Command("mt5_connect", {
          server: config.server,
          login: String(config.login),
          password: config.password,
        }),
        3, // max retries
        2000, // base delay 2s
        (e) => !e.message.includes("invalid credentials") // retry on non-credential errors
      );

      if (result.error) {
        return { success: false, error: result.error };
      }

      if (result.accountInfo) {
        this.accountInfo = result.accountInfo as MT5AccountInfo;
      }
      this.connected = true;
      this._circuitBreaker.reset();
      this.stopAutoReconnect();
      this.startKeepAlive();
      return { success: true, accountInfo: this.accountInfo ?? undefined };
    } catch (error: any) {
      const errMsg = error.message || "";
      const isConnError = errMsg.includes("not connected") || errMsg.includes("ECONN") || errMsg.includes("transport") || errMsg.includes("socket") || errMsg.includes("32001") || errMsg.includes("timeout") || errMsg.includes("fetch failed");
      
      if (!isConnError) {
        logErrorStructured("connectToMT5", error, { config }, "error");
      }
      return { success: false, error: errMsg };
    }
  }

  /** Disconnect from MT5. */
  async disconnect(): Promise<void> {
    if (!this.connected) return;

    try {
      await executeMt5Command("mt5_disconnect", {});
    } catch {
      // ignore
    }
    this.stopAutoReconnect();
    this.stopKeepAlive();
    this.connected = false;
    this.accountInfo = null;
    silentLogger.info("[MT5-MCP] Disconnected from MT5");
  }

  /** Refresh account info from MT5. */
  async getAccountInfo(): Promise<MT5AccountInfo> {
    const cached = mt5StreamCache.getAccountInfo();
    if (cached) {
      this.accountInfo = cached as MT5AccountInfo;
      return this.accountInfo;
    }

    const result = await this.callWithCircuit("mt5_account_info", {});
    this.accountInfo = result as MT5AccountInfo;
    return this.accountInfo;
  }

  /** Get tradable symbols (optionally filtered). */
  async getSymbols(group?: string): Promise<MT5Symbol[]> {
    const result = await this.callWithCircuit("mt5_symbols_get", { group: group ?? "" });
    return (result as any).symbols ?? [];
  }

  /** Get symbol details. */
  async getSymbolInfo(symbol: string): Promise<MT5Symbol | null> {
    try {
      const result = await this.callWithCircuit("mt5_symbol_info", { symbol });
      return result as MT5Symbol;
    } catch (error) {
      logErrorStructured("getSymbolInfo", error, { symbol }, "warn");
      return null;
    }
  }

  /** Fetch OHLCV rates. */
  async getRates(symbol: string, timeframe: string, count: number): Promise<MT5Rate[]> {
    const result = await this.callWithCircuit("mt5_copy_rates", { symbol, timeframe, count });
    return (result as any).rates ?? [];
  }

  /** Fetch OHLCV rates within a date range (for backtesting). */
  async getRatesRange(symbol: string, timeframe: string, from: number, to: number): Promise<MT5Rate[]> {
    const result = await this.callWithCircuit("mt5_copy_rates_range", { symbol, timeframe, from, to });
    return (result as any).rates ?? [];
  }

  /** Get current tick. */
  async getTick(symbol: string): Promise<MT5Tick | null> {
    try {
      const result = await this.callWithCircuit("mt5_symbol_tick", { symbol });
      return result as MT5Tick;
    } catch (error) {
      logErrorStructured("getTick", error, { symbol }, "warn");
      return null;
    }
  }

  /** Get all open positions with retry on transient failure. */
  async getPositions(): Promise<MT5Position[]> {
    const cached = mt5StreamCache.getPositions();
    if (cached && cached.length > 0) {
      return cached as MT5Position[];
    }
    
    // Fallback if cache is completely empty or hasn't received ticks yet
    const result = await this.callWithCircuit("mt5_positions_get", {});
    return (result as any).positions ?? [];
  }

  /** Debug — get raw MT5 diagnostic info about positions. */
  async debugInfo(): Promise<any> {
    try {
      const result = await this.callWithCircuit("mt5_debug_info", {});
      silentLogger.info(`[MT5-MCP] debugInfo: ${JSON.stringify(result)}`);
      return result;
    } catch (error: any) {
      logErrorStructured("debugInfo", error, {}, "error");
      return { error: error.message };
    }
  }

  /** Open a market or pending order. */
  async openOrder(params: {
    symbol: string;
    action: "BUY" | "SELL" | "BUY_LIMIT" | "SELL_LIMIT" | "BUY_STOP" | "SELL_STOP";
    volume: number;
    price?: number;
    sl?: number;
    tp?: number;
    comment?: string;
  }): Promise<MT5OrderResult> {
    return await this.callWithCircuit("mt5_order_send", params);
  }

  /** Dry-run debug: compute order parameters WITHOUT executing. */
  async debugOrder(params: {
    symbol: string;
    action: "BUY" | "SELL";
    volume: number;
    sl?: number;
    tp?: number;
  }): Promise<any> {
    return await this.callWithCircuit("mt5_debug_order", params);
  }

  /** Close a position. */
  async closePosition(ticket: number): Promise<MT5OrderResult> {
    return await this.callWithCircuit("mt5_position_close", { ticket });
  }

  /** Modify SL/TP. */
  async modifyPosition(ticket: number, sl?: number, tp?: number): Promise<MT5OrderResult> {
    const args: any = { ticket };
    if (sl !== undefined) args.sl = sl;
    if (tp !== undefined) args.tp = tp;
    return await this.callWithCircuit("mt5_position_modify", args);
  }

  /** Get historical deals. */
  async getHistory(from?: number, to?: number): Promise<MT5Deal[]> {
    const args: any = {};
    if (from) args.from = from;
    if (to) args.to = to;
    const result = await this.callWithCircuit("mt5_history_deals_get", args);
    return (result as any).deals ?? [];
  }

  // ── Private ────────────────────────────────────────────────────────

  private async ensureClient(tunnelUrl?: string): Promise<void> {
    // No-op. Connection is handled via WS push.
  }

  /** Retry init with exponential backoff — used by external trigger. */
  async ensureInit(maxRetries = 3, baseDelayMs = 2000, tunnelUrl?: string): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.init(tunnelUrl);
        return;
      } catch {
        if (attempt < maxRetries) {
          const delay = baseDelayMs * Math.pow(2, attempt - 1);
          silentLogger.warn(`[MT5-MCP] Init attempt ${attempt}/${maxRetries} failed, retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }
    silentLogger.error(`[MT5-MCP] All ${maxRetries} init attempts failed — MT5 unavailable`);
  }

  private logError(method: string, error: any, context?: any, level: "error" | "warn" | "info" = "error"): void {
    logErrorStructured(method, error, context, level);
  }

  async call(tool: string, args: any): Promise<any> {
    return this.callWithCircuit(tool, args);
  }

  // New method to wrap actual call with circuit breaker logic
  private async callWithCircuit(tool: string, args: any): Promise<any> {
    // Check circuit breaker state before attempting any MT5 operation
    if (!this.circuitBreaker.canExecute() && tool !== "mt5_connect") {
      // If circuit is open, fast-fail unless it's a connect attempt
      const errorMessage = `Circuit breaker OPEN for MT5 service (tool: ${tool}). Fast-failing.`;
      logErrorStructured(tool, new Error(errorMessage), { args }, "warn");
      throw new Error(errorMessage);
    }

    try {
      const result = await withRetry(
        async () => {
          if (!this.connected && tool !== "mt5_connect") {
            throw new Error("MT5 not connected");
          }
          return await executeMt5Command(tool, args);
        },
        3, // maxRetries
        1000, // baseDelayMs
        (e) => {
          const errMsg = e.message || "";
          return !errMsg.includes("not connected") && !errMsg.includes("ECONN") && !errMsg.includes("socket") && !errMsg.includes("fetch failed");
        }
      );

      if (result && result.error) {
        throw new Error(result.error);
      }
      
      this.circuitBreaker.recordSuccess();
      return result;

    } catch (error: any) {
      const errorMsg = error.message || "";
      const isExpectedError = errorMsg.includes("10025") || errorMsg.includes("No changes") || errorMsg.includes("10018") || errorMsg.includes("Market closed");
      const isConnError = errorMsg.includes("not connected") || errorMsg.includes("ECONN") || errorMsg.includes("transport") || errorMsg.includes("socket") || errorMsg.includes("fetch failed"); // True hard connection drops

      if (isConnError) {
        // Record failure in circuit breaker ONLY on connection errors
        this.circuitBreaker.recordFailure();
        
        // Hanya log kalau ini error koneksi ASLI (bukan lemparan sekunder dari check !this.connected)
        if (errorMsg !== "MT5 not connected") {
          silentLogger.warn(`[MT5-MCP] Connection dropped during ${tool}: ${errorMsg}. Triggering reconnect...`);
        }
        
        this.connected = false;
        this.accountInfo = null;
        this.startAutoReconnect();
      } else if (!isExpectedError) {
        logErrorStructured(tool, error, { args }, "warn");
      } else {
        logErrorStructured(tool, error, { args }, "info");
      }
      if (isConnError) {
        throw new Error("MT5 not connected");
      }
      throw error;
    }
  }

  /**
   * Try to re-connect to MT5 with saved credentials from DB.
   * Called once on server startup.
   */
  async tryAutoReconnect(): Promise<boolean> {
    try {
      const { MT5Connection } = require("../models/MT5Connection");
      const connections = await MT5Connection.find({ enabled: true }).lean();
      for (const conn of connections as any[]) {
        const doc = await MT5Connection.findById(conn._id);
        if (!doc) continue;
        const password = doc.getPassword();
        if (!password || !conn.server || !conn.login) continue;

        silentLogger.info(`[MT5-MCP] Auto-reconnecting for user ${conn.userId} (${conn.server}/${conn.login})...`);
        const result = await this.connectToMT5({
          server: conn.server,
          login: String(conn.login),
          password,
        });

        if (result.success) {
          silentLogger.info(`[MT5-MCP] Auto-reconnect SUCCESS for user ${conn.userId}`);
          return true;
        } else {
          silentLogger.warn(`[MT5-MCP] Auto-reconnect failed for user ${conn.userId}: ${result.error}`);
        }
      }
    } catch (e: any) {
      silentLogger.warn(`[MT5-MCP] Auto-reconnect skipped (no saved credentials): ${e.message}`);
    }
    return false;
  }


}

export const mt5McpService = new MT5MCPService();
