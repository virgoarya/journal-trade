"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";

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
