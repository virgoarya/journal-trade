"use client";

import { useState } from "react";
import { Zap, X, CreditCard, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface TokenRefillModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function TokenRefillModal({
  userId,
  isOpen,
  onClose,
}: TokenRefillModalProps) {
  const [loading, setLoading] = useState(false);

  const handleRefill = async () => {
    setLoading(true);
    try {
      // 1. Dapatkan Snap Token dari backend untuk token refill
      const res = await fetch("/api/v1/payment/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          amountIDR: 50_000, // Rp 50.000 untuk 100.000 token
          isBooster: false,
          orderType: "token_topup",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.token) {
        throw new Error(data.error || "Gagal dapatkan token pembayaran");
      }

      // 2. Load Midtrans Snap JS & redirect ke UI
      const snap = (window as any).snap;
      if (!snap) {
        throw new Error("Midtrans Snap tidak tersedia. Pastikan script sudah dimuat.");
      }

      snap.pay(data.token, {
        onSuccess: (result: any) => {
          toast.success("Token berhasil diisi ulang!");
          onClose();
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        },
        onPending: (result: any) => {
          toast.info("Pembayaran tertunda. Silahkan selesaikan di Midtrans.");
          const pollInterval = setInterval(async () => {
            try {
              const res = await fetch(`/api/v1/payment/status/${data.orderId}`);
              const status = await res.json();
              if (status.transaction_status === "settlement" || status.transaction_status === "capture") {
                clearInterval(pollInterval);
                toast.success("Pembayaran berhasil diproses!");
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
          toast.error("Gagal mengisi ulang token: " + (result?.message || "Cek log"));
        },
        onClose: () => {
          toast.info("Anda menutup halaman pembayaran.");
          onClose();
        },
      });
    } catch (err: any) {
      console.error("[TokenRefillModal] Error:", err.message);
      toast.error("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (process.env.NODE_ENV === "development") return null;
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-200">
      <div className="bg-[#0A0A0F] border border-[#D4AF37]/30 rounded-2xl w-full max-w-md shadow-2xl shadow-[#D4AF37]/10 animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="relative border-b border-[#D4AF37]/20 p-6 bg-gradient-to-r from-[#D4AF37]/5 to-transparent">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-[#D4AF37]/10 rounded-lg">
              <Zap className="w-6 h-6 text-[#D4AF37]" />
            </div>
            <h2 className="text-2xl font-bold text-white tracking-wide">
              Isi Ulang Token LLM
            </h2>
          </div>
          <p className="text-sm text-gray-400 ml-14">
            Dapatkan 100.000 token tambahan untuk melanjutkan AI Trading
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="bg-[#121218] rounded-xl p-5 border border-[#D4AF37]/20">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-[#D4AF37]/10 rounded-lg">
                <Zap className="w-8 h-8 text-[#D4AF37]" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white">Token LLM Refill</h3>
                <p className="text-sm text-gray-400">100.000 Token</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold font-mono text-[#D4AF37]">Rp 50.000</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-3 text-sm text-gray-300">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span>100.000 Token LLM tambahan</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-300">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span>AI Trading tetap aktif</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-300">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span>Multi-LLM Consensus</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-300">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span>Real-time Analysis</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[#D4AF37]/20 p-6 bg-[#121218]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-400">Total Pembayaran</p>
              <p className="text-2xl font-bold font-mono text-[#D4AF37]">
                Rp 50.000
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Metode Pembayaran</p>
              <p className="text-sm text-gray-300">Bank Transfer, E-Wallet</p>
            </div>
          </div>

          <button
            onClick={handleRefill}
            disabled={loading}
            className={`
              w-full py-4 rounded-xl font-bold text-base tracking-wide
              transition-all duration-300 flex items-center justify-center gap-2
              ${loading
                ? "bg-gray-600 cursor-not-allowed text-gray-400"
                : "bg-[#D4AF37] hover:bg-[#B5952F] text-black shadow-lg shadow-[#D4AF37]/30 hover:shadow-[#D4AF37]/50 hover:scale-[1.02] active:scale-[0.98]"
              }
            `}
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                Sedang Memproses...
              </>
            ) : (
              <>
                <CreditCard className="w-5 h-5" />
                Bayar Sekarang
              </>
            )}
          </button>

          <p className="text-xs text-center text-gray-500 mt-3">
            Pembayaran diproses melalui <span className="text-[#D4AF37]">Midtrans</span> dengan keamanan tingkat bank
          </p>
        </div>
      </div>
    </div>
  );
}
