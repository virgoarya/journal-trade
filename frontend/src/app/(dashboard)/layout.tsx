"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { useEffect } from "react";
import { settingsService } from "@/services/settings.service";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Global Settings Application
  useEffect(() => {
    const applyGlobalSettings = async () => {
      try {
        const res = await settingsService.getSettings();
        if (res.success && res.data) {
          const { appearance } = res.data;
          
          // Theme
          document.documentElement.classList.toggle("light", appearance.theme === "light");
          
          // Accent
          document.documentElement.style.setProperty("--color-accent-gold", appearance.accentColor);
          document.documentElement.style.setProperty("--color-accent-gold-dim", `${appearance.accentColor}88`);
          
          // Cache in localStorage for immediate load next time
          localStorage.setItem("hunter-trades-theme", appearance.theme);
          localStorage.setItem("hunter-trades-accent", appearance.accentColor);
        }
      } catch (e) {
        console.error("DashboardLayout: Failed to load global settings", e);
      }
    };

    applyGlobalSettings();
  }, []);

  return (
    <div className="flex min-h-screen bg-bg-void text-text-primary">
      {/* Sidebar - Fixed width, sticky height */}
      <Sidebar />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header - Sticky top */}
        <Header />

        {/* Dynamic Content Area */}
        <main className="p-8 flex-1 overflow-y-auto max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
