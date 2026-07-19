"use client";

import { useState, useEffect } from "react";
import { Loader2, Plug, PlugZap, Eye, EyeOff } from "lucide-react";

interface MT5Credentials {
  server: string;
  login: string;
  password: string;
  tunnelUrl?: string;
}

interface ConnectionPanelProps {
  onConnect: (creds: MT5Credentials) => Promise<boolean>;
  isConnecting: boolean;
  error: string | null;
}

export function ConnectionPanel({
  onConnect,
  isConnecting,
  error,
}: ConnectionPanelProps) {
  const [server, setServer] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [tunnelUrl, setTunnelUrl] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("mt5_last_server");
    if (saved) setServer(saved);
    const savedLogin = localStorage.getItem("mt5_last_login");
    if (savedLogin) setLogin(savedLogin);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("mt5_last_server", server);
    localStorage.setItem("mt5_last_login", login);
    await onConnect({ server, login, password, tunnelUrl: tunnelUrl.trim() || undefined });
  };

  return (
    <div className="flex items-center justify-center min-h-[80vh] relative">
      <div className="w-full max-w-md relative z-10">
        
        {/* Main Card */}
        <div className="bg-bg-elevated border border-border-subtle rounded-2xl p-8 shadow-2xl relative overflow-hidden group">
          
          {/* Subtle top highlight */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-accent-gold/50 to-transparent opacity-50" />

          {/* Header */}
          <div className="flex flex-col items-center text-center mb-10">
            <div className="w-16 h-16 rounded-full bg-surface border border-border-subtle flex items-center justify-center mb-5 shadow-inner">
              <PlugZap className="w-8 h-8 text-accent-gold" />
            </div>
            <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
              Connect MT5
            </h1>
            <p className="text-text-muted mt-2 text-sm">
              Link your broker account to activate the AI engine
            </p>
            <button
              onClick={() => setShowGuide(true)}
              className="mt-4 text-xs font-semibold text-accent-gold/80 hover:text-accent-gold underline decoration-accent-gold/50 underline-offset-4"
            >
              Cara Hubungkan MT5 (User Guide)
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">
                Broker Server
              </label>
              <input
                type="text"
                value={server}
                onChange={(e) => setServer(e.target.value)}
                placeholder="e.g. ICMarkets-Demo"
                className="w-full px-4 py-3 bg-bg-input border border-border-subtle rounded-xl text-text-primary placeholder-text-muted/50 focus:border-accent-gold focus:ring-1 focus:ring-accent-gold outline-none transition-all shadow-sm"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">
                Account Login
              </label>
              <input
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="Account ID"
                className="w-full px-4 py-3 bg-bg-input border border-border-subtle rounded-xl text-text-primary placeholder-text-muted/50 focus:border-accent-gold focus:ring-1 focus:ring-accent-gold outline-none transition-all shadow-sm"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Master Password"
                  className="w-full px-4 py-3 bg-bg-input border border-border-subtle rounded-xl text-text-primary placeholder-text-muted/50 focus:border-accent-gold focus:ring-1 focus:ring-accent-gold outline-none transition-all shadow-sm pr-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">
                Connection URL <span className="text-accent-gold-dim lowercase">(Opsional - Untuk Jarak Jauh)</span>
              </label>
              <input
                type="text"
                value={tunnelUrl}
                onChange={(e) => setTunnelUrl(e.target.value)}
                placeholder="https://xxx.ngrok.app (Kosongkan jika di PC yang sama)"
                className="w-full px-4 py-3 bg-bg-input border border-border-subtle rounded-xl text-text-primary placeholder-text-muted/50 focus:border-accent-gold focus:ring-1 focus:ring-accent-gold outline-none transition-all shadow-sm"
              />
            </div>

            {/* Error message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0 animate-pulse" />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isConnecting}
              className="w-full mt-2 py-3.5 bg-accent-gold hover:bg-accent-gold/90 text-black rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(212,175,55,0.15)] hover:shadow-[0_0_25px_rgba(212,175,55,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <PlugZap className="w-5 h-5" />
                  <span>Establish Connection</span>
                </>
              )}
            </button>
          </form>

          {/* Security note */}
          <div className="mt-8 flex items-center justify-center gap-2 opacity-60">
            <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <p className="text-xs text-text-muted">
              Credentials are never stored. Secure MCP session.
            </p>
          </div>
          
        </div>
      </div>

      {/* User Guide Modal */}
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-bg-elevated border border-accent-gold/30 rounded-2xl p-6 max-w-lg w-full shadow-2xl">
            <div className="flex justify-between items-center mb-4 border-b border-accent-gold/20 pb-3">
              <h2 className="text-lg font-bold text-accent-gold uppercase tracking-wider">Cara Menghubungkan MT5</h2>
              <button onClick={() => setShowGuide(false)} className="text-text-muted hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-5 text-sm text-text-primary">
              <div className="flex gap-4 items-start">
                <div className="bg-accent-gold/20 text-accent-gold font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0">1</div>
                <div>
                  <p className="font-semibold text-white mb-1">Dapatkan Ngrok Authtoken</p>
                  <p className="text-text-muted leading-relaxed">Karena aplikasi ini butuh URL Publik, Anda wajib mendaftar di <a href="https://dashboard.ngrok.com" target="_blank" rel="noreferrer" className="text-accent-gold underline hover:text-white">dashboard.ngrok.com</a>. Setelah login, masuk ke menu <strong>Your Authtoken</strong> lalu Copy token Anda.</p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="bg-accent-gold/20 text-accent-gold font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0">2</div>
                <div>
                  <p className="font-semibold text-white mb-1">Unduh & Jalankan Aplikasi</p>
                  <p className="text-text-muted leading-relaxed">Download <a href={process.env.NEXT_PUBLIC_MCP_DOWNLOAD_URL || "#"} target="_blank" rel="noreferrer" className="text-accent-gold font-mono underline hover:text-white">Mulai_AI_Trading.exe</a> dan jalankan di PC yang sudah terinstal MetaTrader 5.</p>
                </div>
              </div>
              
              <div className="flex gap-4 items-start">
                <div className="bg-accent-gold/20 text-accent-gold font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0">3</div>
                <div>
                  <p className="font-semibold text-white mb-1">Masukkan Token & Salin URL</p>
                  <p className="text-text-muted leading-relaxed">Saat pertama kali dibuka, layar CMD akan meminta Ngrok Authtoken. Paste token dari Langkah 1 lalu tekan Enter. Jika berhasil, akan muncul <span className="text-accent-gold">URL Koneksi Anda</span> (berakhiran .ngrok-free.dev). Blok dan Copy URL tersebut.</p>
                </div>
              </div>
              
              <div className="flex gap-4 items-start">
                <div className="bg-accent-gold/20 text-accent-gold font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0">4</div>
                <div>
                  <p className="font-semibold text-white mb-1">Hubungkan ke Web</p>
                  <p className="text-text-muted leading-relaxed">Paste URL Koneksi tadi ke kolom <strong>Connection URL</strong> di halaman ini beserta Broker dan Login MT5 Anda, lalu klik Connect.</p>
                </div>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end">
              <button 
                onClick={() => setShowGuide(false)}
                className="px-6 py-2 bg-accent-gold text-black rounded-lg font-semibold hover:bg-accent-gold/90 transition-colors"
              >
                Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
