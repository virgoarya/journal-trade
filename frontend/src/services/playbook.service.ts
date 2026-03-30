import { apiClient, ApiResponse } from "@/lib/api-client";

export interface Strategy {
  id: string;
  userId: string;
  name: string;
  description: string;
  category: "breakout" | "reversal" | "scalping" | "swing" | "news";
  timeframe: string;
  markets: string[];
  rules: string[];
  winRate: number;
  avgRr: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateStrategyDto {
  name: string;
  description?: string;
  category: "breakout" | "reversal" | "scalping" | "swing" | "news";
  timeframe?: string;
  markets: string[];
  rules: string[];
  tags?: string[];
}

export class PlaybookService {
  private basePath = "/api/v1/playbooks";

  async getAll(): Promise<ApiResponse<Strategy[]>> {
    return apiClient.get<Strategy[]>(this.basePath);
  }

  async getById(id: string): Promise<ApiResponse<Strategy>> {
    return apiClient.get<Strategy>(`${this.basePath}/${id}`);
  }

  async create(strategyData: CreateStrategyDto): Promise<ApiResponse<Strategy>> {
    return apiClient.post<Strategy>(this.basePath, strategyData);
  }

  async update(id: string, strategyData: Partial<CreateStrategyDto>): Promise<ApiResponse<Strategy>> {
    return apiClient.put<Strategy>(`${this.basePath}/${id}`, strategyData);
  }

  async delete(id: string): Promise<ApiResponse<null>> {
    return apiClient.delete<null>(`${this.basePath}/${id}`);
  }

  async getByCategory(category: string): Promise<ApiResponse<Strategy[]>> {
    return apiClient.get<Strategy[]>(`${this.basePath}?category=${category}`);
  }

  async duplicate(id: string): Promise<ApiResponse<Strategy>> {
    return apiClient.post<Strategy>(`${this.basePath}/${id}/duplicate`, {});
  }
}

export const playbookService = new PlaybookService();
