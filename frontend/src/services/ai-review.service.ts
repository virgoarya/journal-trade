import { apiClient, ApiResponse } from "@/lib/api-client";

export interface AIReview {
  id: string;
  date: string;
  tradeId: string;
  pair: string;
  overallScore: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  suggestions: string[];
  psychologyNotes: string;
  marketContext: string;
  riskManagement: string;
  timestamp: string;
}

export interface GenerateReviewDto {
  tradeId: string;
  includePsychology: boolean;
  includeMarketContext: boolean;
}

export class AIReviewService {
  private basePath = "/api/v1/ai-reviews";

  async getAll(): Promise<ApiResponse<AIReview[]>> {
    return apiClient.get<AIReview[]>(this.basePath);
  }

  async getById(id: string): Promise<ApiResponse<AIReview>> {
    return apiClient.get<AIReview>(`${this.basePath}/${id}`);
  }

  async generate(tradeId: string): Promise<ApiResponse<AIReview>> {
    return apiClient.post<AIReview>(`${this.basePath}/generate/${tradeId}`, {});
  }

  async getByTrade(tradeId: string): Promise<ApiResponse<AIReview[]>> {
    return apiClient.get<AIReview[]>(`${this.basePath}/trade/${tradeId}`);
  }

  async delete(id: string): Promise<ApiResponse<null>> {
    return apiClient.delete<null>(`${this.basePath}/${id}`);
  }
}

export const aiReviewService = new AIReviewService();
