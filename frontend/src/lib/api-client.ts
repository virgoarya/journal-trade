import { authClient } from "./auth-client";

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export class ApiClient {
  private baseUrl: string;

  constructor() {
    // Use relative paths for same-origin requests (Next.js API routes proxy)
    this.baseUrl = "";
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      // Get session token
      const { data: session } = await authClient.getSession();

      const headers: HeadersInit = {
        "Content-Type": "application/json",
        ...options.headers,
      };

      // Add auth header if session exists
      if (session?.user?.id) {
        (headers as Record<string, string>)["Authorization"] = `Bearer ${session.user.id}`;
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
        credentials: "include",
      });

      const contentType = response.headers.get("content-type");
      let data;

      if (contentType?.includes("application/json")) {
        data = await response.json();
      }

      if (!response.ok) {
        return {
          success: false,
          error: data?.error?.message || data?.message || `HTTP ${response.status}`,
          data,
        };
      }

      // Unwrap backend's { success, data } structure if it exists
      const unwrappedData = (data && typeof data === 'object' && 'success' in data) 
        ? (data as any).data 
        : data;

      return {
        success: true,
        data: unwrappedData ?? null,
        message: (data as any)?.message,
      };
    } catch (error: any) {
      console.error(`API Error (${endpoint}):`, error);
      return {
        success: false,
        error: error.message || "Network error occurred",
      };
    }
  }

  // GET
  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "GET" });
  }

  // POST
  async post<T>(endpoint: string, body: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  // PATCH
  async patch<T>(endpoint: string, body: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }

  // PUT
  async put<T>(endpoint: string, body: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  }

  // DELETE
  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "DELETE" });
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
