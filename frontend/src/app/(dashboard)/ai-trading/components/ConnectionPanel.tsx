"use client";

import { useState, useEffect } from "react";
import { Loader2, Plug, PlugZap, Eye, EyeOff } from "lucide-react";

interface MT5Credentials {
  server: string;
  login: string;
  password: string;
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
  const [showPassword, setShowPassword] = useState(false);

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
    await onConnect({ server, login, password });
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
    </div>
  );
}
