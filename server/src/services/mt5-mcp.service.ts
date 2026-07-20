import { executeMt5Command, mt5StreamCache } from "../mt5-streamer";
import { silentLogger } from "../utils/silent-logger";

export interface MT5Config {
  server: string;
  login: string;
  password: string;
  tunnelUrl?: string; // No longer used, kept for backward compatibility
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

export interface MT5Rate {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

class MT5MCPService {
  private connected = false;
  private accountInfo: MT5AccountInfo | null = null;

  get isConnected(): boolean {
    return this.connected;
  }

  // Auto-reconnect is handled by Python script now
  get isReconnectingStatus(): boolean {
    return false; 
  }

  forceDisconnect() {
    this.connected = false;
    this.accountInfo = null;
    executeMt5Command("mt5_disconnect").catch(() => {});
  }

  async connectToMT5(config: MT5Config) {
    try {
      const result = await executeMt5Command("mt5_connect", {
        server: config.server,
        login: String(config.login),
        password: config.password,
      });
      
      if (result.success) {
        this.connected = true;
        this.accountInfo = result.accountInfo;
        return { success: true };
      }
      return { success: false, error: result.error || "Failed to connect to MT5" };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async disconnect() {
    this.connected = false;
    this.accountInfo = null;
    try {
      await executeMt5Command("mt5_disconnect");
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async getPositions() {
    if (!this.connected) return { success: false, error: "MT5 not connected" };
    
    // Always use WebSocket cache! 0ms latency.
    const cached = mt5StreamCache.getPositions();
    return {
      success: true,
      data: {
        positions: cached,
        orders: [],
        total: cached.length,
      }
    };
  }

  async getAccountInfo() {
    if (!this.connected) return { success: false, error: "MT5 not connected" };
    
    // Always use WebSocket cache! 0ms latency.
    const cached = mt5StreamCache.getAccountInfo();
    return {
      success: true,
      data: cached || this.accountInfo
    };
  }

  async getMarketData(symbol: string, timeframe: string, count: number): Promise<{ success: boolean; data?: MT5Rate[]; error?: string }> {
    if (!this.connected) return { success: false, error: "MT5 not connected" };
    try {
      const result = await executeMt5Command("mt5_market_data", { symbol, timeframe, count });
      return { success: true, data: result.rates };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async openTrade(symbol: string, action: "BUY" | "SELL", volume: number, sl?: number, tp?: number, comment?: string) {
    if (!this.connected) return { success: false, error: "MT5 not connected" };
    try {
      const result = await executeMt5Command("mt5_order_send", { symbol, action, volume, sl, tp, comment });
      return result;
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async closeTrade(ticket: number) {
    if (!this.connected) return { success: false, error: "MT5 not connected" };
    try {
      const result = await executeMt5Command("mt5_position_close", { ticket });
      return result;
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async modifyTrade(ticket: number, sl?: number, tp?: number) {
    if (!this.connected) return { success: false, error: "MT5 not connected" };
    try {
      const result = await executeMt5Command("mt5_position_modify", { ticket, sl, tp });
      return result;
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async getSymbols() {
    if (!this.connected) return { success: false, error: "MT5 not connected" };
    try {
      const result = await executeMt5Command("mt5_symbols_get");
      return { success: true, data: result.symbols };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
}

export const mt5McpService = new MT5MCPService();
