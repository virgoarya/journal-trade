"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Check, 
  Activity, 
  Zap, 
  ArrowRight, 
  ArrowLeft, 
  Wallet, 
  Target, 
  ShieldCheck,
  Loader2,
  AlertCircle
} from "lucide-react";
import { tradingAccountService } from "@/services/trading-account.service";
import { useSession } from "@/lib/auth-client";

type Step = 1 | 2 | 3;

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = useSession();
  
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    accountName: "",
    initialBalance: "",
    currency: "USD",
    broker: "",
    maxDailyDrawdownPct: "2",
    maxTotalDrawdownPct: "5",
    maxDailyTrades: "5",
  });

  useEffect(() => {
    if (!sessionPending && !session) {
      router.push("/");
    }
  }, [session, sessionPending, router]);

  const handleNext = () => {
    if (currentStep < 3) setCurrentStep((s) => (s + 1) as Step);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep((s) => (s - 1) as Step);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStep < 3) {
      handleNext();
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const result = await tradingAccountService.create({
        accountName: formData.accountName,
        initialBalance: parseFloat(formData.initialBalance),
        currency: formData.currency,
        broker: formData.broker,
        maxDailyDrawdownPct: parseFloat(formData.maxDailyDrawdownPct),
        maxTotalDrawdownPct: parseFloat(formData.maxTotalDrawdownPct),
        maxDailyTrades: parseInt(formData.maxDailyTrades),
      });

      if (result.success) {
        router.push("/dashboard");
      } else {
        setError(result.error || "Gagal menyimpan konfigurasi");
      }
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan sistem");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (sessionPending) return null;

  return (
    <div className="min-h-screen bg-[#050508] text-[#e5e1e7] font-sans selection:bg-[#d4af37]/30 selection:text-[#f2ca50] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      
      {/* Background Decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#d4af37]/5 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#d4af37]/5 rounded-full blur-[120px]"></div>
      </div>

      <main className="w-full max-w-[640px] flex flex-col gap-8">
        
        {/* Header / Logo */}
        <div className="text-center space-y-2">
          <h1 className="font-sans font-extrabold text-[#d4af37] text-2xl tracking-[0.2em] uppercase">HUNTER TRADES</h1>
          <p className="font-sans text-[#d0c5af]/60 text-[10px] tracking-[0.3em] uppercase">Elite Ledger Setup</p>
        </div>

        {/* Stepper */}
        <nav className="flex justify-between items-start relative px-2">
          <div className="absolute top-4 left-10 right-10 h-[1px] bg-white/10 -z-10">
            <motion.div 
              className="h-full bg-[#d4af37]" 
              initial={{ width: "0%" }}
              animate={{ width: currentStep === 1 ? "0%" : currentStep === 2 ? "50%" : "100%" }}
            ></motion.div>
          </div>

          {/* Steps */}
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex flex-col items-center gap-3 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500 ${
                currentStep > step ? "bg-[#d4af37] text-[#050508]" : 
                currentStep === step ? "border-2 border-[#d4af37] text-[#d4af37] bg-[#0A0A12] shadow-[0_0_15px_rgba(212,175,55,0.3)]" : 
                "border border-white/10 text-white/20 bg-[#0A0A12]"
              }`}>
                {currentStep > step ? <Check className="w-4 h-4" /> : <span className="font-mono text-sm font-bold">{step}</span>}
              </div>
              <span className={`font-sans text-[9px] font-bold tracking-wider uppercase ${
                currentStep >= step ? "text-[#e5e1e7]" : "text-white/20"
              }`}>
                {step === 1 ? "Selamat Datang" : step === 2 ? "Akun Trading" : "Aturan Risiko"}
              </span>
            </div>
          ))}
        </nav>

        {/* Form Section */}
        <section className="bg-[#0A0A12]/70 backdrop-blur-xl border border-white/5 rounded-2xl p-8 md:p-10 shadow-2xl relative overflow-hidden">
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <AnimatePresence mode="wait">
              {currentStep === 1 && (
                <motion.div 
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6 text-center py-4"
                >
                  <div className="w-16 h-16 bg-[#d4af37]/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <ShieldCheck className="w-8 h-8 text-[#d4af37]" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">Siap Menguasai Market?</h2>
                  <p className="text-[#d0c5af]/70 text-sm leading-relaxed max-w-md mx-auto">
                    Selamat datang di Hunter Trades. Langkah awal menjadi <span className="text-[#d4af37] font-bold">Elite Trader</span> dimulai dengan kedisiplinan pencatatan data. Mari siapkan akun trading Anda.
                  </p>
                  <div className="pt-6">
                    <button 
                      type="button"
                      onClick={handleNext}
                      className="px-10 py-3 bg-[#d4af37] text-[#050508] text-xs font-bold tracking-widest rounded-xl hover:brightness-110 transition-all shadow-[0_0_20px_rgba(212,175,55,0.2)] uppercase flex items-center mx-auto gap-2"
                    >
                      Mulai Setup <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}

              {currentStep === 2 && (
                <motion.div 
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="text-xl font-bold text-white mb-2">Konfigurasi Akun</h2>
                    <p className="text-[#d0c5af]/70 text-sm">Tentukan modal dasar dan platform eksekusi untuk perhitungan presisi.</p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold tracking-widest text-[#d0c5af]/60 uppercase">Nama Akun</label>
                      <input 
                        required
                        className="w-full bg-[#1b1b1f] border-transparent focus:border-[#f2ca50]/50 focus:ring-0 rounded-xl px-4 py-3 text-sm transition-all placeholder:text-white/10" 
                        placeholder="Contoh: Aggressive Intraday" 
                        type="text"
                        value={formData.accountName}
                        onChange={(e) => setFormData({...formData, accountName: e.target.value})}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="block text-[10px] font-bold tracking-widest text-[#d0c5af]/60 uppercase">Saldo Awal</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-[#d4af37]/60">$</span>
                          <input 
                            required
                            className="w-full bg-[#1b1b1f] border-transparent focus:border-[#f2ca50]/50 focus:ring-0 rounded-xl pl-8 pr-4 py-3 text-sm font-mono transition-all" 
                            placeholder="0.00" 
                            type="number"
                            value={formData.initialBalance}
                            onChange={(e) => setFormData({...formData, initialBalance: e.target.value})}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-[10px] font-bold tracking-widest text-[#d0c5af]/60 uppercase">Mata Uang</label>
                        <div className="w-full bg-[#1b1b1f] border-transparent rounded-xl px-4 py-3 text-sm flex items-center text-[#d4af37] font-bold">
                          USD - United States Dollar
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold tracking-widest text-[#d0c5af]/60 uppercase">Platform Broker</label>
                      <input 
                        required
                        className="w-full bg-[#1b1b1f] border-transparent focus:border-[#f2ca50]/50 focus:ring-0 rounded-xl px-4 py-3 text-sm transition-all placeholder:text-white/10" 
                        placeholder="Nama platform broker Anda" 
                        type="text"
                        value={formData.broker}
                        onChange={(e) => setFormData({...formData, broker: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-6">
                    <button 
                      type="button"
                      onClick={handleBack}
                      className="flex items-center gap-2 text-xs font-bold text-[#d0c5af]/60 hover:text-[#d4af37] uppercase tracking-widest transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" /> Kembali
                    </button>
                    <button 
                      type="button"
                      onClick={handleNext}
                      className="px-10 py-3 bg-[#d4af37] text-[#050508] text-xs font-bold tracking-widest rounded-xl hover:brightness-110 transition-all shadow-[0_0_20px_rgba(212,175,55,0.2)] uppercase"
                    >
                      Lanjut
                    </button>
                  </div>
                </motion.div>
              )}

              {currentStep === 3 && (
                <motion.div 
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="text-xl font-bold text-white mb-2">Aturan Risiko</h2>
                    <p className="text-[#d0c5af]/70 text-sm">Patuhi batasan ini untuk menjaga umur trading Anda tetap panjang.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold tracking-widest text-[#d0c5af]/60 uppercase">Max Daily Drawdown</label>
                      <div className="relative">
                        <input 
                          required
                          className="w-full bg-[#1b1b1f] border-transparent focus:border-[#f2ca50]/50 focus:ring-0 rounded-xl px-4 py-3 text-sm font-mono transition-all" 
                          type="number"
                          value={formData.maxDailyDrawdownPct}
                          onChange={(e) => setFormData({...formData, maxDailyDrawdownPct: e.target.value})}
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 font-mono text-[#d4af37]/60">%</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold tracking-widest text-[#d0c5af]/60 uppercase">Max Total Drawdown</label>
                      <div className="relative">
                        <input 
                          required
                          className="w-full bg-[#1b1b1f] border-transparent focus:border-[#f2ca50]/50 focus:ring-0 rounded-xl px-4 py-3 text-sm font-mono transition-all" 
                          type="number"
                          value={formData.maxTotalDrawdownPct}
                          onChange={(e) => setFormData({...formData, maxTotalDrawdownPct: e.target.value})}
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 font-mono text-[#d4af37]/60">%</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold tracking-widest text-[#d0c5af]/60 uppercase">Max Trades Per Day</label>
                    <input 
                      required
                      className="w-full bg-[#1b1b1f] border-transparent focus:border-[#f2ca50]/50 focus:ring-0 rounded-xl px-4 py-3 text-sm font-mono transition-all" 
                      type="number"
                      value={formData.maxDailyTrades}
                      onChange={(e) => setFormData({...formData, maxDailyTrades: e.target.value})}
                    />
                  </div>

                  {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-500 text-xs">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {error}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-6">
                    <button 
                      type="button"
                      onClick={handleBack}
                      className="flex items-center gap-2 text-xs font-bold text-[#d0c5af]/60 hover:text-[#d4af37] uppercase tracking-widest transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" /> Kembali
                    </button>
                    <button 
                      disabled={isSubmitting}
                      type="submit"
                      className="px-10 py-3 bg-[#d4af37] text-[#050508] text-xs font-bold tracking-widest rounded-xl hover:brightness-110 transition-all shadow-[0_0_20px_rgba(212,175,55,0.2)] uppercase disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" /> Sedang Memproses...
                        </div>
                      ) : (
                        "Simpan Akun Elite"
                      )}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        </section>

        {/* Live Preview Summary */}
        <section className="bg-[#0A0A12]/70 backdrop-blur-xl rounded-2xl overflow-hidden border border-white/5 border-t-2 border-t-[#d4af37] shadow-xl">
          <div className="px-6 py-3 bg-[#d4af37]/5 flex items-center gap-3">
             <Activity className="w-4 h-4 text-[#d4af37]" />
             <h3 className="font-sans font-bold text-[10px] tracking-widest text-[#d4af37] uppercase">Elite Ledger Summary</h3>
          </div>
          <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-6 border-b border-white/5">
             <div className="space-y-1">
                <span className="block text-[8px] text-white/20 uppercase tracking-widest">Account Name</span>
                <span className="block font-mono text-xs text-[#d4af37] truncate">{formData.accountName || "---"}</span>
             </div>
             <div className="space-y-1">
                <span className="block text-[8px] text-white/20 uppercase tracking-widest">Starting Bal.</span>
                <span className="block font-mono text-xs text-[#d4af37]">$ {parseFloat(formData.initialBalance || "0").toLocaleString()}</span>
             </div>
             <div className="space-y-1">
                <span className="block text-[8px] text-white/20 uppercase tracking-widest">Platform</span>
                <span className="block font-mono text-xs text-[#d4af37] truncate">{formData.broker || "---"}</span>
             </div>
             <div className="space-y-1">
                <span className="block text-[8px] text-white/20 uppercase tracking-widest">Daily Risk</span>
                <span className="block font-mono text-xs text-[#d4af37]">{formData.maxDailyDrawdownPct}%</span>
             </div>
          </div>
          <div className="px-6 py-4 bg-black/20">
             <p className="font-mono text-[9px] text-[#d0c5af]/40 leading-relaxed italic">
                [SYSTEM]: Menunggu sinkronisasi parameter trading untuk inisialisasi algoritma performa...
             </p>
          </div>
        </section>

      </main>
    </div>
  );
}
