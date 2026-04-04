import { apiClient } from "@/lib/api-client";

export interface UserSettingsData {
  appearance: {
    theme: "dark" | "light" | "system";
    accentColor: string;
    soundEnabled: boolean;
  };
  notifications: {
    tradeAlerts: boolean;
    aiReviews: boolean;
    weeklyReports: boolean;
    achievements: boolean;
  };
}

export const settingsService = {
  getSettings: async () => {
    return apiClient.get<UserSettingsData>("/api/v1/settings");
  },

  updateSettings: async (settings: Partial<UserSettingsData>) => {
    return apiClient.patch<UserSettingsData>("/api/v1/settings", settings);
  }
};
