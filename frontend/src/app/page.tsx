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
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden"
      style={{ backgroundColor: '#313338' }}
    >
      
      {/* Ambient Blurple Orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full blur-[200px] pointer-events-none animate-pulse"
        style={{ backgroundColor: 'rgba(88,101,242,0.08)' }} />
      <div className="absolute bottom-[-15%] right-[-5%] w-[400px] h-[400px] rounded-full blur-[180px] pointer-events-none animate-pulse"
        style={{ backgroundColor: 'rgba(88,101,242,0.05)', animationDelay: '2s' }} />

      {/* Login Card — Discord Dark Glass */}
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
        
        {/* Logo — with gold glow */}
        <div className="mb-6 relative">
          <div className="absolute inset-0 rounded-full blur-[40px] scale-150"
            style={{ backgroundColor: 'rgba(212,175,55,0.1)' }} />
          <img 
            src="/logo.png" 
            alt="Hunter Trades Logo" 
            className="relative w-24 h-auto mx-auto object-contain hover:scale-110 transition-transform duration-500"
            style={{ filter: 'drop-shadow(0 0 16px rgba(212,175,55,0.4))' }}
          />
        </div>
        
        <h1 className="text-2xl md:text-3xl font-bold tracking-[0.15em] mb-2 uppercase"
          style={{ color: '#F2F3F5' }}
        >
          HUNTER TRADES
        </h1>

        <p className="text-[10px] tracking-[0.3em] uppercase font-semibold mb-8"
          style={{ color: '#B5BAC1' }}
        >
          Elite Ledger
        </p>
        
        <p className="text-[13px] leading-relaxed mb-10 max-w-[280px]"
          style={{ color: '#949BA4' }}
        >
          Exclusive trading journal for Hunter Trades members
        </p>

        {/* Separator */}
        <div className="w-full h-[1px] mb-10"
          style={{ background: 'linear-gradient(to right, transparent, rgba(88,101,242,0.3), transparent)' }} />

        {/* Login Button — Discord Blurple */}
        <button 
          onClick={handleLogin}
          className="w-full h-[48px] rounded-[8px] font-semibold text-[15px] flex items-center justify-center space-x-3 transition-all duration-200 group cursor-pointer active:scale-[0.97]"
          style={{
            backgroundColor: '#5865F2',
            color: '#FFFFFF',
            border: 'none',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#4752C4';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#5865F2';
          }}
        >
          {/* Discord Icon */}
          <svg 
            width="22" height="22" viewBox="0 0 24 24" fill="currentColor"
            className="group-hover:scale-110 transition-transform duration-200"
          >
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.419c0 1.334-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.419c0 1.334-.946 2.419-2.157 2.419z"/>
          </svg>
          <span className="tracking-wide">Login with Discord</span>
        </button>

        <p className="mt-10 text-[10px] uppercase tracking-[0.25em]"
          style={{ color: '#6D6F78' }}
        >
          Exclusive to Hunter Trades community members
        </p>

      </main>

    </div>
  );
}
