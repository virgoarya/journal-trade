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
    options: RequestInit = {},
    timeoutMs: number = 60000
  ): Promise<ApiResponse<T>> {
    try {
      const headers: HeadersInit = {
        "Content-Type": "application/json",
        ...options.headers,
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get("content-type");
      let data: any;

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
      const isWrapped = data && typeof data === "object" && "success" in data;
      if (isWrapped && data.success === false) {
        return {
          success: false,
          error: data.error || data.message || `Request failed (${endpoint})`,
          data: data.data ?? null,
        };
      }

      const unwrappedData = isWrapped ? data.data : data;

      return {
        success: true,
        data: unwrappedData ?? null,
        message: data?.message,
      };
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.warn(`API Request Aborted (${endpoint}): ${error.message}`);
        return {
          success: false,
          error: "Request was aborted",
        };
      }
      console.error(`API Error (${endpoint}):`, error);
      return {
        success: false,
        error: error.message || "Network error occurred",
      };
    }
  }

  // GET
  async get<T>(endpoint: string, timeoutMs: number = 60000): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "GET" }, timeoutMs);
  }

  // POST
  async post<T>(endpoint: string, body: any, timeoutMs: number = 60000): Promise<ApiResponse<T>> {
    return this.request<T>(
      endpoint,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
      timeoutMs
    );
  }

  // PATCH
  async patch<T>(endpoint: string, body: any, timeoutMs: number = 60000): Promise<ApiResponse<T>> {
    return this.request<T>(
      endpoint,
      {
        method: "PATCH",
        body: JSON.stringify(body),
      },
      timeoutMs
    );
  }

  // PUT
  async put<T>(endpoint: string, body: any, timeoutMs: number = 60000): Promise<ApiResponse<T>> {
    return this.request<T>(
      endpoint,
      {
        method: "PUT",
        body: JSON.stringify(body),
      },
      timeoutMs
    );
  }

  // DELETE
  async delete<T>(endpoint: string, timeoutMs: number = 60000): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "DELETE" }, timeoutMs);
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
