import { apiClient } from "@/lib/api-client";

export interface MT5Status {
  connected: boolean;
  config: {
    server: string;
    login: string;
  } | null;
  sourcePreference: "manual" | "mt5";
  autoSyncEnabled: boolean;
  syncIntervalMinutes: number;
  lastSyncAt: string | null;
}

export interface MT5ConnectPayload {
  server: string;
  login: string;
  password: string;
}

export interface MT5SettingsPayload {
  sourcePreference?: "manual" | "mt5";
  mt5AutoSyncEnabled?: boolean;
  mt5SyncIntervalMinutes?: number;
}

export interface MT5SyncResult {
  synced: number;
  created: number;
  updated: number;
  errors: string[];
}

export interface MT5Position {
  ticket: number;
  orderId: number;
  symbol: string;
  type: "BUY" | "SELL";
  volume: number;
  priceOpen: number;
  priceCurrent: number;
  sl: number;
  tp: number;
  profit: number;
  time: number;
}

class MT5Service {
  async getStatus(): Promise<MT5Status> {
    const response = await apiClient.get("/api/v1/mt5/status");
    return response.data;
  }

  async connect(payload: MT5ConnectPayload): Promise<{ success: boolean; accountInfo?: any }> {
    const response = await apiClient.post("/api/v1/mt5/connect", payload);
    return response.data;
  }

  async disconnect(): Promise<{ connected: boolean }> {
    const response = await apiClient.post("/api/v1/mt5/disconnect");
    return response.data;
  }

  async updateSettings(payload: MT5SettingsPayload): Promise<any> {
    const response = await apiClient.patch("/api/v1/mt5/settings", payload);
    return response.data;
  }

  async getPositions(): Promise<{ positions: MT5Position[]; total: number }> {
    const response = await apiClient.get("/api/v1/mt5/positions");
    return response.data;
  }

  async sync(accountId?: string): Promise<MT5SyncResult> {
    const response = await apiClient.post("/api/v1/mt5/sync", { accountId });
    return response.data;
  }
}

export const mt5Service = new MT5Service();
