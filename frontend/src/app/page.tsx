"use client";

import { useState } from "react";
import { signIn } from "@/lib/auth-client";
import { logger } from "@/lib/logger";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDiscordLogin = async () => {
    try {
      setError(null);
      setLoading(true);

      const healthRes = await fetch("/api/health").catch(() => null);
      if (!healthRes || (!healthRes.ok && healthRes.status !== 503)) {
        throw new Error("Server/Database sedang inisialisasi, silakan coba beberapa detik lagi");
      }
      if (healthRes.status === 503) {
        const body = await healthRes.json().catch(() => null);
        throw new Error(body?.error || "Database sedang menghubungkan, silakan tunggu beberapa saat");
      }

      const callbackURL =
        typeof window !== "undefined" && window.location.origin && window.location.origin !== "null"
          ? `${window.location.origin}/dashboard`
          : "/dashboard";

      const res = await signIn.social({
        provider: "discord",
        callbackURL,
      });

      if (res?.error) {
        throw new Error(res.error.message || "Gagal menghubungi layanan autentikasi Discord");
      }
    } catch (err: any) {
      const message = err?.message || String(err);
      setError(`Login gagal: ${message}`);
      logger.error("[Login] Discord sign-in failed:", err);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 w-screen h-screen flex items-center justify-center bg-login-bg overflow-hidden select-none">
      
      {/* Ambient Glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-login-brand-glow blur-[100px] pointer-events-none animate-pulse" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-login-brand-glow blur-[100px] pointer-events-none animate-pulse" style={{ animationDelay: '2s' }} />

      {/* Login Card */}
      <main className="relative z-10 flex flex-col items-center w-full max-w-[400px] mx-4 p-8 sm:p-10 text-center bg-login-card-mid backdrop-blur-xl border border-login-card-top rounded-3xl shadow-2xl shadow-black/50">
        
        {/* Logo */}
        <div className="mb-6 relative">
          <div className="absolute inset-0 rounded-full bg-amber-500/20 blur-xl animate-pulse" />
          <img 
            src="/logo.png" 
            alt="Hunter Trades Logo" 
            className="relative w-20 h-auto mx-auto object-contain drop-shadow-md"
          />
        </div>
        
        <h1 className="text-2xl font-black tracking-widest mb-1 text-white uppercase font-sans">
          HUNTER TRADES
        </h1>

        <p className="text-[11px] tracking-[0.3em] uppercase font-bold text-amber-400 mb-6">
          Elite Ledger
        </p>
        
        <p className="text-xs text-zinc-300 leading-relaxed mb-8 max-w-[260px]">
          Exclusive trading journal for Hunter Trades members
        </p>

        {/* Separator */}
        <div className="w-full h-[1px] mb-8 bg-gradient-to-r from-transparent via-login-brand/40 to-transparent" />

        {/* Login Button */}
        <button 
          id="discord-login-btn"
          type="button"
          onClick={handleDiscordLogin}
          disabled={loading}
          aria-busy={loading}
          className="w-full h-12 rounded-xl font-semibold text-sm flex items-center justify-center space-x-3 transition-all duration-200 group cursor-pointer bg-login-brand hover:bg-login-brand/85 text-white shadow-lg shadow-login-brand/25 active:scale-[0.98] disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-white/50"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"
            className="group-hover:scale-110 transition-transform duration-200">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.419c0 1.334-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.419c0 1.334-.946 2.419-2.157 2.419z"/>
          </svg>
          <span>{loading ? "Connecting..." : "Login with Discord"}</span>
        </button>

        {/* Inline error */}
        <div role="alert" aria-live="polite" className="w-full">
          {error && (
            <p className="mt-4 text-xs leading-relaxed text-red-200 bg-red-500/20 border border-red-500/30 rounded-xl px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <p className="mt-8 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
          Exclusive to Hunter Trades community members
        </p>
      </main>
    </div>
  );
}
