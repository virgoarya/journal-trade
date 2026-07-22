import { apiClient, ApiResponse } from "@/lib/api-client";

export interface DevCheckResult {
  isDev: boolean;
}

export interface RegistrationStatus {
  needsRegistration: boolean;
  referralBroker: "exness" | "valetax" | null;
  referralEmail: string | null;
  referralVerified: boolean;
}

export interface SaveReferralDto {
  referralBroker: "exness" | "valetax";
  referralEmail: string;
}

export interface SaveReferralResult {
  referralBroker: "exness" | "valetax";
  referralEmail: string;
  referralVerified: boolean;
}

export class BrokerRegistrationService {
  private basePath = "/api/v1/broker-registration";

  async checkDevStatus(): Promise<ApiResponse<DevCheckResult>> {
    return apiClient.get<DevCheckResult>(`${this.basePath}/check-dev`);
  }

  async getStatus(): Promise<ApiResponse<RegistrationStatus>> {
    return apiClient.get<RegistrationStatus>(`${this.basePath}/status`);
  }

  async save(data: SaveReferralDto): Promise<ApiResponse<SaveReferralResult>> {
    return apiClient.post<SaveReferralResult>(`${this.basePath}/save`, data);
  }
}

export const brokerRegistrationService = new BrokerRegistrationService();
