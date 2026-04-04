import { apiClient, ApiResponse } from "@/lib/api-client";

export interface TradingAccount {
  id: string;
  userId: string;
  accountName: string;
  initialBalance: number;
  currentEquity: number;
  currency: string;
  broker: string;
  isActive: boolean;
  onboardingCompleted: boolean;
  maxDailyDrawdownPct: number;
  maxTotalDrawdownPct: number;
  maxDailyTrades: number;
  bio?: string;
  discordWebhook?: string;
  apiKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccountDto {
  accountName: string;
  initialBalance: number;
  currency: string;
  broker: string;
  maxDailyDrawdownPct: number;
  maxTotalDrawdownPct: number;
  maxDailyTrades?: number;
  bio?: string;
  discordWebhook?: string;
}

export class TradingAccountService {
  private basePath = "/api/v1/trading-accounts";

  async getActiveAccount(): Promise<ApiResponse<TradingAccount>> {
    return apiClient.get<TradingAccount>(`${this.basePath}/active`);
  }

  async getAll(): Promise<ApiResponse<TradingAccount[]>> {
    return apiClient.get<TradingAccount[]>(this.basePath);
  }

  async setActive(id: string): Promise<ApiResponse<TradingAccount>> {
    return apiClient.patch<TradingAccount>(`${this.basePath}/${id}/set-active`, {});
  }

  async create(data: CreateAccountDto): Promise<ApiResponse<TradingAccount>> {
    return apiClient.post<TradingAccount>(this.basePath, data);
  }

  async updateInfo(id: string, data: Partial<CreateAccountDto>): Promise<ApiResponse<TradingAccount>> {
    return apiClient.patch<TradingAccount>(`${this.basePath}/${id}`, data);
  }

  async updateRiskRules(id: string, data: { maxDailyDrawdownPct: number; maxTotalDrawdownPct: number; maxDailyTrades?: number }): Promise<ApiResponse<TradingAccount>> {
    return apiClient.patch<TradingAccount>(`${this.basePath}/${id}/risk-rules`, data);
  }

  async generateApiKey(id: string): Promise<ApiResponse<{ apiKey: string }>> {
    return apiClient.post<{ apiKey: string }>(`${this.basePath}/${id}/generate-api-key`, {});
  }
}

export const tradingAccountService = new TradingAccountService();
