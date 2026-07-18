"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { settingsService } from "@/services/settings.service";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = useSession();
  const [isGuildVerified, setIsGuildVerified] = useState<boolean | null>(null);
  const [guildCheckPending, setGuildCheckPending] = useState(true);
  const hasVerifiedRef = useRef(false);

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

  // Guild membership verification
  useEffect(() => {
    const verifyGuildMembership = async () => {
      // Skip if session still loading
      if (sessionPending) return;

      // Skip if no session
      if (!session) {
        router.push("/");
        return;
      }

      // Skip if already verified (guard against re-render loops)
      if (hasVerifiedRef.current) return;

      hasVerifiedRef.current = true;

      try {
        const res = await fetch("/api/v1/auth/verify-guild", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
        });

        const data = await res.json();

        if (!res.ok) {
          if (res.status === 403 || res.status === 401 || data.data?.isMember === false) {
            router.push("/akses-ditolak");
            return;
          }
          console.error("Guild verification failed:", data);
          router.push(`/akses-ditolak${res.status === 429 ? '?error=rate_limit' : '?error=verification_failed'}`);
          return;
        }

        if (data.success && data.data?.isMember) {
          setIsGuildVerified(true);
        } else {
          router.push("/akses-ditolak");
          return;
        }
      } catch (error) {
        console.error("Guild verification error:", error);
        router.push("/akses-ditolak?error=network");
      } finally {
        setGuildCheckPending(false);
      }
    };

    verifyGuildMembership();
  }, [session, sessionPending, router]);

  const closeMobileSidebar = () => {
    setMobileSidebarOpen(false);
  };

  // Loading state while checking guild membership
  if (sessionPending || guildCheckPending || isGuildVerified === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-void text-text-primary">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-accent-gold/30 border-t-accent-gold rounded-full animate-spin"></div>
          <p className="text-sm text-secondary animate-pulse">Memverifikasi akses...</p>
        </div>
      </div>
    );
  }

  // If not a guild member, don't render children (already redirected above)
  if (!isGuildVerified) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-bg-void text-text-primary">
      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
            onClick={closeMobileSidebar}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 z-50 md:hidden">
            <Sidebar isMobile={true} onClose={closeMobileSidebar} />
          </div>
        </>
      )}

      {/* Desktop Sidebar */}
      <div className="hidden md:block z-10 relative">
        <Sidebar />
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <Header onMenuClick={() => setMobileSidebarOpen(!mobileSidebarOpen)} />
        <main className="p-4 sm:p-6 md:p-8 flex-1 overflow-y-auto max-w-[1600px] w-full mx-auto relative">
          
          {/* Subtle Ambient Dust Layer */}
          <div className="pointer-events-none fixed inset-0 overflow-hidden z-[-1]" aria-hidden="true">
             <div className="absolute top-1/4 left-1/4 w-2 h-2 rounded-full bg-accent-gold/20 shadow-[0_0_10px_rgba(212,175,55,0.4)] animate-[floatDust_10s_ease-in-out_infinite]" />
             <div className="absolute top-2/3 left-1/3 w-1.5 h-1.5 rounded-full bg-accent-gold/10 shadow-[0_0_8px_rgba(212,175,55,0.2)] animate-[floatDust_14s_ease-in-out_infinite_2s]" />
             <div className="absolute top-1/2 right-1/4 w-2.5 h-2.5 rounded-full bg-accent-gold/30 shadow-[0_0_12px_rgba(212,175,55,0.5)] animate-[floatDust_12s_ease-in-out_infinite_4s]" />
             <div className="absolute top-3/4 right-1/3 w-1 h-1 rounded-full bg-accent-gold/20 shadow-[0_0_6px_rgba(212,175,55,0.3)] animate-[floatDust_16s_ease-in-out_infinite_1s]" />
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}
