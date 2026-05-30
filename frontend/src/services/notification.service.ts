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
  private readonly SYSTEM_READ_KEY = "hunter_system_notifications_read";

  getSystemReadIds(): Set<string> {
    try {
      const stored = localStorage.getItem(this.SYSTEM_READ_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  }

  setSystemReadId(id: string) {
    const ids = this.getSystemReadIds();
    ids.add(id);
    try {
      localStorage.setItem(this.SYSTEM_READ_KEY, JSON.stringify([...ids]));
    } catch {
      // Ignore localStorage errors
    }
  }

  async getRecent(limit: number = 10, unreadOnly: boolean = false): Promise<ApiResponse<Notification[]>> {
    const params = new URLSearchParams();
    params.append("limit", limit.toString());
    if (unreadOnly) {
      params.append("unreadOnly", "true");
    }
    const response = await apiClient.get<Notification[]>(`${this.basePath}?${params.toString()}`);
    
    // Apply client-side read state for system notifications
    if (response.success && response.data) {
      const systemReadIds = this.getSystemReadIds();
      response.data = response.data.map(notif => {
        if (notif.userId === "system" && systemReadIds.has(notif.id)) {
          return { ...notif, read: true };
        }
        return notif;
      });
    }
    
    return response;
  }

  async getUnreadCount(): Promise<ApiResponse<{ count: number }>> {
    return apiClient.get<{ count: number }>(`${this.basePath}/unread-count`);
  }

  async markAsRead(notificationId: string): Promise<ApiResponse<Notification>> {
    // For system notifications, use localStorage instead of API
    const notifications = await this.getRecent(100);
    const systemNotif = notifications.data?.find(n => n.id === notificationId);
    
    if (systemNotif && systemNotif.userId === "system") {
      this.setSystemReadId(notificationId);
      return { success: true, data: { ...systemNotif, read: true } };
    }
    
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
