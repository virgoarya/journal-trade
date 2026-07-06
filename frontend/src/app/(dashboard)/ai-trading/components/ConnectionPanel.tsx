"use client";

import { useState } from "react";
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onConnect({ server, login, password });
  };

  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <div className="w-full max-w-md">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-accent-gold/10 rounded-full mb-4">
              <PlugZap className="w-8 h-8 text-accent-gold" />
            </div>
            <h1 className="text-2xl font-bold text-white">
              Connect MT5 Account
            </h1>
            <p className="text-gray-400 mt-2 text-sm">
              Enter your MT5 broker credentials to start AI trading
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">
                Broker Server
              </label>
              <input
                type="text"
                value={server}
                onChange={(e) => setServer(e.target.value)}
                placeholder="e.g. ICMarkets-Demo"
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-accent-gold focus:ring-1 focus:ring-accent-gold outline-none transition"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter your broker's server name
              </p>
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1.5">
                Account Login
              </label>
              <input
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="e.g. 12345678"
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-accent-gold focus:ring-1 focus:ring-accent-gold outline-none transition"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Account password"
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-accent-gold focus:ring-1 focus:ring-accent-gold outline-none transition pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isConnecting}
              className="w-full py-3 bg-accent-gold hover:bg-accent-gold/90 disabled:bg-accent-gold/50 text-black rounded-lg font-semibold transition flex items-center justify-center gap-2"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Plug className="w-4 h-4" />
                  Connect to MT5
                </>
              )}
            </button>
          </form>

          {/* Security note */}
          <p className="text-xs text-gray-500 text-center mt-6">
            🔒 Credentials are never stored. Connected via secure MCP session.
          </p>
        </div>
      </div>
    </div>
  );
}
