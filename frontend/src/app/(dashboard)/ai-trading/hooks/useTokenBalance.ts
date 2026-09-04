import { usePaymentGate } from "./usePaymentGate";

/**
 * Hook untuk memeriksa apakah user memiliki token cukup.
 * Reuses the payment gate as the single source of truth.
 */
export function useTokenBalance(userId: string) {
  const { status, loading } = usePaymentGate(userId);

  return {
    hasInsufficient: status?.hasInsufficientToken ?? false,
    loading,
  };
}
