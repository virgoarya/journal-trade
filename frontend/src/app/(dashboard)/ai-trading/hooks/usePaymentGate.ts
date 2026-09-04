import { useEffect, useState } from "react";

interface PaymentGateStatus {
  isRegistered: boolean;
  tokenBalance: number;
  hasInsufficientToken: boolean;
  isBooster: boolean;
  plan?: string;
  isUnlimited?: boolean;
}

export function usePaymentGate(userId: string | undefined) {
  const [status, setStatus] = useState<PaymentGateStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      setStatus({
        isRegistered: true,
        tokenBalance: Number.POSITIVE_INFINITY,
        hasInsufficientToken: false,
        isBooster: true,
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

    let cancelled = false;

    const fetchStatus = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/v1/payment/status-for-user/${userId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setStatus({
            isRegistered: data.isRegistered,
            tokenBalance: data.tokenBalance,
            hasInsufficientToken: data.hasInsufficientToken,
            isBooster: data.isBooster,
            plan: data.plan,
            isUnlimited: data.isUnlimited,
          });
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message);
          setStatus(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchStatus();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Helper untuk menentukan aksi yang dibutuhkan
  const gateAction: "none" | "package" | "token_topup" | null = status
    ? !status.isRegistered
      ? "package"
      : status.hasInsufficientToken && !status.isUnlimited
      ? "token_topup"
      : "none"
    : null;

  return { status, loading, error, gateAction };
}