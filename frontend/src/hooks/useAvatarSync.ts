"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/lib/auth-client";

/**
 * Avatar source for the current session.
 *
 * The session image is used by default. If it fails to load (an expired Discord
 * CDN hash returns 404), call `refresh()` so the backend re-fetches a fresh URL
 * from Discord and stores it. Refreshing is on-demand, never on every page
 * load, so the Discord API is not hit needlessly or rate-limited.
 */
export function useAvatarSync(): {
  avatarUrl: string | null;
  syncing: boolean;
  refresh: () => Promise<void>;
} {
  const { data: session } = useSession();
  const sessionImage = session?.user?.image ?? null;

  const [refreshed, setRefreshed] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // A newer session image supersedes anything refreshed earlier.
  useEffect(() => {
    setRefreshed(null);
  }, [sessionImage]);

  const refresh = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/v1/auth/sync-avatar", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) return;
      const json = await res.json();
      const next: string | null = json?.data?.image ?? null;
      if (next) setRefreshed(next);
    } catch {
      // Network failure: keep whatever the session already had.
    } finally {
      setSyncing(false);
    }
  }, []);

  return { avatarUrl: refreshed ?? sessionImage, syncing, refresh };
}
