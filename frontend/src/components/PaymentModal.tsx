"use client";

import { useState } from "react";
import { CreditCard, Zap, X, Sparkles, Shield, CheckCircle2, Crown, Flame } from "lucide-react";
import { toast } from "sonner";

type PackageType = "basic" | "pro" | "premium" | "token_topup";

interface PaymentModalProps {
  userId: string;
  isBooster: boolean;
  isOpen: boolean;
  onClose: () => void;
}

export default function PaymentModal({
  userId,
  isBooster,
  isOpen,
  onClose,
}: PaymentModalProps) {
  const [loading, setLoading] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<PackageType>("premium");

  // Harga dasar (sebelum diskon booster jika ada)
  const pricing = {
    basic: { price: 1_500_000, duration: "3 Bulan Akses" },
    pro: { price: 2_500_000, duration: "6 Bulan Akses" },
    premium: { price: 3_500_000, duration: "Lifetime Akses" },
    token_topup: { price: 50_000, duration: "Isi Ulang" },
  };

  const getEffectivePrice = (pkgKey: "basic" | "pro" | "premium") => {
    const rawPrice = pricing[pkgKey].price;
    return isBooster ? Math.round(rawPrice * 0.9) : rawPrice;
  };

  const handlePayment = async () => {
    setLoading(true);
    try {
      const amountIDR =
        selectedPackage === "token_topup"
          ? pricing.token_topup.price
          : getEffectivePrice(selectedPackage);

      // 1. Dapatkan Snap Token dari backend
      const res = await fetch("/api/v1/payment/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          amountIDR,
          isBooster,
          orderType: selectedPackage === "token_topup" ? "token_topup" : "package",
          packageType: selectedPackage === "token_topup" ? undefined : selectedPackage,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.token) {
        throw new Error(data.error || "Gagal mendapatkan token pembayaran");
      }

      // 2. Load Midtrans Snap JS & redirect ke UI
      const snap = (window as any).snap;
      if (!snap) {
        throw new Error("Midtrans Snap tidak tersedia. Pastikan script sudah dimuat.");
      }

      snap.pay(data.token, {
        onSuccess: (result: any) => {
          toast.success("✅ Pembayaran berhasil diproses!");
          onClose();
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        },
        onPending: (result: any) => {
          toast.info("⏳ Menunggu penyelesaian pembayaran di Midtrans.");
          const pollInterval = setInterval(async () => {
            try {
              const res = await fetch(`/api/v1/payment/status/${data.orderId}`);
              const status = await res.json();
              if (status.transaction_status === "settlement" || status.transaction_status === "capture") {
                clearInterval(pollInterval);
                toast.success("Pembayaran berhasil dikonfirmasi!");
                onClose();
                window.location.reload();
              }
            } catch (error) {
              console.error("Polling error:", error);
            }
          }, 5000);
          setTimeout(() => clearInterval(pollInterval), 300000);
        },
        onError: (result: any) => {
          toast.error("Gagal membayar: " + (result?.message || "Silakan coba lagi"));
        },
        onClose: () => {
          toast.info("Halaman pembayaran ditutup.");
          onClose();
        },
      });
    } catch (err: any) {
      console.error("[PaymentModal] Error:", err.message);
      toast.error("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (process.env.NODE_ENV === "development") return null;
  if (!isOpen) return null;

  const packages = [
    {
      type: "basic" as PackageType,
      icon: Zap,
      title: "Basic",
      subtitle: "3 Bulan Akses",
      price: getEffectivePrice("basic"),
      originalPrice: isBooster ? pricing.basic.price : null,
      highlight: false,
      badge: "STARTER",
      badgeClass: "bg-gray-800 text-gray-300 border-gray-700",
      accentColor: "from-gray-500/20 to-gray-800/10",
      borderColor: "border-gray-800",
      features: [
        { title: "Akses AI Trading Engine 3 Bulan", sub: "Pipeline otomatis multi-metodologi" },
        { title: "300.000 Token AI Agent", sub: "Bisa diisi ulang (Refill)" },
        { title: "Multi-LLM Consensus Engine", sub: "Qwen, Gemini, Claude" },
        { title: "Journal & Analytics Sync", sub: "Real-time sync dari MT5" },
      ],
    },
    {
      type: "pro" as PackageType,
      icon: Shield,
      title: "Pro",
      subtitle: "6 Bulan Akses + Free EA",
      price: getEffectivePrice("pro"),
      originalPrice: isBooster ? pricing.pro.price : null,
      highlight: false,
      badge: "POPULER",
      badgeClass: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      accentColor: "from-blue-500/20 to-blue-900/10",
      borderColor: "border-blue-500/40",
      features: [
        { title: "Akses AI Trading Engine 6 Bulan", sub: "Performa penuh tanpa pembatasan fitur" },
        { title: "300.000 Token AI Agent", sub: "Bisa diisi ulang (Refill)" },
        { title: "Multi-LLM Consensus Engine", sub: "Qwen, Gemini, Claude" },
        { title: "Free Profit Hunter EA 1 Bulan", sub: "Aktif langsung setelah pembayaran" },
        { title: "Journal & Analytics Sync", sub: "Real-time sync dari MT5" },
        { title: "Priority AI Engine Queue", sub: "Respon analisis real-time lebih cepat" },
      ],
    },
    {
      type: "premium" as PackageType,
      icon: Crown,
      title: "Premium",
      subtitle: "Lifetime + Unlimited AI",
      price: getEffectivePrice("premium"),
      originalPrice: isBooster ? pricing.premium.price : null,
      highlight: true,
      badge: "ULTIMATE BEST VALUE",
      badgeClass: "bg-gradient-to-r from-[#D4AF37] to-[#F3E5AB] text-black font-extrabold border-[#D4AF37]",
      accentColor: "from-[#D4AF37]/30 via-[#D4AF37]/10 to-transparent",
      borderColor: "border-[#D4AF37]",
      features: [
        { title: "Akses AI Trading Engine LIFETIME", sub: "Sekali bayar untuk selamanya" },
        { title: "FREE UNLIMITED Token AI Agent", sub: "Tanpa batas kuota token seumur hidup" },
        { title: "Multi-LLM Consensus Engine", sub: "Qwen, Gemini, Claude" },
        { title: "Profit Hunter EA MT5 Lifetime", sub: "Expert Advisor otomatis seumur hidup" },
        { title: "Journal & Analytics Sync", sub: "Real-time sync dari MT5" },
        { title: "Discord VIP Exclusive Channel", sub: "Grup private sinyal & insight hunter" },
        { title: "Direct Dev Support & Updates", sub: "Prioritas update skill & fitur baru" },
      ],
    },
  ];

  const selectedAmount =
    selectedPackage === "token_topup"
      ? pricing.token_topup.price
      : getEffectivePrice(selectedPackage as "basic" | "pro" | "premium");

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[9999] p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-[#0A0A0F] border border-[#D4AF37]/30 rounded-3xl w-full max-w-6xl shadow-[0_0_80px_rgba(212,175,55,0.12)] animate-in zoom-in-95 duration-300 relative my-auto overflow-hidden">
        
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-28 bg-gradient-to-b from-[#D4AF37]/15 to-transparent blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="relative border-b border-white/10 p-6 sm:px-10 sm:py-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 bg-[#D4AF37]/15 rounded-xl border border-[#D4AF37]/30 text-[#D4AF37]">
                <Sparkles className="w-5 h-5" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-wide font-mono">
                PILIH PAKET AI TRADING
              </h2>
              {isBooster && (
                <span className="hidden sm:inline-flex items-center gap-1.5 text-xs bg-emerald-500/15 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/30 font-bold">
                  <Flame className="w-3.5 h-3.5" />
                  BOOSTER DISCOUNT 10% AKTIF
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-gray-400">
              Aktifkan kecerdasan multi-LLM consensus & eksekusi instan langsung di akun MetaTrader 5 Anda
            </p>
          </div>

          <button
            onClick={onClose}
            className="self-end sm:self-center text-gray-400 hover:text-white transition-colors p-2.5 hover:bg-white/5 rounded-xl border border-transparent hover:border-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3-Column Card Selection */}
        <div className="p-6 sm:p-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {packages.map((pkg) => {
              const Icon = pkg.icon;
              const isSelected = selectedPackage === pkg.type;

              return (
                <div
                  key={pkg.type}
                  onClick={() => setSelectedPackage(pkg.type)}
                  className={`
                    relative rounded-2xl p-6 cursor-pointer transition-all duration-300 flex flex-col justify-between
                    ${isSelected
                      ? "bg-gradient-to-b " + pkg.accentColor + " border-2 " + (pkg.highlight ? "border-[#D4AF37] shadow-[0_0_35px_rgba(212,175,55,0.25)]" : "border-accent-gold shadow-lg") + " scale-[1.02]"
                      : "bg-[#121218]/80 hover:bg-[#181822] border border-white/10 hover:border-white/20 hover:scale-[1.01]"
                    }
                  `}
                >
                  {/* Top Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-3 rounded-xl ${isSelected ? "bg-white/10 text-[#D4AF37]" : "bg-white/5 text-gray-400"}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className={`text-[11px] uppercase tracking-wider px-3 py-1 rounded-full border ${pkg.badgeClass}`}>
                      {pkg.badge}
                    </span>
                  </div>

                  {/* Title & Subtitle */}
                  <div>
                    <h3 className="text-xl font-bold text-white tracking-wide">{pkg.title}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{pkg.subtitle}</p>

                    {/* Price Block */}
                    <div className="my-5 pb-5 border-b border-white/10">
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl sm:text-4xl font-extrabold font-mono text-[#D4AF37] tracking-tight">
                          Rp {pkg.price.toLocaleString("id-ID")}
                        </span>
                      </div>
                      {pkg.originalPrice && (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500 line-through font-mono">
                            Rp {pkg.originalPrice.toLocaleString("id-ID")}
                          </span>
                          <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                            Hemat 10%
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Features List */}
                    <ul className="space-y-3 mb-6">
                      {pkg.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 text-xs text-gray-300">
                          <CheckCircle2 className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isSelected ? "text-[#D4AF37]" : "text-gray-500"}`} />
                          <div>
                            <p className="font-semibold text-white leading-tight">{feat.title}</p>
                            <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{feat.sub}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Select Indicator Button */}
                  <div className="mt-auto pt-2">
                    <div
                      className={`
                        w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-center transition-all
                        ${isSelected
                          ? pkg.highlight
                            ? "bg-gradient-to-r from-[#D4AF37] to-[#F3E5AB] text-black shadow-md shadow-[#D4AF37]/30"
                            : "bg-accent-gold text-black shadow-md shadow-accent-gold/20"
                          : "bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10"
                        }
                      `}
                    >
                      {isSelected ? "✓ Paket Terpilih" : "Pilih Paket"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Checkout Bar */}
        <div className="border-t border-white/10 p-6 sm:px-10 bg-[#0E0E14] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 hidden sm:block">
              <CreditCard className="w-6 h-6 text-[#D4AF37]" />
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Total Pembayaran</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold font-mono text-[#D4AF37]">
                  Rp {selectedAmount.toLocaleString("id-ID")}
                </span>
                <span className="text-xs text-gray-400 font-mono">
                  ({pricing[selectedPackage as "basic" | "pro" | "premium"]?.duration || "1x Pembayaran"})
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePayment}
              disabled={loading}
              className={`
                w-full sm:w-auto px-8 py-4 rounded-2xl font-bold text-sm tracking-widest uppercase transition-all duration-300 flex items-center justify-center gap-2.5
                ${loading
                  ? "bg-gray-700 cursor-not-allowed text-gray-400"
                  : "bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#D4AF37] hover:brightness-110 text-black shadow-[0_0_25px_rgba(212,175,55,0.35)] hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                }
              `}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Memproses Midtrans...</span>
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  <span>Lanjutkan Pembayaran</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
