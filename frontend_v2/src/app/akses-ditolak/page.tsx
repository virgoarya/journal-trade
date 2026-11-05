"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession, signOut } from "@/lib/auth-client";
import { apiClient } from "@/lib/api-client";

export default function AccessDeniedPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isPending && !session) {
      router.push("/");
    }
  }, [session, isPending, router]);

  const handleVerify = async () => {
    setIsVerifying(true);
    setError(null);
    try {
      const response = await apiClient.get<{ isMember: boolean }>('/api/v1/auth/verify-guild');
      if (response.success && response.data?.isMember) {
        // Membership confirmed, redirect to dashboard
        router.push("/dashboard");
      } else {
        setError("Kamu belum terdeteksi di server Hunter Trades. Pastikan sudah join dan coba lagi.");
      }
    } catch (err) {
      setError("Gagal memverifikasi. Silakan coba lagi nanti.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLogout = async () => {
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/");
        },
      },
    });
  };

  // Loading state for session
  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#313338]">
        <div className="w-8 h-8 border-4 border-[#5865F2]/20 border-t-[#5865F2] rounded-full animate-spin"></div>
      </div>
    );
  }

  // If not authenticated, don't render (will redirect)
  if (!session) {
    return null;
  }

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden"
      style={{ backgroundColor: '#313338' }}
    >
      {/* Ambient Blurple Orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full blur-[200px] pointer-events-none animate-pulse"
        style={{ backgroundColor: 'rgba(88,101,242,0.08)' }} />
      <div className="absolute bottom-[-15%] right-[-5%] w-[400px] h-[400px] rounded-full blur-[180px] pointer-events-none animate-pulse"
        style={{ backgroundColor: 'rgba(88,101,242,0.05)', animationDelay: '2s' }} />

      {/* Access Denied Card — Matches Login Design */}
      <main className="relative z-10 flex flex-col items-center w-full max-w-[420px] px-10 py-12 text-center animate-in fade-in zoom-in-95 duration-1000"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(43,45,49,0.6) 40%, rgba(30,31,34,0.95) 100%)',
          backdropFilter: 'blur(28px) saturate(140%)',
          WebkitBackdropFilter: 'blur(28px) saturate(140%)',
          borderTop: '1px solid rgba(255,255,255,0.2)',
          borderLeft: '1px solid rgba(255,255,255,0.12)',
          borderRight: '1px solid rgba(0,0,0,0.5)',
          borderBottom: '1px solid rgba(0,0,0,0.7)',
          borderRadius: '24px',
          boxShadow: 'inset 1px 1px 2px rgba(255,255,255,0.1), inset -1px -1px 4px rgba(0,0,0,0.6), 0 6px 12px rgba(0,0,0,0.5), 0 24px 48px rgba(0,0,0,0.8), 0 0 80px rgba(212,175,55,0.04)',
        }}
      >
        {/* Logo — with gold heartbeat */}
        <div className="mb-6 relative">
          <div className="absolute inset-0 rounded-full bg-[#D4AF37] blur-[40px]"
            style={{ animation: 'glowBreath 3s ease-in-out infinite', opacity: 0.15 }} />
          <img 
            src="/logo.png" 
            alt="Hunter Trades Logo" 
            className="relative w-24 h-auto mx-auto object-contain"
            style={{ animation: 'logoPulse 3s ease-in-out infinite' }}
          />
        </div>

        <h1 className="text-2xl md:text-3xl font-bold tracking-[0.1em] mb-2 uppercase text-white"
        >
          AKSES DIBATASI
        </h1>

        <p className="text-[10px] tracking-[0.3em] uppercase font-semibold mb-8 text-[#B5BAC1]"
        >
          Hanya Untuk Member Hunter Trades
        </p>

        <p className="text-[14px] leading-relaxed mb-8 max-w-[300px] text-[#949BA4]"
        >
          Maaf, kamu belum bergabung di server Discord **Hunter Trades**. Pastikan kamu sudah bergabung untuk menggunakan platform ini.
        </p>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[12px]">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="w-full space-y-4">
          {/* Join Button */}
          <a
            href="https://discord.gg/eAhtEU44tQ"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full h-[48px] rounded-[8px] bg-[#5865F2] text-white font-semibold flex items-center justify-center space-x-2 transition-all hover:bg-[#4752C4] active:scale-[0.97]"
          >
            <span>Gabung Discord Hunter Trades</span>
          </a>

          {/* Verify Button */}
          <button
            onClick={handleVerify}
            disabled={isVerifying}
            className="w-full h-[48px] rounded-[8px] border border-[#5865F2]/30 text-[#5865F2] font-semibold flex items-center justify-center space-x-2 transition-all hover:bg-[#5865F2]/10 active:scale-[0.97] disabled:opacity-50"
          >
            {isVerifying ? (
              <div className="w-5 h-5 border-2 border-[#5865F2]/20 border-t-[#5865F2] rounded-full animate-spin"></div>
            ) : (
              <span>Sudah Join? Verifikasi Ulang</span>
            )}
          </button>
        </div>

        {/* Separator */}
        <div className="w-full h-[1px] my-8"
          style={{ background: 'linear-gradient(to right, transparent, rgba(88,101,242,0.15), transparent)' }} />

        {/* Secondary Actions */}
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={handleLogout}
            className="text-[12px] text-[#B5BAC1] hover:text-white transition-all uppercase tracking-widest font-medium"
          >
            Ganti Akun Discord
          </button>
          
          <p className="text-[9px] uppercase tracking-[0.25em] text-[#6D6F78]">
            Elite Ledger v2.0.4 - Security Encrypted
          </p>
        </div>
      </main>
    </div>
  );
}

