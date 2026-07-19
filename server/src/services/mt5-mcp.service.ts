import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { silentLogger } from "../utils/silent-logger";
import path from "node:path";
import fs from "node:fs";
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
  private client: Client | null = null;
  private connected = false;
  private accountInfo: MT5AccountInfo | null = null;
  private _circuitBreaker: CircuitBreaker;

  private currentTunnelUrl?: string;

  constructor() {
    this._circuitBreaker = new CircuitBreaker();
  }

  get isConnected(): boolean {
    return this.connected;
  }

  get circuitBreakerState(): string {
    return this._circuitBreaker.getState();
  }

  get circuitBreaker(): CircuitBreaker {
    return this._circuitBreaker;
  }

  forceDisconnect() {
    this.connected = false;
  }

  get account(): MT5AccountInfo | null {
    return this.accountInfo;
  }

  /** Register & connect to the MT5 MCP server (stdio or sse). */
  async init(tunnelUrl?: string): Promise<void> {
    if (this.client) {
      if (this.currentTunnelUrl === tunnelUrl) return;
      try { await this.client.close(); } catch {}
      this.client = null;
    }
    
    this.currentTunnelUrl = tunnelUrl;

    try {
      const client = new Client(
        { name: "JournalTradeAI", version: "1.0.0" },
        { capabilities: {} },
      );

      let transport;
      if (tunnelUrl) {
        // Mode Jaringan Web (Railway)
        let formattedUrl = tunnelUrl;
        if (!formattedUrl.endsWith("/sse")) {
            formattedUrl = formattedUrl.endsWith("/") ? `${formattedUrl}sse` : `${formattedUrl}/sse`;
        }
        transport = new SSEClientTransport(new URL(formattedUrl));
      } else {
        // Mode Lokal (Localhost Desktop)
        // Validate prerequisites before starting Python server
        const serverScript = path.join(__dirname, "..", "..", "mcp-mt5-server", "server.py");
        const pythonPath = path.join(__dirname, "..", "..", ".venv-mcp", "Scripts", "python.exe");

        // Check Python executable
        if (!fs.existsSync(pythonPath)) {
          const err = new Error(`Python executable not found at: ${pythonPath}. Please create .venv-mcp virtual environment.`);
          silentLogger.error(`[MT5-MCP] ${err.message}`);
          throw err;
        }

        // Check server script
        if (!fs.existsSync(serverScript)) {
          const err = new Error(`MCP server script not found at: ${serverScript}`);
          silentLogger.error(`[MT5-MCP] ${err.message}`);
          throw err;
        }

        // Optional: Check if MT5 terminal is running (basic check)
        try {
          const { execSync } = require("child_process");
          const output = execSync('tasklist /FI "IMAGENAME eq terminal64.exe" /FI "IMAGENAME eq terminal.exe"', { encoding: 'utf8', stdio: 'pipe' });
          if (!output.includes("terminal64.exe") && !output.includes("terminal.exe")) {
            silentLogger.warn("[MT5-MCP] MetaTrader 5 terminal does not appear to be running. Connection may fail.");
          }
        } catch {
          silentLogger.warn("[MT5-MCP] Could not check MT5 terminal status (tasklist failed).");
        }
        
        transport = new StdioClientTransport({
          command: pythonPath,
          args: [serverScript, "--transport", "stdio"],
        });
      }

      await client.connect(transport, { timeout: 300000 });
      this.client = client;
      silentLogger.info("[MT5-MCP] Connected to MT5 MCP server");
    } catch (error: any) {
      if (this.client) {
        try { await this.client.close(); } catch {}
      }
      this.client = null;
      silentLogger.error(`[MT5-MCP] Init failed: ${error.message}`);
      logErrorStructured("init", error, {}, "error"); // Log error structure
      throw error;
    }
  }

  /** Connect to MT5 terminal with broker credentials. */
  async connectToMT5(config: MT5Config): Promise<{ success: boolean; accountInfo?: MT5AccountInfo; error?: string }> {
    await this.ensureClient(config.tunnelUrl);

    try {
      const result = await withRetry(
        () => this.client!.callTool({
          name: "mt5_connect",
          arguments: {
            server: config.server,
            login: config.login,
            password: config.password,
          },
        }),
        3, // max retries
        2000, // base delay 2s
        (e) => !e.message.includes("invalid credentials") // retry on non-credential errors
      );

      const data = this.parseResult(result);
      if (data.error) {
        return { success: false, error: data.error };
      }

      if (data.accountInfo) {
        this.accountInfo = data.accountInfo as MT5AccountInfo;
      }
      this.connected = true;
      return { success: true, accountInfo: this.accountInfo ?? undefined };
    } catch (error: any) {
      logErrorStructured("connectToMT5", error, { config }, "error");
      return { success: false, error: error.message };
    }
  }

  /** Disconnect from MT5. */
  async disconnect(): Promise<void> {
    if (!this.connected || !this.client) return;

    try {
      await this.client.callTool({ name: "mt5_disconnect", arguments: {} });
    } catch {
      // ignore
    }
    this.connected = false;
    this.accountInfo = null;
    silentLogger.info("[MT5-MCP] Disconnected from MT5");
  }

  /** Refresh account info from MT5. */
  async getAccountInfo(): Promise<MT5AccountInfo> {
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
    if (!this.client) {
      await this.init(tunnelUrl);
    }
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
    if (!this.client) {
      // If MCP client is not initialized, throw an error immediately.
      // This should ideally be caught and handled by the caller (e.g., with retry or graceful degradation).
      const errorMessage = "MCP Client not initialized";
      logErrorStructured(tool, new Error(errorMessage), { args }, "error");
      throw new Error(errorMessage);
    }

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
            // If MT5 got disconnected in the meantime, throw error to trigger retry/breaker logic
            throw new Error("MT5 not connected");
          }
          // Execute the actual tool call
          return await this.client!.callTool({ name: tool, arguments: args });
        },
        3, // maxRetries
        1000, // baseDelayMs
        (e) => {
          // Define which errors are retryable
          const errMsg = e.message || "";
          return !errMsg.includes("not connected") && !errMsg.includes("ECONN") && !errMsg.includes("socket") && !errMsg.includes("timeout") && !errMsg.includes("32001"); // Retry unless it's a connection error or credential error
        }
      );

      const data = this.parseResult(result);
      if (data.error) {
        // If the tool call returned a business logic error (e.g., invalid order parameters)
        throw new Error(data.error);
      }
      
      // If call was successful and no business error, record success for circuit breaker
      this.circuitBreaker.recordSuccess();
      return data;

    } catch (error: any) {
      // Record failure in circuit breaker on any caught error (including retried ones)
      this.circuitBreaker.recordFailure();
      
      const errorMsg = error.message || "";
      const isExpectedError = errorMsg.includes("10025") || errorMsg.includes("No changes") || errorMsg.includes("10018") || errorMsg.includes("Market closed");
      const isConnError = errorMsg.includes("not connected") || errorMsg.includes("ECONN") || errorMsg.includes("transport") || errorMsg.includes("socket") || errorMsg.includes("timeout") || errorMsg.includes("32001"); // MT5_RET_NO_CONNECTION

      if (isConnError) {
        logErrorStructured(tool, error, { args }, "error");
        silentLogger.warn(`[MT5-MCP] Connection error on ${tool}, resetting flag: ${error.message}`);
        this.connected = false;
        this.accountInfo = null;
      } else if (!isExpectedError) {
        logErrorStructured(tool, error, { args }, "warn");
      } else {
        logErrorStructured(tool, error, { args }, "info");
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

  private parseResult(result: any): any {
    if (result?.content?.[0]?.text) {
      try {
        return JSON.parse(result.content[0].text);
      } catch {
        return { text: result.content[0].text };
      }
    }
    return result;
  }
}

export const mt5McpService = new MT5MCPService();
