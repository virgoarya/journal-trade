"use client";

import { useEffect, useState } from "react";
import { CreditCard, Zap, AlertCircle, Crown, CheckCircle2 } from "lucide-react";

interface PaymentStatusBannerProps {
  userId: string | undefined;
  onTopup: () => void;
}

interface PaymentStatus {
  isRegistered: boolean;
  tokenBalance: number;
  hasInsufficientToken: boolean;
  isBooster: boolean;
  plan?: string;
  accessEndDate?: string;
  isUnlimited?: boolean;
}

export function PaymentStatusBanner({ userId, onTopup }: PaymentStatusBannerProps) {
  if (process.env.NODE_ENV === "development") return null;

  const [status, setStatus] = useState<PaymentStatus | null>(null);

  useEffect(() => {
    if (!userId) return;

    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/v1/payment/status-for-user/${userId}`);
        if (!res.ok) throw new Error("Failed to fetch payment status");
        const data = await res.json();
        setStatus(data);
      } catch (error) {
        console.error("[PaymentStatusBanner] Error:", error);
      }
    };

    fetchStatus();
    // Refresh setiap 30 detik
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  if (!status) return null;

  // Warna dan status berdasarkan kondisi
  const getTokenStatus = () => {
    if (status.tokenBalance === 0) {
      return {
        color: "text-red-400",
        bg: "bg-red-500/10",
        border: "border-red-500/30",
        icon: AlertCircle,
        label: "Token Habis",
        message: "Token LLM Anda telah habis. Isi ulang untuk melanjutkan AI Trading.",
      };
    } else if (status.tokenBalance < 10) {
      return {
        color: "text-yellow-400",
        bg: "bg-yellow-500/10",
        border: "border-yellow-500/30",
        icon: AlertCircle,
        label: "Token Hampir Habis",
        message: "Token LLM Anda tinggal sedikit. Segera isi ulang.",
      };
    } else {
      return {
        color: "text-green-400",
        bg: "bg-green-500/10",
        border: "border-green-500/30",
        icon: CheckCircle2,
        label: "Token Cukup",
        message: "Token LLM Anda masih mencukupi untuk trading.",
      };
    }
  };

  const tokenStatus = getTokenStatus();
  const StatusIcon = tokenStatus.icon;

  return (
    <div className="glass border border-[#D4AF37]/30 rounded-xl p-5 relative overflow-hidden group hover:border-[#D4AF37]/50 transition-all duration-300">
      {/* Background glow effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#D4AF37]/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

      <div className="relative z-10">
        <div className="flex items-start justify-between gap-4 mb-4">
          {/* Left: Status Info */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-2 ${tokenStatus.bg} rounded-lg border ${tokenStatus.border}`}>
                <StatusIcon className={`w-5 h-5 ${tokenStatus.color}`} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                  Status Pembayaran
                  {status.isBooster && (
                    <span className="inline-flex items-center gap-1 text-xs bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-400 px-2 py-0.5 rounded-full border border-yellow-500/30">
                      <Crown className="w-3 h-3" />
                      BOOSTER
                    </span>
                  )}
                </h3>
                 <p className="text-xs text-gray-400">
                   {status.isRegistered ? `Paket: ${status.plan || "Basic"}` : "Pending Registration"}
                 </p>
              </div>
            </div>

            <p className={`text-xs ${tokenStatus.color} mb-3`}>
              {tokenStatus.message}
            </p>
          </div>

          {/* Right: Token Balance */}
          <div className="text-right">
            <div className="flex items-center justify-end gap-1.5 mb-1">
              <Zap className="w-4 h-4 text-[#D4AF37]" />
              <span className="text-xs text-gray-400">Token LLM</span>
            </div>
             <p className="text-3xl font-bold font-mono text-[#D4AF37] leading-none">
               {status.isUnlimited ? "∞" : status.tokenBalance}
             </p>
          </div>
        </div>

        {/* Action Button */}
        {status.hasInsufficientToken && (
          <button
            onClick={onTopup}
            className="w-full py-2.5 bg-[#D4AF37] hover:bg-[#B5952F] text-black rounded-lg font-bold text-sm tracking-wide transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-[#D4AF37]/20 hover:shadow-[#D4AF37]/40 hover:scale-[1.02] active:scale-[0.98]"
          >
            <CreditCard className="w-4 h-4" />
            Isi Ulang Token Sekarang
          </button>
        )}

        {/* Info bar */}
        <div className="mt-3 pt-3 border-t border-[#D4AF37]/10 flex items-center justify-between text-xs">
          <span className="text-gray-500">
            {status.isRegistered ? "✓ Registered" : "⚠ Pending"}
          </span>
           <span className="text-gray-500">
             {status.isBooster ? "💎 Booster Member" : "👤 Regular Member"}
           </span>
           {status.accessEndDate && (
             <span className="text-gray-500">
               | Akses sampai: {new Date(status.accessEndDate).toLocaleDateString("id-ID")}
             </span>
           )}
        </div>
      </div>
    </div>
  );
}
