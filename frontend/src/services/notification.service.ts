import { apiClient, ApiResponse } from "@/lib/api-client";

export interface Notification {
  id: string;
  userId: string;
  type: "AI_REVIEW_READY" | "TRADE_LOGGED" | "RISK_WARNING" | "SYSTEM";
  title: string;
  message: string;
  link?: string;
  read: boolean;
  metadata?: any;
  createdAt: string;
  updatedAt?: string;
}

export interface UnreadCountResponse {
  count: number;
}

export class NotificationService {
  private basePath = "/api/v1/notifications";

  async getRecent(limit: number = 10, unreadOnly: boolean = false): Promise<ApiResponse<Notification[]>> {
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    if (unreadOnly) {
      params.append("unreadOnly", "true");
    }
    return apiClient.get<Notification[]>(`${this.basePath}?${params.toString()}`);
  }

  async getUnreadCount(): Promise<ApiResponse<{ count: number }>> {
    return apiClient.get<{ count: number }>(`${this.basePath}/unread-count`);
  }

  async markAsRead(notificationId: string): Promise<ApiResponse<Notification>> {
    return apiClient.put<Notification>(`${this.basePath}/${notificationId}/read`, {});
  }

  async markAllAsRead(): Promise<ApiResponse<{ message: string }>> {
    return apiClient.put<{ message: string }>(`${this.basePath}/read-all`, {});
  }

  async delete(notificationId: string): Promise<ApiResponse<{ message: string }>> {
    return apiClient.delete<{ message: string }>(`${this.basePath}/${notificationId}`);
  }
}

export const notificationService = new NotificationService();
