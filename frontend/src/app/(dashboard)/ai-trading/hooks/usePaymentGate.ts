import { useEffect, useState, useCallback } from "react";

interface PaymentGateStatus {
  isRegistered: boolean;
  tokenBalance: number;
  hasInsufficientToken: boolean;
  isBooster: boolean;
  /**
   * Backend contract for GET /api/v1/payment/status-for-user/:userId.
   * The server returns `hasAccess` (active registration + unexpired/lifetime
   * access) and does NOT send `isPaid`. `isPaid` is the derived gate flag and
   * MUST be mapped from `hasAccess` — otherwise it is always `undefined`
   * (falsy) and every paid package holder is gated to the package purchase.
   */
  isPaid: boolean;
  hasAccess?: boolean;
  plan?: string;
  isUnlimited?: boolean;
}

export function usePaymentGate(userId: string | undefined, forceFull: boolean = false) {
  const [status, setStatus] = useState<PaymentGateStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (process.env.NODE_ENV === "development" && !forceFull) {
      setStatus({
        isRegistered: true,
        tokenBalance: Number.POSITIVE_INFINITY,
        hasInsufficientToken: false,
        isBooster: true,
        isPaid: true,
        hasAccess: true,
        isUnlimited: true,
        plan: "dev",
      });
      setError(null);
      setLoading(false);
      return;
    }

    if (!userId) {
      setStatus(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/payment/status-for-user/${userId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStatus({
        isRegistered: data.isRegistered,
        tokenBalance: data.tokenBalance,
        hasInsufficientToken: data.hasInsufficientToken,
        isBooster: data.isBooster,
        // The endpoint has no `isPaid` field; derive it from `hasAccess` so a
        // paid, unexpired/lifetime holder resolves to "none".
        isPaid: data.isPaid ?? data.hasAccess === true,
        hasAccess: data.hasAccess,
        plan: data.plan,
        isUnlimited: data.isUnlimited,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unable to load payment status");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [userId, forceFull]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStatus();

    // Periodic refresh every 30 seconds to keep state in sync with backend
    const intervalId = setInterval(fetchStatus, 30000);

    return () => {
      clearInterval(intervalId);
    };
  }, [fetchStatus]);

  // Helper untuk menentukan aksi yang dibutuhkan
  const gateAction: "none" | "package" | null = status
    ? status.isPaid ? "none" : "package"
    : null

  const refetch = () => {
    fetchStatus();
  };

  return { status, loading, error, gateAction, refetch };
}