"use client";

import { 
  Settings as SettingsIcon, 
  User, Bell, Palette, Shield, Database, Globe, Key, Save, Moon, Sun, 
  Volume2, Loader2, Camera, Download, Trash2, AlertTriangle, CheckCircle, Briefcase, Plus 
} from "lucide-react";
import { useState, useEffect } from "react";
import { useSession } from "@/lib/auth-client";
import { tradingAccountService, TradingAccount } from "@/services/trading-account.service";
import { apiClient } from "@/lib/api-client";

interface SettingsSection {
  id: string;
  label: string;
  icon: any;
}

export default function SettingsPage() {
  const { data: session, isPending: sessionPending } = useSession();
  const [activeAccount, setActiveAccount] = useState<TradingAccount | null>(null);
  const [activeSection, setActiveSection] = useState("profile");
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [userAccounts, setUserAccounts] = useState<TradingAccount[]>([]);
  const [newAccountForm, setNewAccountForm] = useState({
    accountName: "",
    initialBalance: 1000,
    broker: "",
    currency: "USD"
  });

  // Appearance State
  const [theme, setTheme] = useState<"dark" | "light" | "system">("dark");

  // Load active account and theme
  useEffect(() => {
    const fetchAccount = async () => {
      const response = await tradingAccountService.getActiveAccount();
      if (response.success && response.data) {
        setActiveAccount(response.data);
        setRiskDefaults({
          // Use stored value, fallback to tier mid if not set
          defaultRiskPercent: response.data.defaultRiskPercent || 1.0,
          maxDailyDrawdown: response.data.maxDailyDrawdownPct,
          maxTotalDrawdown: response.data.maxTotalDrawdownPct,
          maxDailyTrades: response.data.maxDailyTrades || 3,
        });
        setBio(response.data.bio || "");
        setDiscordWebhook(response.data.discordWebhook || "");
        // Load risk tier
        if (response.data.riskTier) {
          setRiskTier(response.data.riskTier);
        }
        // Load notification setting
        if (response.data.riskNotificationEnabled !== undefined) {
          setRiskNotificationEnabled(response.data.riskNotificationEnabled);
        }
      }
    };

    // Load theme from localStorage
    const savedTheme = localStorage.getItem("hunter-trades-theme") as any;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle("light", savedTheme === "light");
    }

    const fetchAccounts = async () => {
      const allRes = await tradingAccountService.getAll();
      if (allRes.success && allRes.data) {
        setUserAccounts(allRes.data);
      }
    };

    fetchAccount();
    fetchAccounts();
  }, []);

  // Form States
  const [bio, setBio] = useState("");
  const [discordWebhook, setDiscordWebhook] = useState("");
  const [riskTier, setRiskTier] = useState<"CONSERVATIVE" | "MODERATE" | "AGGRESSIVE" | "SPECULATIVE">("MODERATE");
  const [riskNotificationEnabled, setRiskNotificationEnabled] = useState(true);

  const handleSaveProfile = async () => {
    if (!activeAccount) return;
    setIsLoading(true);
    setStatusMsg(null);
    try {
      const response = await tradingAccountService.updateInfo(activeAccount.id, { bio });
      if (response.success) {
        setStatusMsg({ type: 'success', text: "Profile updated successfully!" });
        setActiveAccount(response.data || activeAccount);
      } else {
        setStatusMsg({ type: 'error', text: response.error || "Failed to save profile." });
      }
    } catch (e) {
      setStatusMsg({ type: 'error', text: "Network error." });
    } finally {
      setIsLoading(false);
      setTimeout(() => setStatusMsg(null), 3000);
    }
  };

  const handleSaveIntegration = async () => {
    if (!activeAccount) return;
    setIsLoading(true);
    setStatusMsg(null);
    try {
      const response = await tradingAccountService.updateInfo(activeAccount.id, { discordWebhook });
      if (response.success) {
        setStatusMsg({ type: 'success', text: "Integration updated successfully!" });
        setActiveAccount(response.data || activeAccount);
      } else {
        setStatusMsg({ type: 'error', text: response.error || "Failed to save integration." });
      }
    } catch (e) {
      setStatusMsg({ type: 'error', text: "Network error." });
    } finally {
      setIsLoading(false);
      setTimeout(() => setStatusMsg(null), 3000);
    }
  };

  const handleGenerateApiKey = async () => {
    if (!activeAccount) return;
    if (!confirm("Generate API Key baru akan menggantikan kunci yang lama (jika ada). Lanjutkan?")) return;
    
    setIsLoading(true);
    try {
      const response = await tradingAccountService.generateApiKey(activeAccount.id);
      if (response.success) {
        setStatusMsg({ type: 'success', text: "API Key baru berhasil dibuat!" });
        // Refresh account data to show new key
        const accResponse = await tradingAccountService.getActiveAccount();
        if (accResponse.data) setActiveAccount(accResponse.data);
      }
    } catch (e) {
      setStatusMsg({ type: 'error', text: "Failed to create API Key." });
    } finally {
      setIsLoading(false);
      setTimeout(() => setStatusMsg(null), 3000);
    }
  };

  const handleCreateAccount = async () => {
    if (!newAccountForm.accountName || newAccountForm.initialBalance <= 0) return;
    setIsLoading(true);
    setStatusMsg(null);
    try {
      const res = await tradingAccountService.create({
        ...newAccountForm,
        maxDailyDrawdownPct: 5.0,
        maxTotalDrawdownPct: 10.0,
        maxDailyTrades: 5
      });
      if (res.success && res.data) {
        setStatusMsg({ type: 'success', text: "Berhasil membuat akun Trading baru!" });
        setUserAccounts(prev => [...prev, res.data!]);
        setNewAccountForm({ accountName: "", initialBalance: 1000, broker: "", currency: "USD" });
      } else {
        setStatusMsg({ type: 'error', text: res.error || "Gagal membuat akun." });
      }
    } catch (e) {
      setStatusMsg({ type: 'error', text: "Network error." });
    } finally {
      setIsLoading(false);
      setTimeout(() => setStatusMsg(null), 3000);
    }
  };

  // Update theme helper
  const handleThemeChange = (newTheme: "dark" | "light" | "system") => {
    setTheme(newTheme);
    localStorage.setItem("hunter-trades-theme", newTheme);
    document.documentElement.classList.toggle("light", newTheme === "light");
  };

  const [notifications, setNotifications] = useState({
    tradeAlerts: true,
    aiReviews: false,
    weeklyReports: true,
    achievementUnlocked: true,
  });

  const [riskDefaults, setRiskDefaults] = useState({
    defaultRiskPercent: 1.0,
    maxDailyDrawdown: 5.0,
    maxTotalDrawdown: 10.0,
    maxDailyTrades: 3,
  });

  const [integrationSettings, setIntegrationSettings] = useState({
    discordNotifications: false,
    tradingViewSync: false,
    metatraderConnect: false,
    googleSheetsSync: false,
  });

  const handleSaveRisk = async () => {
    if (!activeAccount) return;

    setIsLoading(true);
    setStatusMsg(null);

    try {
      const response = await tradingAccountService.updateRiskRules(activeAccount.id, {
        maxDailyDrawdownPct: riskDefaults.maxDailyDrawdown,
        maxTotalDrawdownPct: riskDefaults.maxTotalDrawdown,
        maxDailyTrades: riskDefaults.maxDailyTrades,
        riskTier: riskTier,
        defaultRiskPercent: riskDefaults.defaultRiskPercent
      });

      // Save notification setting separately via updateInfo
      if (response.success) {
        await tradingAccountService.updateInfo(activeAccount.id, {
          riskNotificationEnabled: riskNotificationEnabled
        });
        setStatusMsg({ type: 'success', text: "Parameter risiko berhasil diperbarui!" });
        // Refresh local account state
        setActiveAccount(response.data || activeAccount);
      } else {
        setStatusMsg({ type: 'error', text: response.error || "Gagal menyimpan perubahan." });
      }
    } catch (error) {
      setStatusMsg({ type: 'error', text: "Network error occurred." });
    } finally {
      setIsLoading(false);
      setTimeout(() => setStatusMsg(null), 3000);
    }
  };

  const handleExportCsv = async () => {
    window.open("/api/v1/settings/export/csv", "_blank");
  };

  const handleDeleteAllData = async () => {
    if (!confirm("PERINGATAN: Seluruh data trading dan pengaturan Anda akan dihapus secara permanen. Apakah Anda yakin?")) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiClient.post("/api/v1/settings/reset-data", {});
      if (response.success) {
        alert("All data successfully deleted. Page will reload.");
        window.location.href = "/onboarding";
      } else {
        alert("Failed to delete data: " + response.error);
      }
    } catch (error) {
      alert("Network error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  // Get initials for profile placeholder
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  const sections: SettingsSection[] = [
    { id: "profile", label: "Profile", icon: User },
    { id: "accounts", label: "Broker Accounts", icon: Briefcase },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "risk", label: "Risk Management", icon: Shield },
    { id: "integrations", label: "Integrations", icon: Globe },
    { id: "api", label: "API Keys", icon: Key },
    { id: "data", label: "Data & Privacy", icon: Database },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
      {/* Status Message Toast */}
      {statusMsg && (
        <div className={`fixed top-6 right-6 z-50 flex items-center space-x-3 px-6 py-3 rounded-xl border animate-in slide-in-from-right-full duration-300 ${
          statusMsg.type === 'success' ? 'bg-data-profit/10 border-data-profit/20 text-data-profit' : 'bg-data-loss/10 border-data-loss/20 text-data-loss'
        }`}>
          {statusMsg.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          <span className="text-sm font-bold uppercase tracking-widest">{statusMsg.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-[0.1em]">Settings</h1>
          <p className="text-sm text-text-secondary mt-1">Manage your account preferences and settings</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1">
          <div className="glass p-4 sticky top-6">
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
                <h2 className="text-lg font-semibold text-text-primary mb-6">Informasi Profil</h2>
                <div className="flex items-start space-x-6 mb-8">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-accent-gold/10 border-2 border-accent-gold/30 flex items-center justify-center overflow-hidden">
                      {sessionPending ? (
                        <Loader2 className="w-6 h-6 text-accent-gold animate-spin" />
                      ) : session?.user?.image ? (
                        <img src={session.user.image} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-2xl font-mono font-bold text-accent-gold">
                          {getInitials(session?.user?.name || "HT")}
                        </span>
                      )}
                    </div>
                    <button className="absolute bottom-0 right-0 w-8 h-8 bg-accent-gold text-bg-void rounded-full flex items-center justify-center text-xs font-bold hover:brightness-110 shadow-lg border-2 border-bg-surface">
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-text-primary text-lg mb-0.5">
                      {session?.user?.name || "Elite Hunter"}
                    </h3>
                    <p className="text-sm text-text-secondary mb-4 uppercase tracking-widest text-[10px]">
                      {(session?.user as any)?.role === "admin" ? "Founder Member" : "Elite Member"}
                    </p>
                    <div className="flex space-x-2">
                      <button className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-bg-elevated text-text-secondary rounded-lg border border-white/5 hover:border-accent-gold/40 hover:text-accent-gold transition-all">
                        Change Avatar
                      </button>
                      <button className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-bg-elevated text-text-secondary rounded-lg border border-white/5 hover:border-data-loss/40 hover:text-data-loss transition-all">
                        Delete
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-2">Display Name</label>
                      <input
                        type="text"
                        defaultValue={session?.user?.name || ""}
                        readOnly
                        className="w-full bg-bg-input/50 border border-white/5 rounded-xl px-4 py-3 text-text-primary text-sm focus:border-accent-gold focus:outline-none opacity-80 cursor-not-allowed"
                      />
                      <p className="text-[10px] text-text-muted mt-2">Managed through your Discord account</p>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-2">Email Address</label>
                      <input
                        type="email"
                        defaultValue={session?.user?.email || ""}
                        readOnly
                        className="w-full bg-bg-input/50 border border-white/5 rounded-xl px-4 py-3 text-text-primary text-sm focus:border-accent-gold focus:outline-none opacity-80 cursor-not-allowed"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-2">Short Bio</label>
                    <textarea
                      rows={3}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Tell us a bit about your trading style..."
                      className="w-full bg-bg-input border border-white/5 rounded-xl px-4 py-3 text-text-primary text-sm focus:border-accent-gold focus:outline-none resize-none transition-all"
                    />
                  </div>
                  <div className="flex justify-end pt-4">
                    <button 
                      onClick={handleSaveProfile}
                      disabled={isLoading}
                      className="px-6 py-3 bg-accent-gold text-bg-void rounded-xl font-bold uppercase text-[11px] tracking-widest flex items-center space-x-2 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      <span>Save Changes</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Accounts Section */}
          {activeSection === "accounts" && (
            <div className="space-y-6">
              <div className="glass p-6">
                <div className="flex justify-between items-center mb-6">
                   <h2 className="text-lg font-semibold text-text-primary">Your Broker Accounts</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                   {userAccounts.map(account => (
                     <div key={account.id} className={`p-5 rounded-xl border ${account.isActive ? 'border-accent-gold bg-accent-gold/5 shadow-[0_0_15px_rgba(212,175,55,0.1)]' : 'border-white/5 bg-bg-elevated'}`}>
                        <div className="flex justify-between items-start mb-4">
                           <div>
                              <h3 className="font-bold text-text-primary flex items-center gap-2">
                                 {account.accountName}
                                 {account.isActive && <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-accent-gold text-bg-void">Active</span>}
                              </h3>
                              <p className="text-[11px] text-text-secondary mt-1">{account.broker || "No Broker Specified"}</p>
                           </div>
                           <Briefcase className="w-5 h-5 text-text-muted" />
                        </div>
                        <div className="flex justify-between items-end border-t border-white/5 pt-4">
                           <div>
                              <p className="text-[10px] text-text-muted uppercase tracking-widest mb-1">Balance</p>
                              <p className="text-sm font-mono font-bold text-accent-gold">{account.currency} {account.initialBalance.toLocaleString()}</p>
                           </div>
                           {!account.isActive && (
                              <button onClick={() => {
                                 tradingAccountService.setActive(account.id).then(() => window.location.reload());
                              }} className="text-[10px] uppercase font-bold tracking-wider text-text-secondary hover:text-accent-gold">
                                 Set Active
                              </button>
                           )}
                        </div>
                     </div>
                   ))}
                </div>

                <div className="pt-6 border-t border-white/5">
                   <h3 className="text-sm font-bold text-text-primary mb-4 flex items-center"><Plus className="w-4 h-4 mr-2" /> Add New Trading Account</h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-2">Account Name</label>
                        <input type="text" placeholder="e.g. FTMO Challenge 100k" value={newAccountForm.accountName} onChange={e => setNewAccountForm({...newAccountForm, accountName: e.target.value})} className="w-full bg-bg-input border border-white/5 rounded-xl px-4 py-3 text-text-primary text-sm focus:border-accent-gold focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-2">Broker Name</label>
                        <input type="text" placeholder="e.g. FTMO, IC Markets" value={newAccountForm.broker} onChange={e => setNewAccountForm({...newAccountForm, broker: e.target.value})} className="w-full bg-bg-input border border-white/5 rounded-xl px-4 py-3 text-text-primary text-sm focus:border-accent-gold focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-2">Initial Balance</label>
                        <div className="relative">
                           <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-mono">{newAccountForm.currency}</span>
                           <input type="number" min="0" value={newAccountForm.initialBalance} onChange={e => setNewAccountForm({...newAccountForm, initialBalance: parseFloat(e.target.value)})} className="w-full bg-bg-input border border-white/5 rounded-xl pl-12 pr-4 py-3 text-text-primary font-mono focus:border-accent-gold focus:outline-none" />
                        </div>
                      </div>
                   </div>
                   <button onClick={handleCreateAccount} disabled={isLoading || !newAccountForm.accountName} className="px-6 py-3 bg-white/5 hover:bg-accent-gold hover:text-bg-void text-text-primary rounded-xl font-bold uppercase text-[11px] tracking-widest border border-white/10 transition-all disabled:opacity-50 mt-2">
                     Create Broker Account
                   </button>
                   <p className="text-[10px] text-text-muted mt-4">Penting: Data setiap akun terpisah sepenuhnya (Dashboard, Analytics, Trade Log & Playbook).</p>
                </div>
              </div>
            </div>
          )}

          {/* Appearance Section */}
          {activeSection === "appearance" && (
            <div className="space-y-6">
              <div className="glass p-6">
                <h2 className="text-lg font-semibold text-text-primary mb-6">Application Appearance</h2>

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
                          onClick={() => handleThemeChange(option.id as any)}
                          className={`p-4 rounded-lg border transition-all flex flex-col items-center space-y-2 ${
                            isActive
                              ? "bg-accent-gold/10 border-accent-gold text-accent-gold shadow-[0_0_10px_rgba(212,175,55,0.1)]"
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
                  <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-3">Accent Color (Visual Only)</label>
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

                <div className="flex items-center justify-between py-4 border-t border-white/5">
                  <div className="flex items-center space-x-3">
                    <Volume2 className="w-5 h-5 text-text-secondary" />
                    <div>
                      <p className="text-sm font-medium text-text-primary">Sound Effects</p>
                      <p className="text-[11px] text-text-muted">Play sounds for notifications</p>
                    </div>
                  </div>
                  <button className="relative w-12 h-6 rounded-full bg-accent-gold">
                    <div className="absolute top-1 left-7 w-4 h-4 bg-white rounded-full" />
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

                <div className="space-y-2">
                  {[
                    { key: "tradeAlerts", label: "Trade Alerts", desc: "Get notified when trades are executed" },
                    { key: "aiReviews", label: "AI Reviews Ready", desc: "Notifications when new AI analysis is complete" },
                    { key: "weeklyReports", label: "Weekly Performance Reports", desc: "Receive weekly summary every Monday morning" },
                    { key: "achievementUnlocked", label: "Achievements & Milestones", desc: "Celebrate your trading achievements" },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between py-4 border-b border-white/5 last:border-0 hover:bg-white/[0.02] -mx-2 px-2 rounded-lg">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-text-primary">{item.label}</p>
                        <p className="text-[11px] text-text-muted mt-0.5">{item.desc}</p>
                      </div>
                      <button
                        onClick={() => setNotifications({ ...notifications, [item.key as keyof typeof notifications]: !notifications[item.key as keyof typeof notifications] })}
                        className={`relative w-12 h-6 rounded-full transition-colors ${
                          notifications[item.key as keyof typeof notifications] ? "bg-accent-gold" : "bg-bg-void"
                        }`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${notifications[item.key as keyof typeof notifications] ? "left-7 shadow-[-2px_0_5px_rgba(0,0,0,0.3)]" : "left-1"}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Risk Management Section */}
          {activeSection === "risk" && (
            <div className="space-y-6">
              <div className="glass p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-semibold text-text-primary">Risk Management (Live)</h2>
                  {activeAccount && (
                    <span className="text-[10px] font-mono text-accent-gold bg-accent-gold/5 px-2 py-1 rounded border border-accent-gold/20 tracking-wider">
                      ID: {activeAccount.id.substring(0, 8)}...
                    </span>
                  )}
                </div>

                <div className="space-y-8">
                  <div>
                    <div className="flex justify-between mb-3 text-sm">
                      <label className="font-medium text-text-primary uppercase tracking-wider text-[11px]">Risk Limit per Trade (%)</label>
                      <span className="font-mono text-accent-gold font-bold">{riskDefaults.defaultRiskPercent}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="5"
                      step="0.1"
                      value={riskDefaults.defaultRiskPercent}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        setRiskDefaults(prev => ({ ...prev, defaultRiskPercent: value }));
                        // Auto-update risk tier based on value
                        if (value <= 1) setRiskTier("CONSERVATIVE");
                        else if (value <= 2) setRiskTier("MODERATE");
                        else if (value <= 3) setRiskTier("AGGRESSIVE");
                        else setRiskTier("SPECULATIVE");
                      }}
                      className="w-full h-1.5 bg-bg-void rounded-full appearance-none cursor-pointer accent-accent-gold"
                    />
                  </div>

                  {/* Risk Tier System */}
                  <div className="pt-4 border-t border-white/5">
                    <div className="flex justify-between mb-4">
                      <label className="font-medium text-text-primary uppercase tracking-wider text-[11px]">Risk Tier</label>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: "CONSERVATIVE", label: "Conservative", desc: "0.5-1%", color: "text-data-profit" },
                        { id: "MODERATE", label: "Moderate", desc: "1-2%", color: "text-accent-gold" },
                        { id: "AGGRESSIVE", label: "Aggressive", desc: "2-3%", color: "text-orange-500" },
                        { id: "SPECULATIVE", label: "Speculative", desc: "3-5%", color: "text-data-loss" },
                      ].map((tier) => {
                        const isActive = riskTier === tier.id;
                        return (
                          <button
                            key={tier.id}
                            onClick={() => {
                              setRiskTier(tier.id as any);
                              // Auto-adjust slider to middle of tier range
                              const tierRiskMap: Record<string, number> = {
                                CONSERVATIVE: 0.75,
                                MODERATE: 1.5,
                                AGGRESSIVE: 2.5,
                                SPECULATIVE: 4.0
                              };
                              setRiskDefaults(prev => ({
                                ...prev,
                                defaultRiskPercent: tierRiskMap[tier.id]
                              }));
                            }}
                            className={`p-4 rounded-xl border transition-all text-left ${
                              isActive
                                ? "bg-accent-gold/10 border-accent-gold shadow-[0_0_15px_rgba(212,175,55,0.15)]"
                                : "bg-bg-elevated border-border-subtle hover:border-accent-gold/40"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className={`text-xs font-bold uppercase tracking-wider ${isActive ? "text-accent-gold" : "text-text-secondary"}`}>
                                {tier.label}
                              </span>
                              {isActive && <div className="w-2 h-2 rounded-full bg-accent-gold animate-pulse" />}
                            </div>
                            <p className={`text-[10px] ${tier.color} font-mono`}>{tier.desc} default</p>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-text-muted mt-3 italic">
                      * Tier mengatur batas risiko default. Anda masih bisa menyesuaikan persentase di atas ini.
                    </p>
                  </div>

                  {/* AI Notifications Toggle */}
                  <div className="pt-6 border-t border-white/5">
                    <div className="flex items-center justify-between p-4 bg-bg-elevated/40 rounded-xl border border-white/5">
                      <div>
                        <p className="text-sm font-semibold text-text-primary uppercase tracking-wider">AI Risk Guard Notifications</p>
                        <p className="text-[11px] text-text-muted mt-1">
                          Dapatkan pengingat otomatis dari AI jika risiko melebihi tier atau pattern overtrade terdeteksi
                        </p>
                      </div>
                      <button
                        onClick={() => setRiskNotificationEnabled(!riskNotificationEnabled)}
                        className={`relative w-14 h-7 rounded-full transition-colors ${
                          riskNotificationEnabled ? "bg-accent-gold shadow-[0_0_10px_rgba(212,175,55,0.3)]" : "bg-bg-void"
                        }`}
                      >
                        <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all ${riskNotificationEnabled ? "left-8" : "left-1"}`} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-3 text-sm">
                      <label className="font-medium text-text-primary uppercase tracking-wider text-[11px]">Maximum Daily Drawdown (%)</label>
                      <span className="font-mono text-data-loss font-bold">{riskDefaults.maxDailyDrawdown}%</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      step="0.5"
                      value={riskDefaults.maxDailyDrawdown}
                      onChange={(e) => setRiskDefaults({ ...riskDefaults, maxDailyDrawdown: parseFloat(e.target.value) })}
                      className="w-full h-1.5 bg-bg-void rounded-full appearance-none cursor-pointer accent-data-loss"
                    />
                    <p className="text-[10px] text-text-muted mt-2 italic">* Trading will be automatically stopped if daily loss reaches this limit.</p>
                  </div>

                  <div>
                    <div className="flex justify-between mb-3 text-sm">
                      <label className="font-medium text-text-primary uppercase tracking-wider text-[11px]">Maximum Total Drawdown (%)</label>
                      <span className="font-mono text-data-loss font-bold">{riskDefaults.maxTotalDrawdown}%</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="50"
                      step="1"
                      value={riskDefaults.maxTotalDrawdown}
                      onChange={(e) => setRiskDefaults({ ...riskDefaults, maxTotalDrawdown: parseFloat(e.target.value) })}
                      className="w-full h-1.5 bg-bg-void rounded-full appearance-none cursor-pointer accent-data-loss"
                    />
                  </div>

                  <div className="pt-8 border-t border-white/5 flex gap-4">
                    <button 
                      onClick={handleSaveRisk}
                      disabled={isLoading || !activeAccount}
                      className="flex-1 py-4 bg-accent-gold text-bg-void rounded-xl font-bold uppercase text-[11px] tracking-widest flex items-center justify-center space-x-3 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      <span>Save Risk Rules</span>
                    </button>
                  </div>
                </div>

                <div className="mt-8 p-5 bg-accent-gold/5 border border-accent-gold/20 rounded-2xl flex items-start space-x-4 animate-pulse-slow">
                   <Shield className="w-6 h-6 text-accent-gold shrink-0 mt-1" />
                   <div>
                      <h5 className="text-[12px] font-bold text-accent-gold uppercase tracking-[0.1em] mb-1">Active Risk Guard</h5>
                      <p className="text-[11px] text-text-secondary leading-relaxed font-sans">
                        Your capital protection system is monitoring account <strong>{activeAccount?.accountName || "Member"}</strong> in real-time. The drawdown parameters you saved will be applied to dashboard calculations immediately.
                      </p>
                   </div>
                </div>
              </div>
            </div>
          )}

          {/* Integrations Section */}
          {activeSection === "integrations" && (
            <div className="space-y-6">
              <div className="glass p-6">
                <h2 className="text-lg font-semibold text-text-primary mb-6">Third-Party Integrations</h2>
                <div className="space-y-4">
                  {[
                    { key: "discordNotifications", label: "Discord Webhook", desc: "Send trade signals to your Discord channel" },
                    { key: "tradingViewSync", label: "TradingView Sync", desc: "Auto-import trades from Pine scripts" },
                    { key: "metatraderConnect", label: "MetaTrader (MT4/MT5)", desc: "Capture trades directly from terminal" },
                  ].map((item) => (
                    <div key={item.key} className="p-4 bg-bg-elevated/40 rounded-xl border border-white/5 group hover:border-accent-gold/20 transition-all">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-text-primary">{item.label}</p>
                          <p className="text-[11px] text-text-muted mt-0.5">{item.desc}</p>
                        </div>
                        <button
                          onClick={() => setIntegrationSettings({ ...integrationSettings, [item.key as keyof typeof integrationSettings]: !integrationSettings[item.key as keyof typeof integrationSettings] })}
                          className={`relative w-12 h-6 rounded-full transition-colors ${
                            integrationSettings[item.key as keyof typeof integrationSettings] ? "bg-accent-gold shadow-[0_0_10px_rgba(212,175,55,0.2)]" : "bg-bg-void"
                          }`}
                        >
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${integrationSettings[item.key as keyof typeof integrationSettings] ? "left-7" : "left-1"}`} />
                        </button>
                      </div>
                      {integrationSettings[item.key as keyof typeof integrationSettings] && (
                        <div className="mt-4 pt-4 border-t border-white/5 animate-in slide-in-from-top-2 duration-300">
                          <input 
                            type="text" 
                            value={item.key === 'discordNotifications' ? discordWebhook : ''}
                            onChange={(e) => item.key === 'discordNotifications' && setDiscordWebhook(e.target.value)}
                            placeholder="Enter Webhook URL or API Key..."
                            className="w-full bg-bg-void/50 border border-white/10 rounded-lg px-4 py-3 text-xs text-text-primary focus:border-accent-gold outline-none" 
                          />
                          <div className="flex justify-between items-center mt-2">
                             <p className="text-[9px] text-text-muted">Save this data to start auto-sync.</p>
                             {item.key === 'discordNotifications' && (
                                <button
                                  onClick={handleSaveIntegration}
                                  disabled={isLoading}
                                  className="text-[10px] font-bold text-accent-gold hover:underline"
                                >
                                   Save
                                </button>
                             )}
                          </div>
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
                <h2 className="text-lg font-semibold text-text-primary mb-6">API Keys Management</h2>
                <div className="space-y-6">
                   <div className="p-5 bg-bg-void/40 border border-white/5 rounded-2xl">
                      <div className="flex items-center justify-between mb-4">
                         <div>
                            <p className="text-sm font-bold text-text-primary uppercase tracking-widest">Active API Key</p>
                            <p className="text-[10px] text-text-muted">Use this key for programmatic access</p>
                         </div>
                         <button 
                           onClick={handleGenerateApiKey}
                           disabled={isLoading}
                           className="px-4 py-2 bg-accent-gold/10 border border-accent-gold/30 text-accent-gold text-[10px] font-bold uppercase tracking-wider rounded-lg hover:bg-accent-gold hover:text-bg-void transition-all"
                         >
                            {activeAccount?.apiKey ? "Regenerate" : "Generate Key"}
                         </button>
                      </div>
                      
                      <div className="relative group">
                         <input 
                           type="text" 
                           readOnly
                           value={activeAccount?.apiKey || "No API Key created yet"}
                           className="w-full bg-bg-void border border-white/10 rounded-xl px-4 py-4 text-xs font-mono text-accent-gold focus:outline-none"
                         />
                         {activeAccount?.apiKey && (
                            <button 
                              onClick={() => {navigator.clipboard.writeText(activeAccount.apiKey || ""); alert("Copied!");}}
                              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-white/5 rounded-lg text-text-secondary hover:text-accent-gold opacity-0 group-hover:opacity-100 transition-all"
                            >
                               <SettingsIcon className="w-4 h-4 rotate-90" />
                            </button>
                         )}
                      </div>
                   </div>

                   <div className="p-4 bg-data-profit/5 border border-data-profit/20 rounded-xl flex items-start space-x-3">
                      <CheckCircle className="w-5 h-5 text-data-profit shrink-0" />
                      <p className="text-[11px] text-text-secondary leading-relaxed">
                         This API key allows you to auto-import trading data from other software via our REST endpoint. Always keep your access key confidential.
                      </p>
                   </div>
                </div>
              </div>
            </div>
          )}

          {/* Data & Privacy Section */}
          {activeSection === "data" && (
            <div className="space-y-6">
              <div className="glass p-6">
                <h2 className="text-lg font-semibold text-text-primary mb-6">Data & Privacy Center</h2>
                
                <div className="space-y-8">
                   <div>
                      <h4 className="text-[11px] font-bold text-text-secondary uppercase tracking-widest mb-4">Export Data</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <button 
                           onClick={handleExportCsv}
                           className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-transparent hover:border-accent-gold/30 hover:bg-accent-gold/5 transition-all text-left"
                         >
                            <div>
                               <p className="text-sm font-bold text-text-primary">CSV Format</p>
                               <p className="text-[10px] text-text-muted mt-1">Complete with P&L History</p>
                            </div>
                            <Download className="w-5 h-5 text-accent-gold" />
                         </button>
                         <button disabled className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-transparent opacity-40 grayscale text-left">
                            <div>
                               <p className="text-sm font-bold text-text-primary">PDF Format (Report)</p>
                               <p className="text-[10px] text-text-muted mt-1">Coming Soon</p>
                            </div>
                            <Globe className="w-5 h-5 text-text-muted" />
                         </button>
                      </div>
                   </div>

                   <div className="pt-8 border-t border-data-loss/10">
                      <h4 className="text-[11px] font-bold text-data-loss uppercase tracking-widest mb-4">Danger Zone</h4>
                      <div className="p-5 bg-data-loss/5 border border-data-loss/20 rounded-2xl">
                         <div className="flex items-start space-x-4 mb-6">
                            <Trash2 className="w-6 h-6 text-data-loss shrink-0" />
                            <div>
                               <h5 className="text-[13px] font-bold text-data-loss uppercase">Delete All Data</h5>
                               <p className="text-[11px] text-text-secondary mt-1">This action will permanently delete all your trades, playbook, and statistics from our servers.</p>
                            </div>
                         </div>
                         <button 
                           onClick={handleDeleteAllData}
                           disabled={isLoading}
                           className="w-full py-4 bg-data-loss/10 border border-data-loss/30 text-data-loss rounded-xl font-bold uppercase text-[11px] tracking-widest hover:bg-data-loss hover:text-white transition-all active:scale-95"
                         >
                            {isLoading ? "Deleting..." : "Permanently Delete All Trades"}
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


// End of file
