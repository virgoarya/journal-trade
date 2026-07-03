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
    const response = await apiClient.get<MT5Status>("/api/v1/mt5/status");
    return response.data as MT5Status;
  }

  async connect(payload: MT5ConnectPayload): Promise<{ success: boolean; accountInfo?: any }> {
    const response = await apiClient.post<{ success: boolean; accountInfo?: any }>("/api/v1/mt5/connect", payload);
    return response.data as { success: boolean; accountInfo?: any };
  }

  // Fix: apiClient.post requires 2 arguments; pass empty object as body
  async disconnect(): Promise<{ connected: boolean }> {
    const response = await apiClient.post<{ connected: boolean }>("/api/v1/mt5/disconnect", {});
    return response.data as { connected: boolean };
  }

  async updateSettings(payload: MT5SettingsPayload): Promise<any> {
    const response = await apiClient.patch<any>("/api/v1/mt5/settings", payload);
    return response.data;
  }

  async getPositions(): Promise<{ positions: MT5Position[]; total: number }> {
    const response = await apiClient.get<{ positions: MT5Position[]; total: number }>("/api/v1/mt5/positions");
    return response.data as { positions: MT5Position[]; total: number };
  }

  async sync(accountId?: string): Promise<MT5SyncResult> {
    const response = await apiClient.post<MT5SyncResult>("/api/v1/mt5/sync", { accountId });
    return response.data as MT5SyncResult;
  }
}

export const mt5Service = new MT5Service();
