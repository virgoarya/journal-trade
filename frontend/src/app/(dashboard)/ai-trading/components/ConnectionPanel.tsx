"use client";

import { useState, useEffect } from "react";
import { Loader2, PlugZap, Eye, EyeOff, Key, ShieldCheck, ChevronDown, ChevronUp, Copy, CheckCircle2, Terminal } from "lucide-react";

interface MT5Credentials {
  apiKey?: string;
  mcpUrl?: string;
  server?: string;
  login?: string;
  password?: string;
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
  const [apiKey, setApiKey] = useState("");
  const [mcpUrl, setMcpUrl] = useState("http://127.0.0.1:22346/mcp");
  const [showApiKey, setShowApiKey] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    const savedApiKey = localStorage.getItem("mt5_mcp_api_key");
    if (savedApiKey) setApiKey(savedApiKey);
    const savedMcpUrl = localStorage.getItem("mt5_mcp_url");
    if (savedMcpUrl) setMcpUrl(savedMcpUrl);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanApiKey = apiKey.trim();
    const cleanUrl = mcpUrl.trim() || "http://127.0.0.1:22346/mcp";

    localStorage.setItem("mt5_mcp_api_key", cleanApiKey);
    localStorage.setItem("mt5_mcp_url", cleanUrl);

    await onConnect({
      apiKey: cleanApiKey,
      mcpUrl: cleanUrl,
    });
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setApiKey(text.trim());
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[80vh] relative">
      <div className="w-full max-w-md relative z-10">
        
        {/* Main Card */}
        <div className="panel rounded-2xl p-8 shadow-2xl relative overflow-hidden group border border-border-subtle bg-bg-surface/80 backdrop-blur-xl">
          
