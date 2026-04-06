import { apiClient, ApiResponse } from "@/lib/api-client";

export interface Trade {
  id: string;
  userId: string;
  tradingAccountId: string;
  playbookId?: string;
  playbookName?: string; // populated name
  tradeDate: string;
  pair: string;
  direction: "Long" | "Short";  // UI-friendly case
  entryPrice: number;
  stopLoss: number;
  takeProfit?: number;
  lotSize: number;
  actualPnl: number;
  pnl: number;  // Alias for actualPnl for UI convenience
  rMultiple?: number;
  result: "win" | "loss" | "breakeven";  // UI-friendly case
  emotionalState?: number;
  notes?: string;
  chartLink?: string;
  exitDate?: string;
  session?: "Asia" | "London" | "NY AM" | "NY PM" | "Other" | "NY";
  marketCondition?: "TRENDING" | "RANGING" | "VOLATILE" | "LIQUID" | "ALL";
  riskPercent?: number; // Risk exposure as % of account equity
  isDeleted?: boolean; // soft delete flag
  deletedAt?: string;
  deletionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTradeDto {
  tradingAccountId: string;
  tradeDate: string;
  exitDate?: string;
  pair: string;
  direction: "LONG" | "SHORT";  // Send uppercase to backend
  entryPrice: number;
  stopLoss: number;
  takeProfit?: number;
  lotSize: number;
  actualPnl?: number;
  rMultiple?: number;
  result?: "WIN" | "LOSS" | "BREAKEVEN";  // Send uppercase to backend
  emotionalState?: number;
  notes?: string;
  chartLink?: string;
  playbookId?: string;
  session?: "Asia" | "London" | "NY AM" | "NY PM" | "Other" | "NY";
  marketCondition?: "TRENDING" | "RANGING" | "VOLATILE" | "LIQUID" | "ALL";
  riskPercent?: number; // Risk % of account equity
}

export interface TradeSummary {
  totalPnL: number;
  totalTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  bestTrade?: number;
  worstTrade?: number;
}

export class TradeService {
  private basePath = "/api/v1/trades";

  private transformBackendTrade(trade: any): Trade {
    // Handle populated playbookId (object) vs plain string ID
    let playbookId: string | undefined;
    let playbookName: string | undefined;
    if (trade.playbookId) {
      if (typeof trade.playbookId === 'string') {
        playbookId = trade.playbookId;
      } else if (trade.playbookId._id) {
        playbookId = trade.playbookId._id.toString();
        playbookName = trade.playbookId.name;
      } else if (trade.playbookId.id) {
        playbookId = trade.playbookId.id.toString();
        playbookName = trade.playbookId.name;
      }
    }

    return {
      id: trade._id || trade.id,
      userId: trade.userId,
      tradingAccountId: trade.tradingAccountId,
      playbookId,
      playbookName,
      tradeDate: trade.tradeDate,
      pair: trade.pair,
      direction: trade.direction === "LONG" ? "Long" : trade.direction === "SHORT" ? "Short" : trade.direction,
      entryPrice: trade.entryPrice,
      stopLoss: trade.stopLoss,
      takeProfit: trade.takeProfit,
      lotSize: trade.lotSize,
      actualPnl: trade.actualPnl,
      pnl: trade.actualPnl,
      rMultiple: trade.rMultiple,
      result: trade.result === "WIN" ? "win" : trade.result === "LOSS" ? "loss" : "breakeven",
      emotionalState: trade.emotionalState,
      notes: trade.notes,
      chartLink: trade.chartLink,
      exitDate: trade.exitDate,
      session: trade.session,
      marketCondition: trade.marketCondition,
      riskPercent: trade.riskPercent,
      isDeleted: trade.isDeleted,
      deletedAt: trade.deletedAt,
      deletionReason: trade.deletionReason,
      createdAt: trade.createdAt,
      updatedAt: trade.updatedAt,
    };
  }

  async getAll(includeDeleted: boolean = false): Promise<ApiResponse<Trade[]>> {
    const endpoint = includeDeleted ? `${this.basePath}?includeDeleted=true` : this.basePath;
    const response = await apiClient.get<Trade[]>(endpoint);
    if (response.success && response.data) {
      response.data = response.data.map(t => this.transformBackendTrade(t));
    }
    return response;
  }

  async getById(id: string): Promise<ApiResponse<Trade>> {
    const response = await apiClient.get<Trade>(`${this.basePath}/${id}`);
    if (response.success && response.data) {
      response.data = this.transformBackendTrade(response.data);
    }
    return response;
  }

  async create(tradeData: CreateTradeDto): Promise<ApiResponse<Trade>> {
    const response = await apiClient.post<Trade>(this.basePath, tradeData);
    if (response.success && response.data) {
      response.data = this.transformBackendTrade(response.data);
    }
    return response;
  }

  async update(id: string, tradeData: Partial<CreateTradeDto>): Promise<ApiResponse<Trade>> {
    const response = await apiClient.patch<Trade>(`${this.basePath}/${id}`, tradeData);
    if (response.success && response.data) {
      response.data = this.transformBackendTrade(response.data);
    }
    return response;
  }

  async delete(id: string, reason?: string): Promise<ApiResponse<null>> {
    const url = reason ? `${this.basePath}/${id}?reason=${encodeURIComponent(reason)}` : `${this.basePath}/${id}`;
    return apiClient.delete<null>(url);
  }

  async restore(id: string): Promise<ApiResponse<null>> {
    return apiClient.patch<null>(`${this.basePath}/${id}/restore`, {});
  }

  async hardDelete(id: string): Promise<ApiResponse<null>> {
    return apiClient.delete<null>(`${this.basePath}/${id}/permanent`);
  }

  async getSummary(): Promise<ApiResponse<TradeSummary>> {
    return apiClient.get<TradeSummary>(`${this.basePath}/summary`);
  }

  async getRecent(limit: number = 10): Promise<ApiResponse<Trade[]>> {
    const response = await apiClient.get<Trade[]>(`${this.basePath}/recent?limit=${limit}`);
    if (response.success && response.data) {
      response.data = response.data.map(t => this.transformBackendTrade(t));
    }
    return response;
  }
}

export const tradeService = new TradeService();
