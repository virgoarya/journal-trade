import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { silentLogger } from "../utils/silent-logger";
import path from "node:path";

// ─── Types ───────────────────────────────────────────────────────────

export interface MT5Config {
  server: string;
  login: string;
  password: string;
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
}

// ─── Service ─────────────────────────────────────────────────────────

class MT5MCPService {
  private client: Client | null = null;
  private connected = false;
  private accountInfo: MT5AccountInfo | null = null;

  get isConnected(): boolean {
    return this.connected;
  }

  get account(): MT5AccountInfo | null {
    return this.accountInfo;
  }

  /** Register & connect to the MT5 MCP server (stdio). */
  async init(): Promise<void> {
    if (this.client) return;

    try {
      const client = new Client(
        { name: "JournalTradeAI", version: "1.0.0" },
        { capabilities: {} },
      );

      const serverScript = path.join(__dirname, "..", "..", "mcp-mt5-server", "server.py");
      const pythonPath = path.join(__dirname, "..", "..", ".venv-mcp", "Scripts", "python.exe");
      const transport = new StdioClientTransport({
        command: pythonPath,
        args: [serverScript],
      });

      await client.connect(transport, { timeout: 100000 });
      this.client = client;
      silentLogger.info("[MT5-MCP] Connected to MT5 MCP server");
    } catch (error: any) {
      this.client = null;
      silentLogger.error(`[MT5-MCP] Init failed: ${error.message}`);
      throw error;
    }
  }

  /** Connect to MT5 terminal with broker credentials. */
  async connectToMT5(config: MT5Config): Promise<{ success: boolean; accountInfo?: MT5AccountInfo; error?: string }> {
    await this.ensureClient();

    try {
      const result = await this.client!.callTool({
        name: "mt5_connect",
        arguments: {
          server: config.server,
          login: config.login,
          password: config.password,
        },
      });

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
    const result = await this.call("mt5_account_info", {});
    this.accountInfo = result as MT5AccountInfo;
    return this.accountInfo;
  }

  /** Get tradable symbols (optionally filtered). */
  async getSymbols(group?: string): Promise<MT5Symbol[]> {
    const result = await this.call("mt5_symbols_get", { group: group ?? "" });
    return (result as any).symbols ?? [];
  }

  /** Get symbol details. */
  async getSymbolInfo(symbol: string): Promise<MT5Symbol | null> {
    try {
      const result = await this.call("mt5_symbol_info", { symbol });
      return result as MT5Symbol;
    } catch {
      return null;
    }
  }

  /** Fetch OHLCV rates. */
  async getRates(symbol: string, timeframe: string, count: number): Promise<MT5Rate[]> {
    const result = await this.call("mt5_copy_rates", { symbol, timeframe, count });
    return (result as any).rates ?? [];
  }

  /** Fetch OHLCV rates within a date range (for backtesting). */
  async getRatesRange(symbol: string, timeframe: string, from: number, to: number): Promise<MT5Rate[]> {
    const result = await this.call("mt5_copy_rates_range", { symbol, timeframe, from, to });
    return (result as any).rates ?? [];
  }

  /** Get current tick. */
  async getTick(symbol: string): Promise<MT5Tick | null> {
    try {
      const result = await this.call("mt5_symbol_tick", { symbol });
      return result as MT5Tick;
    } catch {
      return null;
    }
  }

  /** Get all open positions. */
  async getPositions(): Promise<MT5Position[]> {
    const result = await this.call("mt5_positions_get", {});
    return (result as any).positions ?? [];
  }

  /** Open a market order. */
  async openOrder(params: {
    symbol: string;
    action: "BUY" | "SELL";
    volume: number;
    sl?: number;
    tp?: number;
    comment?: string;
  }): Promise<MT5OrderResult> {
    const result = await this.call("mt5_order_send", params);
    return result as MT5OrderResult;
  }

  /** Close a position. */
  async closePosition(ticket: number): Promise<MT5OrderResult> {
    const result = await this.call("mt5_position_close", { ticket });
    return result as MT5OrderResult;
  }

  /** Modify SL/TP. */
  async modifyPosition(ticket: number, sl?: number, tp?: number): Promise<MT5OrderResult> {
    const args: any = { ticket };
    if (sl !== undefined) args.sl = sl;
    if (tp !== undefined) args.tp = tp;
    const result = await this.call("mt5_position_modify", args);
    return result as MT5OrderResult;
  }

  /** Get historical deals. */
  async getHistory(from?: number, to?: number): Promise<MT5Deal[]> {
    const args: any = {};
    if (from) args.from = from;
    if (to) args.to = to;
    const result = await this.call("mt5_history_deals_get", args);
    return (result as any).deals ?? [];
  }

  // ── Private ────────────────────────────────────────────────────────

  private async ensureClient(): Promise<void> {
    if (!this.client) {
      await this.init();
    }
  }

  private async call(tool: string, args: Record<string, any>): Promise<any> {
    await this.ensureClient();
    if (!this.client) throw new Error("MCP client not initialized");

    if (!this.connected && tool !== "mt5_connect") {
      throw new Error("MT5 not connected");
    }

    const result = await this.client.callTool({ name: tool, arguments: args });
    const data = this.parseResult(result);
    if (data.error) throw new Error(data.error);
    return data;
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