          {/* Subtle top highlight */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-accent-gold/50 to-transparent opacity-50" />

          {/* Header */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-accent-gold/10 border border-accent-gold/30 flex items-center justify-center mb-4 shadow-[0_0_25px_rgba(212,175,55,0.15)]">
              <PlugZap className="w-8 h-8 text-accent-gold" />
            </div>
            <h1 className="text-2xl font-bold text-text-primary tracking-tight">
              Hubungkan MetaTrader 5
            </h1>
            <p className="text-text-muted mt-2 text-xs sm:text-sm">
              Koneksi instan & aman via protokol Native MT5 MCP
            </p>
            <button
              type="button"
              onClick={() => setShowGuide(true)}
              className="mt-3 text-xs font-semibold text-accent-gold hover:text-accent-gold/80 underline decoration-accent-gold/40 underline-offset-4 flex items-center gap-1.5 transition-colors"
            >
              <Key className="w-3.5 h-3.5" />
              <span>Panduan Mendapatkan API Key MT5</span>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-medium text-text-muted uppercase tracking-wider">
                  MT5 MCP API Key
                </label>
                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  className="text-[11px] text-accent-gold hover:underline cursor-pointer"
                >
                  Paste Clipboard
                </button>
              </div>
              
              <div className="relative">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="e.g. 1oBaWtEsZuqVsfzLoHlALKBtNcTQuFHt5AHGrRS9Zw"
                  className="w-full px-4 py-3 bg-bg-input border border-border-subtle rounded-xl text-text-primary placeholder-text-muted/40 focus:border-accent-gold focus:ring-1 focus:ring-accent-gold outline-none transition-all shadow-sm pr-12 font-mono text-sm"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors p-1"
                >
                  {showApiKey ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-[11px] text-text-muted">
                Salin dari MT5 ➜ <strong>Tools</strong> ➜ <strong>Options (Ctrl+O)</strong> ➜ tab <strong>MCP</strong>.
              </p>
            </div>

            {/* Advanced Toggle */}
            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs text-text-muted hover:text-text-primary flex items-center gap-1.5 transition-colors"
              >
                {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                <span>Opsi Lanjutan (Address & Port)</span>
              </button>

              {showAdvanced && (
                <div className="mt-3 space-y-2 pt-2 border-t border-border-subtle/50">
                  <label className="block text-[11px] font-medium text-text-muted uppercase tracking-wider">
                    MT5 MCP Server Address
                  </label>
                  <input
                    type="text"
                    value={mcpUrl}
                    onChange={(e) => setMcpUrl(e.target.value)}
                    placeholder="http://127.0.0.1:22346/mcp"
                    className="w-full px-3.5 py-2.5 bg-bg-input border border-border-subtle rounded-xl text-text-primary placeholder-text-muted/40 focus:border-accent-gold outline-none transition-all font-mono text-xs"
                  />
                  <p className="text-[10px] text-text-muted">
                    Default port adalah 22346. Ubah hanya jika port MT5 Anda dikonfigurasi berbeda.
                  </p>
                </div>
              )}
            </div>

            {/* Error message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3.5 flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 mt-1.5 animate-pulse" />
                <p className="text-red-400 text-xs leading-relaxed">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isConnecting || !apiKey.trim()}
              className="w-full mt-2 py-3.5 bg-accent-gold hover:bg-accent-gold/90 text-black rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(212,175,55,0.15)] hover:shadow-[0_0_25px_rgba(212,175,55,0.3)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Menghubungkan ke MT5...</span>
                </>
              ) : (
                <>
                  <PlugZap className="w-5 h-5" />
                  <span>Hubungkan ke MT5</span>
                </>
              )}
            </button>
          </form>

          {/* Security note */}
          <div className="mt-6 flex items-center justify-center gap-2 text-text-muted/70 text-center">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <p className="text-[11px]">
              Koneksi lokal privat. Tidak perlu memasukkan password broker Anda.
            </p>
          </div>
          
        </div>
      </div>

      {/* User Guide Modal */}
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="panel rounded-2xl p-6 max-w-xl w-full shadow-2xl border border-accent-gold/30 bg-bg-surface relative max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-center mb-5 border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2.5">
                <Terminal className="w-5 h-5 text-accent-gold" />
                <h2 className="text-base sm:text-lg font-bold text-text-primary uppercase tracking-wide">
                  Petunjuk Koneksi Native MT5 MCP
                </h2>
              </div>
              <button 
                onClick={() => setShowGuide(false)} 
                className="text-text-muted hover:text-white p-1 rounded-lg hover:bg-surface transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4 text-xs sm:text-sm text-text-primary">
              <div className="flex gap-3.5 items-start p-3 rounded-xl bg-bg-surface/50 border border-border-subtle/40">
                <div className="bg-accent-gold/20 text-accent-gold font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs">
                  1
                </div>
                <div>
                  <p className="font-semibold text-text-primary mb-0.5">Buka Terminal MetaTrader 5</p>
                  <p className="text-text-muted text-xs leading-relaxed">
                    Pastikan aplikasi MetaTrader 5 di PC / Laptop Anda sudah terbuka dan login ke akun trading Anda.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3.5 items-start p-3 rounded-xl bg-bg-surface/50 border border-border-subtle/40">
                <div className="bg-accent-gold/20 text-accent-gold font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs">
                  2
                </div>
                <div>
                  <p className="font-semibold text-text-primary mb-0.5">Buka Menu Options ➜ Tab MCP</p>
                  <p className="text-text-muted text-xs leading-relaxed">
                    Di menu atas MT5, klik <strong>Tools</strong> ➜ <strong>Options</strong> (atau tekan tombol keyboard <kbd className="px-1.5 py-0.5 bg-bg-input border border-border-subtle rounded text-[10px] font-mono text-accent-gold">Ctrl + O</kbd>), kemudian klik tab <strong>MCP</strong>.
                  </p>
                </div>
              </div>

              <div className="flex gap-3.5 items-start p-3 rounded-xl bg-bg-surface/50 border border-border-subtle/40">
                <div className="bg-accent-gold/20 text-accent-gold font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs">
                  3
                </div>
                <div>
                  <p className="font-semibold text-text-primary mb-0.5">Aktifkan Internal Server & Salin API Key</p>
                  <p className="text-text-muted text-xs leading-relaxed">
                    Centang kotak <strong className="text-accent-gold">Enable internal server</strong>. Kemudian klik tombol <strong className="text-white">Copy</strong> di sebelah kolom <strong>API Key</strong> (jika kolom API Key kosong, klik <em>Generate</em> terlebih dahulu).
                  </p>
                </div>
              </div>

              <div className="flex gap-3.5 items-start p-3 rounded-xl bg-bg-surface/50 border border-border-subtle/40">
                <div className="bg-accent-gold/20 text-accent-gold font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs">
                  4
                </div>
                <div>
                  <p className="font-semibold text-text-primary mb-0.5">Tempel API Key & Hubungkan</p>
                  <p className="text-text-muted text-xs leading-relaxed">
                    Klik <strong>OK</strong> di jendela Options MT5. Kembali ke Hunter Trades, tempelkan (Paste) API Key Anda ke dalam form, lalu klik tombol <strong className="text-accent-gold">Hubungkan ke MT5</strong>.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 p-3 rounded-xl bg-accent-gold/10 border border-accent-gold/20 flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-accent-gold flex-shrink-0" />
              <p className="text-xs text-text-primary">
                Setelah terhubung, seluruh data balance, equity, posisi terbuka, dan eksekusi AI trading akan tersinkronisasi secara real-time.
              </p>
            </div>
            
            <div className="mt-6 flex justify-end">
              <button 
                onClick={() => setShowGuide(false)}
                className="px-6 py-2.5 bg-accent-gold text-black rounded-xl font-semibold hover:bg-accent-gold/90 transition-all text-xs sm:text-sm cursor-pointer shadow-md"
              >
                Saya Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
