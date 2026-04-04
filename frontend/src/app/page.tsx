"use client";

import { signIn } from "@/lib/auth-client";

export default function LoginPage() {
  const handleLogin = async () => {
    try {
      console.log("[AUTH] Starting Discord login...");
      await signIn.social({
        provider: "discord",
        callbackURL: "http://localhost:3000/dashboard",
      });
      console.log("[AUTH] Redirect to Discord initiated.");
    } catch (error) {
      console.error("[AUTH] Error during login initiation:", error);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-bg-void overflow-hidden">
      
      {/* Background Dot Grid */}
      <div 
        className="absolute inset-0 z-0 opacity-20"
        style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, #1A1A2E 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }}
      />

      {/* Subtle Gold Radial Glow */}
      <div className="absolute inset-0 z-0 flex items-center justify-center opacity-5 pointer-events-none">
        <div className="w-[800px] h-[800px] bg-accent-gold rounded-full blur-[160px]" />
      </div>

      {/* Login Card */}
      <main className="relative z-10 flex flex-col items-center w-full max-w-[400px] px-6 text-center animate-in fade-in zoom-in-95 duration-1000">
        
        {/* Logo Section */}
        <div className="mb-4">
          <img 
            src="/logo.png" 
            alt="Hunter Trades Logo" 
            className="w-20 h-auto mx-auto drop-shadow-[0_0_12px_rgba(212,175,55,0.4)] object-contain" 
          />
        </div>
        
        <h1 className="text-2xl md:text-3xl font-bold text-accent-gold tracking-[0.2em] mb-4 uppercase">
          HUNTER TRADES
        </h1>
        
        <p className="text-[15px] text-text-secondary leading-relaxed mb-10 max-w-[280px]">
          Exclusive trading journal for Hunter Trades members
        </p>

        {/* Login Button */}
        <button 
          onClick={handleLogin}
          className="w-full bg-accent-gold text-bg-void h-[52px] rounded-md font-semibold text-[16px] flex items-center justify-center space-x-3 transition-all hover:brightness-110 hover:shadow-[0_0_20px_rgba(212,175,55,0.2)] active:scale-95 group"
        >
          {/* Simple Discord Icon Placeholder via SVG */}
          <svg 
            width="20" height="20" viewBox="0 0 24 24" fill="currentColor"
            className="group-hover:scale-110 transition-transform"
          >
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.419c0 1.334-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.419c0 1.334-.946 2.419-2.157 2.419z"/>
          </svg>
          <span>Login with Discord</span>
        </button>

        <p className="mt-8 text-[11px] text-text-muted uppercase tracking-[0.2em]">
          Exclusive to Hunter Trades community members
        </p>

      </main>

    </div>
  );
}
