import { apiClient, ApiResponse } from "@/lib/api-client";

export interface AIReview {
  id: string;
  tradeId: string;
  date: string;
  pair: string;
  overallScore: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  recommendation?: string;
  psychologyNotes?: string;
  marketContext?: string;
  riskManagement?: string;
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
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 35000);
      
      const response = await fetch(`${this.basePath}/generate/${tradeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      let data = null;
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        data = { error: { message: text } };
      }

      if (!response.ok) {
        return {
          success: false,
          error: data?.error?.message || data?.message || `HTTP ${response.status}`,
        };
      }

      return { success: true, data: data.data ?? data };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return { success: false, error: "Request timeout - AI sedang sibuk. Coba lagi nanti." };
      }
      return { success: false, error: error.message || "Network error occurred" };
    }
  }

  async getByTrade(tradeId: string): Promise<ApiResponse<AIReview[]>> {
    return apiClient.get<AIReview[]>(`${this.basePath}/trade/${tradeId}`);
  }

  async delete(id: string): Promise<ApiResponse<null>> {
    return apiClient.delete<null>(`${this.basePath}/${id}`);
  }

  async clearAll(): Promise<ApiResponse<{ deletedCount: number }>> {
    return apiClient.delete<{ deletedCount: number }>(`${this.basePath}/clear-all`);
  }
}

export const aiReviewService = new AIReviewService();
