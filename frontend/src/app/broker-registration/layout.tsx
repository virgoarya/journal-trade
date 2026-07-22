"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { settingsService } from "@/services/settings.service";

export default function BrokerRegistrationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = useSession();
  const [guildVerified, setGuildVerified] = useState<boolean | null>(null);
  const hasVerifiedRef = useRef(false);

  useEffect(() => {
    const applyGlobalSettings = async () => {
      try {
        const res = await settingsService.getSettings();
        if (res.success && res.data) {
          const { appearance } = res.data;
          document.documentElement.classList.toggle("light", appearance.theme === "light");
          document.documentElement.style.setProperty("--color-accent-gold", appearance.accentColor);
          document.documentElement.style.setProperty("--color-accent-gold-dim", `${appearance.accentColor}88`);
          localStorage.setItem("hunter-trades-theme", appearance.theme);
          localStorage.setItem("hunter-trades-accent", appearance.accentColor);
        }
      } catch (e) {
        console.error("BrokerRegistrationLayout: Failed to load global settings", e);
      }
    };
    applyGlobalSettings();
  }, []);

  useEffect(() => {
    if (sessionPending) return;

    if (!session) {
      router.push("/");
      return;
    }

    if (hasVerifiedRef.current) return;
    hasVerifiedRef.current = true;

    (async () => {
      try {
        const res = await fetch("/api/v1/auth/verify-guild", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });

        const data = await res.json();

        if (!res.ok) {
          if (res.status === 403 || res.status === 401 || data.data?.isMember === false) {
            router.push("/akses-ditolak");
            return;
          }
          router.push(`/akses-ditolak${res.status === 429 ? "?error=rate_limit" : "?error=verification_failed"}`);
          return;
        }

        if (data.success && data.data?.isMember) {
          setGuildVerified(true);
        } else {
          router.push("/akses-ditolak");
          return;
        }
      } catch {
        router.push("/akses-ditolak?error=network");
      }
    })();
  }, [session, sessionPending, router]);

  if (sessionPending || guildVerified === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-void text-text-primary">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-accent-gold/30 border-t-accent-gold rounded-full animate-spin"></div>
          <p className="text-sm text-text-muted animate-pulse">Memverifikasi akses...</p>
        </div>
      </div>
    );
  }

  if (!guildVerified) return null;

  return <div className="h-screen overflow-hidden bg-bg-void">{children}</div>;
}
