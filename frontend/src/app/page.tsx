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
      
      {/* Ambient Background Orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-accent-gold/8 rounded-full blur-[200px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-[-15%] right-[-5%] w-[400px] h-[400px] bg-accent-gold/5 rounded-full blur-[180px] pointer-events-none animate-pulse" style={{ animationDelay: '2s' }} />
      <div className="absolute top-[30%] right-[20%] w-[200px] h-[200px] bg-white/3 rounded-full blur-[120px] pointer-events-none" />

      {/* Background Dot Grid */}
      <div 
        className="absolute inset-0 z-0 opacity-15"
        style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, rgba(212,175,55,0.15) 1px, transparent 0)`,
          backgroundSize: '48px 48px'
        }}
      />

      {/* Login Card — 3D Glass */}
      <main className="relative z-10 flex flex-col items-center w-full max-w-[420px] px-10 py-12 text-center animate-in fade-in zoom-in-95 duration-1000"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(30,30,40,0.3) 40%, rgba(5,5,10,0.8) 100%)',
          backdropFilter: 'blur(28px) saturate(140%)',
          WebkitBackdropFilter: 'blur(28px) saturate(140%)',
          borderTop: '1px solid rgba(255,255,255,0.25)',
          borderLeft: '1px solid rgba(255,255,255,0.15)',
          borderRight: '1px solid rgba(0,0,0,0.5)',
          borderBottom: '1px solid rgba(0,0,0,0.7)',
          boxShadow: 'inset 1px 1px 2px rgba(255,255,255,0.12), inset -1px -1px 4px rgba(0,0,0,0.8), 0 6px 12px rgba(0,0,0,0.6), 0 24px 48px rgba(0,0,0,0.9), 0 0 120px rgba(212,175,55,0.05)',
          borderRadius: '24px',
        }}
      >
        
        {/* Logo — with gold glow */}
        <div className="mb-6 relative">
          <div className="absolute inset-0 bg-accent-gold/10 rounded-full blur-[40px] scale-150" />
          <img 
            src="/logo.png" 
            alt="Hunter Trades Logo" 
            className="relative w-24 h-auto mx-auto drop-shadow-[0_0_16px_rgba(212,175,55,0.5)] object-contain hover:scale-110 transition-transform duration-500" 
          />
        </div>
        
        <h1 className="text-2xl md:text-3xl font-bold text-accent-gold tracking-[0.2em] mb-2 uppercase drop-shadow-[0_0_8px_rgba(212,175,55,0.3)]">
          HUNTER TRADES
        </h1>

        <p className="text-[10px] text-text-muted tracking-[0.3em] uppercase font-semibold mb-8">
          Elite Ledger
        </p>
        
        <p className="text-[13px] text-text-secondary/70 leading-relaxed mb-10 max-w-[280px]">
          Exclusive trading journal for Hunter Trades members
        </p>

        {/* Separator */}
        <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-accent-gold/30 to-transparent mb-10" />

        {/* Login Button — 3D Gold */}
        <button 
          onClick={handleLogin}
          className="w-full h-[52px] rounded-xl font-bold text-[15px] flex items-center justify-center space-x-3 transition-all duration-300 group cursor-pointer active:scale-95"
          style={{
            background: 'linear-gradient(135deg, #D4AF37 0%, #c5a030 50%, #b8942a 100%)',
            color: '#050508',
            borderTop: '1px solid rgba(255,255,255,0.4)',
            borderLeft: '1px solid rgba(255,255,255,0.2)',
            borderRight: '1px solid rgba(0,0,0,0.3)',
            borderBottom: '1px solid rgba(0,0,0,0.5)',
            boxShadow: 'inset 1px 1px 2px rgba(255,255,255,0.3), 0 4px 12px rgba(212,175,55,0.3), 0 12px 32px rgba(0,0,0,0.6)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
            e.currentTarget.style.boxShadow = 'inset 1px 1px 3px rgba(255,255,255,0.4), 0 8px 24px rgba(212,175,55,0.4), 0 20px 48px rgba(0,0,0,0.7)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.boxShadow = 'inset 1px 1px 2px rgba(255,255,255,0.3), 0 4px 12px rgba(212,175,55,0.3), 0 12px 32px rgba(0,0,0,0.6)';
          }}
        >
          {/* Discord Icon */}
          <svg 
            width="22" height="22" viewBox="0 0 24 24" fill="currentColor"
            className="group-hover:scale-110 transition-transform duration-300"
          >
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.419c0 1.334-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.419c0 1.334-.946 2.419-2.157 2.419z"/>
          </svg>
          <span className="tracking-wider">Login with Discord</span>
        </button>

        <p className="mt-10 text-[10px] text-text-muted/50 uppercase tracking-[0.25em]">
          Exclusive to Hunter Trades community members
        </p>

      </main>

    </div>
  );
}
