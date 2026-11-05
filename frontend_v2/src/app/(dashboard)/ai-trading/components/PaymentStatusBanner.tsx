"use client";

import { useEffect, useState } from "react";
import { Crown, Calendar, RefreshCw } from "lucide-react";
import { PAYMENT_ENDPOINTS } from "@/lib/payment-endpoints";

interface PaymentStatusBannerProps {
  userId: string | undefined;
  onUpgrade: () => void;
  status?: PaymentStatus | null;
}

interface PaymentStatus {
  isRegistered: boolean;
  hasAccess: boolean;
  isBooster: boolean;
  plan?: string;
  accessEndDate?: string;
}

export function PaymentStatusBanner({ userId, onUpgrade, status: propStatus }: PaymentStatusBannerProps) {
  const [internalStatus, setInternalStatus] = useState<PaymentStatus | null>(null);

  useEffect(() => {
    // If parent provides status, sync directly and avoid duplicate polling
    if (propStatus !== undefined) {
      setInternalStatus(propStatus);
      return;
    }

    if (process.env.NODE_ENV === "development" && !new URLSearchParams(window.location.search).get("full")) {
      setInternalStatus({
        isRegistered: true,
        hasAccess: true,
        isBooster: true,
        plan: "dev",
      });
      return;
    }

    if (!userId) return;

    let mounted = true;
    const fetchStatus = async () => {
      try {
        const res = await fetch(PAYMENT_ENDPOINTS.statusForUser(userId));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (mounted) {
          setInternalStatus({
            isRegistered: data.isRegistered,
            hasAccess: data.hasAccess,
            isBooster: data.isBooster,
            plan: data.plan,
            accessEndDate: data.accessEndDate,
          });
        }
      } catch (error) {
        console.error("[PaymentStatusBanner] Error:", error);
        if (mounted) setInternalStatus(null);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [userId, propStatus]);

  const status = propStatus !== undefined ? propStatus : internalStatus;

  if (!status) return null;

  const getPlanDisplay = (plan?: string) => {
    if (!plan) return "Basic";
    const p = plan.toLowerCase();
    if (p.includes("premium")) return "Premium";
    if (p.includes("pro")) return "Pro";
    return "Basic";
  };

  const getPlanColor = (plan?: string) => {
    const p = (plan ?? "").toLowerCase();
    if (p.includes("premium")) return "from-[#D4AF37] to-[#F3E5AB]";
    if (p.includes("pro")) return "from-blue-500 to-sky-400";
    return "from-gray-400 to-gray-500";
  };

  const getAccessStatus = () => {
    if (status.hasAccess && !status.accessEndDate) {
      return { label: "Akses seumur hidup", color: "text-emerald-400" };
    }
    if (status.hasAccess && status.accessEndDate) {
      const exp = new Date(status.accessEndDate);
      const now = new Date();
      if (exp > now) {
        const daysLeft = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return { label: `Akses Aktif (${daysLeft} Hari)`, color: "text-emerald-400" };
      }
      return { label: "Akses Kedaluwarsa", color: "text-red-400" };
    }
    return { label: "Belum Berlangganan", color: "text-yellow-400" };
  };

  const accessStatus = getAccessStatus();
  const planDisplay = getPlanDisplay(status.plan);
  const now = new Date();
  now.setMilliseconds(now.getMilliseconds() - 1); // Grace period: 1ms buffer
  const needsSubscription = !status.hasAccess || (status.accessEndDate && new Date(status.accessEndDate) <= now);

  return (
    <div className="glass border border-[#D4AF37]/30 rounded-xl p-5 mb-4 relative overflow-hidden group hover:border-[#D4AF37]/50 transition-all duration-300">
      <div className="absolute inset-0 bg-gradient-to-r from-[#D4AF37]/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

      <div className="relative z-10">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-[#D4AF37]/10 rounded-lg border border-[#D4AF37]/20">
                <Crown className="w-5 h-5 text-[#D4AF37]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                  Status Akses
                  {status.isBooster && (
                    <span className="inline-flex items-center gap-1 text-xs bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-400 px-2 py-0.5 rounded-full border border-yellow-500/30">
                      <Crown className="w-3 h-3" />
                      BOOSTER
                    </span>
                  )}
                </h3>
                <p className={`text-xs font-medium mt-1 ${accessStatus.color}`}>
                  {accessStatus.label}
                </p>
                <div className="inline-flex items-center gap-1.5 mt-1 px-3 py-1.5 rounded-lg bg-gradient-to-r text-xs font-semibold text-white border border-white/10">
                  <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${getPlanColor(status.plan)}`} />
                  Paket {planDisplay}
                </div>
                {status.accessEndDate && status.hasAccess && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-400">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      Akses sampai: {new Date(status.accessEndDate).toLocaleDateString("id-ID", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2">
            <RefreshCw
              className="w-4 h-4 text-gray-500 hover:text-gray-300 cursor-pointer transition-colors"
              onClick={onUpgrade}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onUpgrade();
                }
              }}
              aria-label="Buka modal pembayaran untuk upgrade paket"
            />
          </div>
        </div>

        {needsSubscription && (
          <button
            onClick={onUpgrade}
            className="w-full py-2.5 bg-gradient-to-r from-[#D4AF37] to-[#F3E5AB] text-black rounded-lg font-bold text-sm tracking-wide transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-[#D4AF37]/20 hover:brightness-105 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Crown className="w-4 h-4" />
            Beli Paket
          </button>
        )}
      </div>
    </div>
  );
}
