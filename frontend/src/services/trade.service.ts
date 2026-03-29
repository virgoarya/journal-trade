import { apiClient, ApiResponse } from "@/lib/api-client";

export interface Trade {
  id: string;
  userId: string;
  pair: string;
  type: "Long" | "Short";
  entry: number;
  exit: number;
  size: number;
  pnl: number;
  result: "win" | "loss" | "breakeven";
  date: string;
  notes?: string;
  psychology?: "confident" | "fear" | "greed" | "hesitant" | "disciplined";
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTradeDto {
  pair: string;
  type: "Long" | "Short";
  entry: number;
  exit: number;
  size: number;
  notes?: string;
  psychology?: "confident" | "fear" | "greed" | "hesitant" | "disciplined";
  tags?: string[];
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

  async getAll(): Promise<ApiResponse<Trade[]>> {
    return apiClient.get<Trade[]>(this.basePath);
  }

  async getById(id: string): Promise<ApiResponse<Trade>> {
    return apiClient.get<Trade>(`${this.basePath}/${id}`);
  }

  async create( tradeData: CreateTradeDto): Promise<ApiResponse<Trade>> {
    return apiClient.post<Trade>(this.basePath, tradeData);
  }

  async update(id: string, tradeData: Partial<CreateTradeDto>): Promise<ApiResponse<Trade>> {
    return apiClient.put<Trade>(`${this.basePath}/${id}`, tradeData);
  }

  async delete(id: string): Promise<ApiResponse<null>> {
    return apiClient.delete<null>(`${this.basePath}/${id}`);
  }

  async getSummary(): Promise<ApiResponse<TradeSummary>> {
    return apiClient.get<TradeSummary>(`${this.basePath}/summary`);
  }

  async getRecent(limit: number = 10): Promise<ApiResponse<Trade[]>> {
    return apiClient.get<Trade[]>(`${this.basePath}/recent?limit=${limit}`);
  }
}

export const tradeService = new TradeService();
