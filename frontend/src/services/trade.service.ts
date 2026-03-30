import { apiClient, ApiResponse } from "@/lib/api-client";

export interface Trade {
  id: string;
  userId: string;
  tradingAccountId: string;
  playbookId?: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface CreateTradeDto {
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
    return {
      id: trade._id || trade.id,
      userId: trade.userId,
      tradingAccountId: trade.tradingAccountId,
      playbookId: trade.playbookId,
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
      createdAt: trade.createdAt,
      updatedAt: trade.updatedAt,
    };
  }

  async getAll(): Promise<ApiResponse<Trade[]>> {
    const response = await apiClient.get<Trade[]>(this.basePath);
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
    const response = await apiClient.put<Trade>(`${this.basePath}/${id}`, tradeData);
    if (response.success && response.data) {
      response.data = this.transformBackendTrade(response.data);
    }
    return response;
  }

  async delete(id: string): Promise<ApiResponse<null>> {
    return apiClient.delete<null>(`${this.basePath}/${id}`);
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
