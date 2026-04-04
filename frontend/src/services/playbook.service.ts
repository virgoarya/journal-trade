import { apiClient, ApiResponse } from "@/lib/api-client";

export interface Strategy {
  id: string;
  userId: string;
  name: string;
  description: string;
  methodology: "ICT" | "CRT" | "MSNR" | "SMC" | "PA" | "IND" | "HYBRID";
  marketCondition?: "TRENDING" | "RANGING" | "VOLATILE" | "LIQUID" | "ALL";
  legacyCategory?: "breakout" | "reversal" | "scalping" | "swing" | "news";
  timeframe: string;
  markets: string[];
  rules: string[];
  tags: string[];
  isArchived: boolean;
  stats: {
    totalTrades: number;
    wins: number;
    losses: number;
    totalPnL: number;
    avgRr: number;
    winRate: number;
  };
  htfKeyLevel?: string;
  ictPoi?: "OrderBlock" | "FVG" | "Breaker" | "Rejection" | "iFVG";
  msnrLevel?: "APEX" | "QM" | "OCL" | "TrendLine" | "SBR" | "RBS";
  htfTimeframe?: string;
  entryTimeframe?: string;
  entryChecklist: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateStrategyDto {
  name: string;
  description?: string;
  methodology: "ICT" | "CRT" | "MSNR" | "SMC" | "PA" | "IND" | "HYBRID";
  marketCondition?: "TRENDING" | "RANGING" | "VOLATILE" | "LIQUID" | "ALL";
  legacyCategory?: "breakout" | "reversal" | "scalping" | "swing" | "news";
  timeframe?: string;
  markets: string[];
  rules: string[];
  tags?: string[];
  htfKeyLevel?: string;
  ictPoi?: "OrderBlock" | "FVG" | "Breaker" | "Rejection" | "iFVG";
  msnrLevel?: "APEX" | "QM" | "OCL" | "TrendLine" | "SBR" | "RBS";
  htfTimeframe?: string;
  entryTimeframe?: string;
  entryChecklist?: string[];
}

export class PlaybookService {
  private basePath = "/api/v1/playbooks";

  private transformBackendStrategy(strategy: any): Strategy {
    return {
      ...strategy,
      id: strategy._id || strategy.id,
      // Ensure arrays are initialized
      markets: strategy.markets || [],
      rules: strategy.rules || [],
      entryChecklist: strategy.entryChecklist || [],
      tags: strategy.tags || [],
      // Ensure stats object exists
      stats: strategy.stats || {
        totalTrades: 0,
        wins: 0,
        losses: 0,
        totalPnL: 0,
        avgRr: 0,
        winRate: 0
      }
    };
  }

  async getAll(): Promise<ApiResponse<Strategy[]>> {
    const response = await apiClient.get<Strategy[]>(this.basePath);
    if (response.success && Array.isArray(response.data)) {
      response.data = response.data.map(s => this.transformBackendStrategy(s));
    }
    return response;
  }

  async getById(id: string): Promise<ApiResponse<Strategy>> {
    const response = await apiClient.get<Strategy>(`${this.basePath}/${id}`);
    if (response.success && response.data) {
      response.data = this.transformBackendStrategy(response.data);
    }
    return response;
  }

  async create(strategyData: CreateStrategyDto): Promise<ApiResponse<Strategy>> {
    const response = await apiClient.post<Strategy>(this.basePath, strategyData);
    if (response.success && response.data) {
      response.data = this.transformBackendStrategy(response.data);
    }
    return response;
  }

  async update(id: string, strategyData: Partial<CreateStrategyDto>): Promise<ApiResponse<Strategy>> {
    const response = await apiClient.patch<Strategy>(`${this.basePath}/${id}`, strategyData);
    if (response.success && response.data) {
      response.data = this.transformBackendStrategy(response.data);
    }
    return response;
  }

  async delete(id: string): Promise<ApiResponse<null>> {
    return apiClient.delete<null>(`${this.basePath}/${id}`);
  }

  async getByCategory(category: string): Promise<ApiResponse<Strategy[]>> {
    const response = await apiClient.get<Strategy[]>(`${this.basePath}?category=${category}`);
    if (response.success && Array.isArray(response.data)) {
      response.data = response.data.map(s => this.transformBackendStrategy(s));
    }
    return response;
  }

  async duplicate(id: string): Promise<ApiResponse<Strategy>> {
    const response = await apiClient.post<Strategy>(`${this.basePath}/${id}/duplicate`, {});
    if (response.success && response.data) {
      response.data = this.transformBackendStrategy(response.data);
    }
    return response;
  }

  async assignToTrade(playbookId: string, tradeId: string): Promise<ApiResponse<Strategy>> {
    const response = await apiClient.post<Strategy>(`${this.basePath}/${playbookId}/assign-trade`, {
      tradeId
    });
    if (response.success && response.data) {
      response.data = this.transformBackendStrategy(response.data);
    }
    return response;
  }
}

export const playbookService = new PlaybookService();
