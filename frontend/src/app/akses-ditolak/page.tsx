"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";

export default function AccessDeniedPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isPending && !session) {
      router.push("/");
    }
  }, [session, isPending, router]);

  // Loading state
  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-dim text-on-surface">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  // If not authenticated, don't render (will redirect)
  if (!session) {
    return null;
  }

  return (
    <>
      {/* Meta viewport for mobile */}
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />

      <main className="w-full max-w-[440px] flex flex-col items-center text-center p-6 mx-auto relative min-h-screen">
        {/* Animated Background */}
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-error/5 blur-[120px]"></div>
        </div>

        {/* Terminal Identifier */}
        <div className="mb-12 font-mono text-[10px] tracking-[0.3em] text-outline uppercase opacity-40">
          System Error Code: 403_RESTRICTED_ACCESS
        </div>

        {/* Shield Icon */}
        <div className="mb-8 relative">
          <div className="absolute inset-0 bg-error/20 blur-2xl rounded-full scale-110"></div>
          <div className="relative w-20 h-20 rounded-2xl glass-card flex items-center justify-center border-error/20">
            <span className="material-symbols-outlined text-[56px] text-error">
              shield
            </span>
          </div>
        </div>

        {/* Content */}
        <h1 className="font-headline font-bold text-[28px] leading-tight text-[#E8E6E3] mb-4 tracking-tight">
          AKSES DIBATASI
        </h1>
        <p className="text-[15px] leading-relaxed text-secondary mb-10 px-4">
          Anda belum bergabung di server Discord Hunter Trades. Untuk mengakses aplikasi,{" "}
          <strong>silakan join server terlebih dahulu</strong>.
        </p>

        {/* Actions */}
        <div className="w-full space-y-6">
          {/* Button: Gabung Hunter Trades */}
          <a
            href="https://discord.gg/eAhtEU44tQ"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full h-[52px] bg-primary-container text-surface-dim font-headline font-bold text-[15px] rounded-[10px] gold-glow hover:opacity-90 transition-all active:scale-[0.98] flex items-center justify-center gap-2 group"
          >
            Gabung Hunter Trades
            <span className="material-symbols-outlined text-[20px] group-hover:translate-x-1 transition-transform">
              arrow_forward
            </span>
          </a>

          {/* Link: Coba masuk ulang */}
          <div className="flex flex-col items-center gap-4">
            <Link
              href="/"
              className="text-primary-container font-headline font-medium text-[14px] hover:underline transition-all tracking-wide underline-offset-4"
            >
              Coba masuk ulang
            </Link>

            {/* Decorative Footer */}
            <div className="mt-8 flex items-center gap-2 opacity-30">
              <span className="h-[1px] w-8 bg-outline"></span>
              <span className="font-mono text-[10px] tracking-widest uppercase">Hunter Trades Ledger</span>
              <span className="h-[1px] w-8 bg-outline"></span>
            </div>
          </div>
        </div>

        {/* Bottom Decorative */}
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-6 opacity-20 pointer-events-none">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[14px]">security</span>
            <span className="font-mono text-[10px] uppercase">Encrypted</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[14px]">terminal</span>
            <span className="font-mono text-[10px] uppercase">v2.0.4-Gold</span>
          </div>
        </div>
      </main>
    </>
  );
}
