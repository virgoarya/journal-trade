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
  defaultRiskPercent?: number;
  bio?: string;
  discordWebhook?: string;
  apiKey?: string;
  riskTier?: "CONSERVATIVE" | "MODERATE" | "AGGRESSIVE" | "SPECULATIVE";
  riskNotificationEnabled?: boolean;
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
  riskTier?: "CONSERVATIVE" | "MODERATE" | "AGGRESSIVE" | "SPECULATIVE";
  riskNotificationEnabled?: boolean;
  defaultRiskPercent?: number;
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

  async updateRiskRules(id: string, data: {
    maxDailyDrawdownPct: number;
    maxTotalDrawdownPct: number;
    maxDailyTrades?: number;
    riskTier?: "CONSERVATIVE" | "MODERATE" | "AGGRESSIVE" | "SPECULATIVE";
    defaultRiskPercent?: number;
  }): Promise<ApiResponse<TradingAccount>> {
    return apiClient.patch<TradingAccount>(`${this.basePath}/${id}/risk-rules`, data);
  }

  async generateApiKey(id: string): Promise<ApiResponse<{ apiKey: string }>> {
    return apiClient.post<{ apiKey: string }>(`${this.basePath}/${id}/generate-api-key`, {});
  }

  async delete(id: string): Promise<ApiResponse<{ message: string }>> {
    return apiClient.delete<{ message: string }>(`${this.basePath}/${id}`);
  }
}

export const tradingAccountService = new TradingAccountService();
