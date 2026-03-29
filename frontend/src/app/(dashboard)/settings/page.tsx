"use client";

import { Settings as SettingsIcon, User, Bell, Palette, Shield, Database, Globe, Key, Save, Moon, Sun, Volume2, VolumeX } from "lucide-react";
import { useState } from "react";

interface SettingsSection {
  id: string;
  label: string;
  icon: any;
}

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState("profile");
  const [theme, setTheme] = useState<"dark" | "light" | "system">("dark");
  const [notifications, setNotifications] = useState({
    tradeAlerts: true,
    aiReviews: false,
    weeklyReports: true,
    achievementUnlocked: true,
  });
  const [riskDefaults, setRiskDefaults] = useState({
    defaultRiskPercent: 1.0,
    maxDailyDrawdown: 5.0,
    maxConsecutiveLosses: 3,
    autoJournal: true,
  });
  const [integrationSettings, setIntegrationSettings] = useState({
    discordNotifications: false,
    tradingViewSync: false,
    metatraderConnect: false,
    googleSheetsSync: false,
  });

  const sections: SettingsSection[] = [
    { id: "profile", label: "Profile", icon: User },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "risk", label: "Risk Management", icon: Shield },
    { id: "integrations", label: "Integrations", icon: Globe },
    { id: "api", label: "API Keys", icon: Key },
    { id: "data", label: "Data & Privacy", icon: Database },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-[0.1em]">Pengaturan</h1>
          <p className="text-sm text-text-secondary mt-1">Manage your preferences and account settings</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1">
          <div className="glass p-4 sticky top-0">
            <nav className="space-y-1">
              {sections.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center h-12 px-4 text-left transition-all rounded-lg ${
                      isActive
                        ? "bg-accent-gold/10 text-accent-gold border border-accent-gold/30"
                        : "text-text-secondary hover:text-accent-gold hover:bg-white/5"
                    }`}
                  >
                    <Icon className="w-5 h-5 mr-3" />
                    <span className="text-sm font-medium">{section.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3">
          {/* Profile Section */}
          {activeSection === "profile" && (
            <div className="space-y-6">
              <div className="glass p-6">
                <h2 className="text-lg font-semibold text-text-primary mb-6">Profile Information</h2>
                <div className="flex items-start space-x-6 mb-8">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-accent-gold/10 border-2 border-accent-gold/30 flex items-center justify-center">
                      <span className="text-2xl font-mono font-bold text-accent-gold">HT</span>
                    </div>
                    <button className="absolute bottom-0 right-0 w-8 h-8 bg-accent-gold text-bg-void rounded-full flex items-center justify-center text-xs font-bold hover:brightness-110">
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-text-primary mb-1">Elite Hunter</h3>
                    <p className="text-sm text-text-secondary mb-3">Pro Plan member since January 2025</p>
                    <div className="flex space-x-2">
                      <button className="px-3 py-1.5 text-xs font-medium bg-bg-elevated text-text-secondary rounded border border-border-subtle hover:border-accent-gold hover:text-accent-gold transition-colors">
                        Change Avatar
                      </button>
                      <button className="px-3 py-1.5 text-xs font-medium bg-bg-elevated text-text-secondary rounded border border-border-subtle hover:border-accent-gold hover:text-accent-gold transition-colors">
                        Remove
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-2">Display Name</label>
                      <input
                        type="text"
                        defaultValue="Elite Hunter"
                        className="w-full bg-bg-input border border-border-subtle rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-accent-gold focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-2">Email</label>
                      <input
                        type="email"
                        defaultValue="elite@huntertrades.com"
                        className="w-full bg-bg-input border border-border-subtle rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-accent-gold focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-2">Bio</label>
                    <textarea
                      rows={3}
                      defaultValue="Full-time price action trader focusing on XAUUSD and major forex pairs."
                      className="w-full bg-bg-input border border-border-subtle rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-accent-gold focus:outline-none resize-none"
                    />
                  </div>
                  <div className="flex justify-end pt-4">
                    <button className="btn-gold flex items-center space-x-2">
                      <Save className="w-4 h-4" />
                      <span>Save Changes</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Appearance Section */}
          {activeSection === "appearance" && (
            <div className="space-y-6">
              <div className="glass p-6">
                <h2 className="text-lg font-semibold text-text-primary mb-6">Appearance</h2>

                <div className="mb-8">
                  <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-3">Theme</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: "dark", label: "Dark", icon: Moon },
                      { id: "light", label: "Light", icon: Sun },
                      { id: "system", label: "System", icon: Globe },
                    ].map((option) => {
                      const Icon = option.icon;
                      const isActive = theme === option.id;
                      return (
                        <button
                          key={option.id}
                          onClick={() => setTheme(option.id as "dark" | "light" | "system")}
                          className={`p-4 rounded-lg border transition-all flex flex-col items-center space-y-2 ${
                            isActive
                              ? "bg-accent-gold/10 border-accent-gold text-accent-gold"
                              : "bg-bg-elevated border-border-subtle text-text-secondary hover:border-accent-gold"
                          }`}
                        >
                          <Icon className="w-6 h-6" />
                          <span className="text-sm font-medium">{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mb-8">
                  <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-3">Accent Color</label>
                  <div className="flex space-x-3">
                    {["#D4AF37", "#00E676", "#FF1744", "#3B82F6", "#A855F7"].map((color) => (
                      <button
                        key={color}
                        className={`w-10 h-10 rounded-full border-2 transition-transform hover:scale-110 ${
                          color === "#D4AF37" ? "border-accent-gold scale-110" : "border-transparent"
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between py-3 border-b border-white/5">
                  <div className="flex items-center space-x-3">
                    <Volume2 className="w-5 h-5 text-text-secondary" />
                    <div>
                      <p className="text-sm font-medium text-text-primary">Sound Effects</p>
                      <p className="text-[11px] text-text-muted">Play sounds for notifications</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {}}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      true ? "bg-accent-gold" : "bg-bg-elevated"
                    }`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${true ? "left-7" : "left-1"}`} />
                  </button>
                </div>

                <div className="flex justify-end pt-6">
                  <button className="btn-gold flex items-center space-x-2">
                    <Save className="w-4 h-4" />
                    <span>Save Preferences</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Notifications Section */}
          {activeSection === "notifications" && (
            <div className="space-y-6">
              <div className="glass p-6">
                <h2 className="text-lg font-semibold text-text-primary mb-6">Notification Settings</h2>

                <div className="space-y-4">
                  {[
                    {
                      key: "tradeAlerts" as const,
                      label: "Trade Alerts",
                      desc: "Get notified when trades are executed",
                    },
                    {
                      key: "aiReviews" as const,
                      label: "AI Reviews Ready",
                      desc: "Notification when new AI analysis complete",
                    },
                    {
                      key: "weeklyReports" as const,
                      label: "Weekly Performance Reports",
                      desc: "Receive weekly summary every Monday morning",
                    },
                    {
                      key: "achievementUnlocked" as const,
                      label: "Achievements & Milestones",
                      desc: "Celebrate your trading milestones",
                    },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between py-3 border-b border-white/5">
                      <div>
                        <p className="text-sm font-medium text-text-primary">{item.label}</p>
                        <p className="text-[11px] text-text-muted">{item.desc}</p>
                      </div>
                      <button
                        onClick={() => setNotifications({ ...notifications, [item.key]: !notifications[item.key] })}
                        className={`relative w-12 h-6 rounded-full transition-colors ${
                          notifications[item.key] ? "bg-accent-gold" : "bg-bg-elevated"
                        }`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${notifications[item.key] ? "left-7" : "left-1"}`} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-8">
                  <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-3">Quiet Hours</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-text-muted mb-1">Start</label>
                      <input
                        type="time"
                        defaultValue="22:00"
                        className="w-full bg-bg-input border border-border-subtle rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-accent-gold focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-text-muted mb-1">End</label>
                      <input
                        type="time"
                        defaultValue="07:00"
                        className="w-full bg-bg-input border border-border-subtle rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-accent-gold focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Risk Management Section */}
          {activeSection === "risk" && (
            <div className="space-y-6">
              <div className="glass p-6">
                <h2 className="text-lg font-semibold text-text-primary mb-6">Risk Management Defaults</h2>

                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-sm font-medium text-text-primary">Default Risk per Trade</label>
                      <span className="font-mono text-accent-gold">{riskDefaults.defaultRiskPercent}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="5"
                      step="0.1"
                      value={riskDefaults.defaultRiskPercent}
                      onChange={(e) => setRiskDefaults({ ...riskDefaults, defaultRiskPercent: parseFloat(e.target.value) })}
                      className="w-full h-2 bg-bg-void rounded-full appearance-none cursor-pointer accent-accent-gold"
                    />
                    <p className="text-[11px] text-text-muted mt-1">Percentage of account balance risked per trade</p>
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-sm font-medium text-text-primary">Max Daily Drawdown Limit</label>
                      <span className="font-mono text-data-loss">{riskDefaults.maxDailyDrawdown}%</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      step="0.5"
                      value={riskDefaults.maxDailyDrawdown}
                      onChange={(e) => setRiskDefaults({ ...riskDefaults, maxDailyDrawdown: parseFloat(e.target.value) })}
                      className="w-full h-2 bg-bg-void rounded-full appearance-none cursor-pointer accent-data-loss"
                    />
                    <p className="text-[11px] text-text-muted mt-1">Stop trading for the day if daily loss exceeds this</p>
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-sm font-medium text-text-primary">Max Consecutive Losses</label>
                      <span className="font-mono text-data-loss">{riskDefaults.maxConsecutiveLosses}</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="1"
                      value={riskDefaults.maxConsecutiveLosses}
                      onChange={(e) => setRiskDefaults({ ...riskDefaults, maxConsecutiveLosses: parseInt(e.target.value) })}
                      className="w-full h-2 bg-bg-void rounded-full appearance-none cursor-pointer accent-data-loss"
                    />
                    <p className="text-[11px] text-text-muted mt-1">Stop trading after this many consecutive losses</p>
                  </div>

                  <div className="flex items-center justify-between py-3 border-t border-white/10">
                    <div>
                      <p className="text-sm font-medium text-text-primary">Auto-Journal Trades</p>
                      <p className="text-[11px] text-text-muted">Automatically create journal entries via API</p>
                    </div>
                    <button
                      onClick={() => setRiskDefaults({ ...riskDefaults, autoJournal: !riskDefaults.autoJournal })}
                      className={`relative w-12 h-6 rounded-full transition-colors ${riskDefaults.autoJournal ? "bg-accent-gold" : "bg-bg-elevated"}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${riskDefaults.autoJournal ? "left-7" : "left-1"}`} />
                    </button>
                  </div>
                </div>

                <div className="mt-8 p-4 bg-accent-gold/5 border border-accent-gold/20 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <Shield className="w-5 h-5 text-accent-gold mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-accent-gold mb-1">Risk Guard Status</p>
                      <p className="text-[11px] text-text-secondary">
                        Your current risk parameters are {riskDefaults.defaultRiskPercent <= 2 && riskDefaults.maxDailyDrawdown <= 5 ? "conservative and well within safe limits." : "aggressive. Consider tightening limits to preserve capital."}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-6">
                  <button className="btn-gold flex items-center space-x-2">
                    <Save className="w-4 h-4" />
                    <span>Save Risk Settings</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Integrations Section */}
          {activeSection === "integrations" && (
            <div className="space-y-6">
              <div className="glass p-6">
                <h2 className="text-lg font-semibold text-text-primary mb-6">Integrations</h2>

                <div className="space-y-4">
                  {[
                    {
                      key: "discordNotifications" as const,
                      label: "Discord Notifications",
                      desc: "Send trade alerts to Discord webhooks",
                      icon: null,
                    },
                    {
                      key: "tradingViewSync" as const,
                      label: "TradingView Sync",
                      desc: "Automatic trade import from TradingView strategies",
                      icon: null,
                    },
                    {
                      key: "metatraderConnect" as const,
                      label: "MetaTrader Connection",
                      desc: "Connect MT4/MT5 for automated trade capture",
                      icon: null,
                    },
                    {
                      key: "googleSheetsSync" as const,
                      label: "Google Sheets",
                      desc: "Export trade data to spreadsheets",
                      icon: null,
                    },
                  ].map((item) => (
                    <div key={item.key} className="p-4 bg-bg-elevated rounded-lg border border-border-subtle">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-text-primary">{item.label}</p>
                          <p className="text-[11px] text-text-muted">{item.desc}</p>
                        </div>
                        <button
                          onClick={() => setIntegrationSettings({ ...integrationSettings, [item.key]: !integrationSettings[item.key as keyof typeof integrationSettings] })}
                          className={`relative w-12 h-6 rounded-full transition-colors ${
                            integrationSettings[item.key as keyof typeof integrationSettings] ? "bg-accent-gold" : "bg-bg-void"
                          }`}
                        >
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${integrationSettings[item.key as keyof typeof integrationSettings] ? "left-7" : "left-1"}`} />
                        </button>
                      </div>
                      {integrationSettings[item.key as keyof typeof integrationSettings] && (
                        <div className="mt-4 pt-4 border-t border-white/10">
                          <input
                            type="text"
                            placeholder="Enter webhook URL or connection details"
                            className="w-full bg-bg-input border border-border-subtle rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-accent-gold focus:outline-none mb-3"
                          />
                          <button className="text-[11px] text-accent-gold hover:underline">Test Connection</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* API Keys Section */}
          {activeSection === "api" && (
            <div className="space-y-6">
              <div className="glass p-6">
                <h2 className="text-lg font-semibold text-text-primary mb-6">API Keys & Webhooks</h2>

                <div className="mb-6">
                  <p className="text-sm text-text-secondary mb-4">
                    Manage your API keys for programmatic access to your trading journal data.
                  </p>
                  <button className="btn-gold flex items-center space-x-2">
                    <Key className="w-4 h-4" />
                    <span>Generate New API Key</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {[
                    { name: "Production API Key", key: "ht_live_********************************", created: "2025-01-15", lastUsed: "2 minutes ago" },
                    { name: "Development Key", key: "ht_dev_********************************", created: "2025-02-20", lastUsed: "3 days ago" },
                  ].map((apiKey, idx) => (
                    <div key={idx} className="p-4 bg-bg-elevated rounded-lg border border-border-subtle">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-sm font-medium text-text-primary">{apiKey.name}</p>
                          <p className="font-mono text-xs text-text-secondary mt-1">{apiKey.key}</p>
                        </div>
                        <button className="text-[11px] text-data-loss hover:underline">Revoke</button>
                      </div>
                      <div className="flex text-[10px] text-text-muted space-x-4">
                        <span>Created: {apiKey.created}</span>
                        <span>Last used: {apiKey.lastUsed}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Data & Privacy Section */}
          {activeSection === "data" && (
            <div className="space-y-6">
              <div className="glass p-6">
                <h2 className="text-lg font-semibold text-text-primary mb-6">Data & Privacy</h2>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-medium text-text-primary mb-3">Data Export</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <button className="p-3 bg-bg-elevated border border-border-subtle rounded-lg text-left hover:border-accent-gold transition-colors">
                        <p className="text-sm font-medium text-text-primary">CSV Format</p>
                        <p className="text-[10px] text-text-muted">All trades and analytics</p>
                      </button>
                      <button className="p-3 bg-bg-elevated border border-border-subtle rounded-lg text-left hover:border-accent-gold transition-colors">
                        <p className="text-sm font-medium text-text-primary">JSON Format</p>
                        <p className="text-[10px] text-text-muted">Structured data export</p>
                      </button>
                      <button className="p-3 bg-bg-elevated border border-border-subtle rounded-lg text-left hover:border-accent-gold transition-colors">
                        <p className="text-sm font-medium text-text-primary">PDF Report</p>
                        <p className="text-[10px] text-text-muted">Monthly performance report</p>
                      </button>
                      <button className="p-3 bg-bg-elevated border border-border-subtle rounded-lg text-left hover:border-accent-gold transition-colors">
                        <p className="text-sm font-medium text-text-primary">Excel (XLSX)</p>
                        <p className="text-[11px] text-text-muted">Formatted spreadsheet</p>
                      </button>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-white/10">
                    <h3 className="text-sm font-medium text-text-primary mb-4">Danger Zone</h3>
                    <div className="space-y-3">
                      <button className="w-full p-4 bg-data-loss/5 border border-data-loss/20 rounded-lg text-left hover:bg-data-loss/10 transition-colors">
                        <p className="text-sm font-bold text-data-loss">Delete All Data</p>
                        <p className="text-[11px] text-text-muted">Permanently delete all trades, journals, and settings</p>
                      </button>
                      <button className="w-full p-4 bg-data-loss/5 border border-data-loss/20 rounded-lg text-left hover:bg-data-loss/10 transition-colors">
                        <p className="text-sm font-bold text-data-loss">Deactivate Account</p>
                        <p className="text-[11px] text-text-muted">Temporarily disable account access</p>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper component
function Camera({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}
