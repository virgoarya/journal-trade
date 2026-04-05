"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { useEffect, useState } from "react";
import { settingsService } from "@/services/settings.service";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Mobile sidebar state
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

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

  // Close mobile sidebar when clicking outside
  const closeMobileSidebar = () => {
    setMobileSidebarOpen(false);
  };

  return (
    <div className="flex min-h-screen bg-bg-void text-text-primary">
      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
            onClick={closeMobileSidebar}
            aria-hidden="true"
          />
          {/* Mobile sidebar container */}
          <div className="fixed inset-y-0 left-0 z-50 md:hidden">
            <Sidebar isMobile={true} onClose={closeMobileSidebar} />
          </div>
        </>
      )}

      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header - Sticky top */}
        <Header onMenuClick={() => setMobileSidebarOpen(!mobileSidebarOpen)} />

        {/* Dynamic Content Area */}
        <main className="p-4 sm:p-6 md:p-8 flex-1 overflow-y-auto max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
