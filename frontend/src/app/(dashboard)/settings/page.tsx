"use client";

import { 
  Settings as SettingsIcon, 
  User, Bell, Palette, Shield, Database, Globe, Key, Save, Moon, Sun, 
  Volume2, VolumeX, Loader2, Camera, Download, Trash2, AlertTriangle, CheckCircle 
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

  // Appearance State
  const [theme, setTheme] = useState<"dark" | "light" | "system">("dark");

  // Load active account and theme
  useEffect(() => {
    const fetchAccount = async () => {
      const response = await tradingAccountService.getActiveAccount();
      if (response.success && response.data) {
        setActiveAccount(response.data);
        setRiskDefaults({
          defaultRiskPercent: 1.0, 
          maxDailyDrawdown: response.data.maxDailyDrawdownPct,
          maxTotalDrawdown: response.data.maxTotalDrawdownPct,
          maxDailyTrades: response.data.maxDailyTrades || 3,
        });
        setBio(response.data.bio || "");
        setDiscordWebhook(response.data.discordWebhook || "");
      }
    };

    // Load theme from localStorage
    const savedTheme = localStorage.getItem("hunter-trades-theme") as any;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle("light", savedTheme === "light");
    }

    fetchAccount();
  }, []);

  // Form States
  const [bio, setBio] = useState("");
  const [discordWebhook, setDiscordWebhook] = useState("");

  const handleSaveProfile = async () => {
    if (!activeAccount) return;
    setIsLoading(true);
    setStatusMsg(null);
    try {
      const response = await tradingAccountService.updateInfo(activeAccount.id, { bio });
      if (response.success) {
        setStatusMsg({ type: 'success', text: "Profil berhasil diperbarui!" });
        setActiveAccount(response.data || activeAccount);
      } else {
        setStatusMsg({ type: 'error', text: response.error || "Gagal menyimpan profil." });
      }
    } catch (e) {
      setStatusMsg({ type: 'error', text: "Kesalahan jaringan." });
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
        setStatusMsg({ type: 'success', text: "Integrasi berhasil diperbarui!" });
        setActiveAccount(response.data || activeAccount);
      } else {
        setStatusMsg({ type: 'error', text: response.error || "Gagal menyimpan integrasi." });
      }
    } catch (e) {
      setStatusMsg({ type: 'error', text: "Kesalahan jaringan." });
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
      setStatusMsg({ type: 'error', text: "Gagal membuat API Key." });
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
        maxDailyTrades: riskDefaults.maxDailyTrades
      });
      
      if (response.success) {
        setStatusMsg({ type: 'success', text: "Parameter risiko berhasil diperbarui!" });
        // Refresh local account state
        setActiveAccount(response.data || activeAccount);
      } else {
        setStatusMsg({ type: 'error', text: response.error || "Gagal menyimpan perubahan." });
      }
    } catch (error) {
      setStatusMsg({ type: 'error', text: "Terjadi kesalahan jaringan." });
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
        alert("Seluruh data berhasil dihapus. Halaman akan dimuat ulang.");
        window.location.href = "/onboarding";
      } else {
        alert("Gagal menghapus data: " + response.error);
      }
    } catch (error) {
      alert("Terjadi kesalahan jaringan.");
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
          <h1 className="text-2xl font-bold text-text-primary tracking-[0.1em]">Pengaturan</h1>
          <p className="text-sm text-text-secondary mt-1">Kelola preferensi dan pengaturan akun Anda</p>
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
                        Ubah Avatar
                      </button>
                      <button className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-bg-elevated text-text-secondary rounded-lg border border-white/5 hover:border-data-loss/40 hover:text-data-loss transition-all">
                        Hapus
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-2">Nama Tampilan</label>
                      <input
                        type="text"
                        defaultValue={session?.user?.name || ""}
                        readOnly
                        className="w-full bg-bg-input/50 border border-white/5 rounded-xl px-4 py-3 text-text-primary text-sm focus:border-accent-gold focus:outline-none opacity-80 cursor-not-allowed"
                      />
                      <p className="text-[10px] text-text-muted mt-2">Dikelola melalui akun Discord Anda</p>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-2">Alamat Email</label>
                      <input
                        type="email"
                        defaultValue={session?.user?.email || ""}
                        readOnly
                        className="w-full bg-bg-input/50 border border-white/5 rounded-xl px-4 py-3 text-text-primary text-sm focus:border-accent-gold focus:outline-none opacity-80 cursor-not-allowed"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-2">Bio Singkat</label>
                    <textarea
                      rows={3}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Ceritakan sedikit tentang gaya trading Anda..."
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
                      <span>Simpan Perubahan</span>
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
                <h2 className="text-lg font-semibold text-text-primary mb-6">Tampilan Aplikasi</h2>

                <div className="mb-8">
                  <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-3">Tema</label>
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
                <h2 className="text-lg font-semibold text-text-primary mb-6">Pengaturan Notifikasi</h2>

                <div className="space-y-2">
                  {[
                    { key: "tradeAlerts", label: "Trade Alerts", desc: "Dapatkan notifikasi saat trade dieksekusi" },
                    { key: "aiReviews", label: "AI Reviews Ready", desc: "Notifikasi saat analisis AI baru selesai" },
                    { key: "weeklyReports", label: "Weekly Performance Reports", desc: "Terima ringkasan mingguan setiap Senin pagi" },
                    { key: "achievementUnlocked", label: "Achievements & Milestones", desc: "Rayakan pencapaian trading Anda" },
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
                  <h2 className="text-lg font-semibold text-text-primary">Manajemen Risiko (Live)</h2>
                  {activeAccount && (
                    <span className="text-[10px] font-mono text-accent-gold bg-accent-gold/5 px-2 py-1 rounded border border-accent-gold/20 tracking-wider">
                      ID: {activeAccount.id.substring(0, 8)}...
                    </span>
                  )}
                </div>

                <div className="space-y-8">
                  <div>
                    <div className="flex justify-between mb-3 text-sm">
                      <label className="font-medium text-text-primary uppercase tracking-wider text-[11px]">Batas Risiko per Trade (Visual Only)</label>
                      <span className="font-mono text-accent-gold font-bold">{riskDefaults.defaultRiskPercent}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="5"
                      step="0.1"
                      value={riskDefaults.defaultRiskPercent}
                      onChange={(e) => setRiskDefaults({ ...riskDefaults, defaultRiskPercent: parseFloat(e.target.value) })}
                      className="w-full h-1.5 bg-bg-void rounded-full appearance-none cursor-pointer accent-accent-gold"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-3 text-sm">
                      <label className="font-medium text-text-primary uppercase tracking-wider text-[11px]">Maksimum Harian Drawdown (%)</label>
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
                    <p className="text-[10px] text-text-muted mt-2 italic">* Trading akan dihentikan otomatis jika loss harian mencapai batas ini.</p>
                  </div>

                  <div>
                    <div className="flex justify-between mb-3 text-sm">
                      <label className="font-medium text-text-primary uppercase tracking-wider text-[11px]">Maksimum Total Drawdown (%)</label>
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
                      <span>Simpan Aturan Risiko</span>
                    </button>
                  </div>
                </div>

                <div className="mt-8 p-5 bg-accent-gold/5 border border-accent-gold/20 rounded-2xl flex items-start space-x-4 animate-pulse-slow">
                   <Shield className="w-6 h-6 text-accent-gold shrink-0 mt-1" />
                   <div>
                      <h5 className="text-[12px] font-bold text-accent-gold uppercase tracking-[0.1em] mb-1">Risk Guard Aktif</h5>
                      <p className="text-[11px] text-text-secondary leading-relaxed font-sans">
                        Sistem perlindungan modal Anda sedang memantau akun <strong>{activeAccount?.accountName || "Member"}</strong> secara real-time. Parameter drawdown yang Anda simpan akan segera diterapkan pada perhitungan dashboard.
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
                <h2 className="text-lg font-semibold text-text-primary mb-6">Integrasi Pihak Ketiga</h2>
                <div className="space-y-4">
                  {[
                    { key: "discordNotifications", label: "Discord Webhook", desc: "Kirim sinyal trade ke Discord chanel Anda" },
                    { key: "tradingViewSync", label: "TradingView Sync", desc: "Impor trade otomatis dari skrip Pine" },
                    { key: "metatraderConnect", label: "MetaTrader (MT4/MT5)", desc: " capture trade langsung dari terminal" },
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
                            placeholder="Masukkan Webhook URL atau API Key..."
                            className="w-full bg-bg-void/50 border border-white/10 rounded-lg px-4 py-3 text-xs text-text-primary focus:border-accent-gold outline-none" 
                          />
                          <div className="flex justify-between items-center mt-2">
                             <p className="text-[9px] text-text-muted">Simpan data ini untuk memulai sinkronisasi otomatis.</p>
                             {item.key === 'discordNotifications' && (
                                <button 
                                  onClick={handleSaveIntegration}
                                  disabled={isLoading}
                                  className="text-[10px] font-bold text-accent-gold hover:underline"
                                >
                                   Simpan
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
                            <p className="text-[10px] text-text-muted">Gunakan kunci ini untuk akses programmatic</p>
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
                           value={activeAccount?.apiKey || "Belum ada API Key yang dibuat"}
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
                         API Key ini memungkinkan Anda mengimpor data trading secara otomatis dari perangkat lunak lain melalui endpoint REST kami. Selalu jaga kerahasiaan kunci akses Anda.
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
                <h2 className="text-lg font-semibold text-text-primary mb-6">Pusat Data & Privasi</h2>
                
                <div className="space-y-8">
                   <div>
                      <h4 className="text-[11px] font-bold text-text-secondary uppercase tracking-widest mb-4">Ekspor Data</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <button 
                           onClick={handleExportCsv}
                           className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-transparent hover:border-accent-gold/30 hover:bg-accent-gold/5 transition-all text-left"
                         >
                            <div>
                               <p className="text-sm font-bold text-text-primary">Format CSV</p>
                               <p className="text-[10px] text-text-muted mt-1">Lengkap dengan Riwayat PnL</p>
                            </div>
                            <Download className="w-5 h-5 text-accent-gold" />
                         </button>
                         <button disabled className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-transparent opacity-40 grayscale text-left">
                            <div>
                               <p className="text-sm font-bold text-text-primary">Format PDF (Report)</p>
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
                               <h5 className="text-[13px] font-bold text-data-loss uppercase">Hapus Seluruh Data</h5>
                               <p className="text-[11px] text-text-secondary mt-1">Tindakan ini akan menghapus seluruh trade, playbook, dan statistik Anda secara permanen dari server kami.</p>
                            </div>
                         </div>
                         <button 
                           onClick={handleDeleteAllData}
                           disabled={isLoading}
                           className="w-full py-4 bg-data-loss/10 border border-data-loss/30 text-data-loss rounded-xl font-bold uppercase text-[11px] tracking-widest hover:bg-data-loss hover:text-white transition-all active:scale-95"
                         >
                            {isLoading ? "Sedang Menghapus..." : "Hapus Permanen Seluruh Trade"}
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
