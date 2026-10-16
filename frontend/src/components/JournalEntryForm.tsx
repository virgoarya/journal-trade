"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle } from "lucide-react";
import { clsx } from "clsx";

export interface TradeFormData {
  symbol: string;
  side: "buy" | "sell";
  entryPrice: number;
  slPrice: number;
  tpPrice: number;
  riskPercent: number;
  lotSize: number;
  timeframe: string;
  notes: string;
}

export interface JournalEntryFormProps {
  onSubmit: (trade: TradeFormData) => Promise<void> | void;
  initialData?: Partial<TradeFormData>;
  submitText?: string;
  loading?: boolean;
  className?: string;
}

const SYMBOLS = ["EUR/USD", "GBP/USD", "AUD/USD", "USD/JPY", "XAU/USD", "US30", "NAS100", "BTC/USD"];
const TIMEFRAMES = ["M1", "M5", "M15", "H1", "H4", "D1"];

const defaults: TradeFormData = {
  symbol: "XAU/USD",
  side: "buy",
  entryPrice: 0,
  slPrice: 0,
  tpPrice: 0,
  riskPercent: 1,
  lotSize: 0.1,
  timeframe: "H1",
  notes: "",
};

export function JournalEntryForm({
  onSubmit,
  initialData,
  submitText = "Log Trade",
  loading = false,
  className,
}: JournalEntryFormProps) {
  const [step, setStep] = useState<"basic" | "details">("basic");
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof TradeFormData, string>>>({});
  const [form, setForm] = useState<TradeFormData>({ ...defaults, ...initialData });
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const set = <K extends keyof TradeFormData>(key: K, val: TradeFormData[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const validate = (): boolean => {
    const e: typeof errors = {};
    if (!form.symbol) e.symbol = "Required";
    if (!form.entryPrice || form.entryPrice <= 0) e.entryPrice = "Must be > 0";
    if (!form.slPrice || form.slPrice <= 0) e.slPrice = "Must be > 0";
    if (!form.tpPrice || form.tpPrice <= 0) e.tpPrice = "Must be > 0";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await onSubmit(form);
      setDone(true);
      router.push("/dashboard");
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className={clsx("glass p-8 rounded-2xl max-w-lg mx-auto text-center border border-accent-gold/20", className)}>
        <div className="w-16 h-16 rounded-full bg-accent-gold/10 border border-accent-gold/30 mx-auto mb-4 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-accent-gold" />
        </div>
        <h3 className="font-mono font-bold text-sm tracking-widest text-accent-gold mb-1">TRADE_LOGGED // SUCCESS</h3>
        <p className="text-[11px] text-text-muted font-mono">Entry tersimpan. Menunggu verifikasi sistem.</p>
        <button
          type="button"
          onClick={() => { setDone(false); setStep("basic"); setForm({ ...defaults, ...initialData }); }}
          className="mt-6 bg-accent-gold text-bg-void font-mono font-bold text-[11px] uppercase tracking-widest px-6 py-2.5 rounded-lg hover:brightness-110 active:scale-95 transition-all"
        >
          Log Trade Baru
        </button>
      </div>
    );
  }

  return (
    <div className={clsx("glass p-5 sm:p-6 rounded-2xl max-w-xl mx-auto border border-white/5 relative overflow-hidden", className)}>
      {/* Header */}
      <div className="flex justify-between items-center mb-5 pb-4 border-b border-white/10">
        <div>
          <h3 className="font-mono font-bold text-xs tracking-[0.2em] text-accent-gold">JOURNAL // NEW_ENTRY</h3>
          <p className="text-[10px] text-text-muted font-mono mt-0.5">Catat eksekusi trade dengan parameter lengkap</p>
        </div>
        <div className="flex bg-bg-void/60 p-0.5 rounded-lg border border-white/5 font-mono text-[10px]">
          {(["basic", "details"] as const).map((s, i) => (
            <button
              key={s}
              type="button"
              onClick={() => setStep(s)}
              className={clsx(
                "px-3 py-1 rounded-md transition-all",
                step === s ? "bg-accent-gold text-bg-void font-bold" : "text-text-muted hover:text-text-primary"
              )}
            >
              {i + 1}. {s === "basic" ? "Params" : "Notes"}
            </button>
          ))}
        </div>
      </div>

      {/* Form */}
      <div className="space-y-4">
        {step === "basic" && (
          <>
            {/* Symbol + Side */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] font-mono uppercase tracking-widest text-text-muted">Symbol</label>
                <select
                  value={form.symbol}
                  onChange={(e) => set("symbol", e.target.value)}
                  className="w-full bg-bg-void/50 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-text-primary focus:outline-none focus:border-accent-gold/40 appearance-none cursor-pointer"
                >
                  {SYMBOLS.map((s) => (
                    <option key={s} value={s} className="bg-bg-surface text-text-primary">{s}</option>
                  ))}
                </select>
                {errors.symbol && <p className="text-[10px] text-neon-red font-mono">{errors.symbol}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-mono uppercase tracking-widest text-text-muted">Side</label>
                <div className="grid grid-cols-2 gap-1 bg-bg-void/50 p-0.5 rounded-xl border border-white/10 h-[38px]">
                  {(["buy", "sell"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => set("side", s)}
                      className={clsx(
                        "rounded-lg text-[11px] font-mono font-bold uppercase transition-all",
                        form.side === s
                          ? s === "buy"
                            ? "bg-neon-green/20 text-neon-green border border-neon-green/30"
                            : "bg-neon-red/20 text-neon-red border border-neon-red/30"
                          : "text-text-muted hover:text-text-primary"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Prices */}
            <div className="grid grid-cols-3 gap-3">
              {([
                { key: "entryPrice" as const, label: "Entry Price", color: "text-accent-gold" },
                { key: "slPrice" as const, label: "Stop Loss", color: "text-neon-red" },
                { key: "tpPrice" as const, label: "Take Profit", color: "text-neon-green" },
              ]).map(({ key, label, color }) => (
                <div key={key} className="space-y-1">
                  <label className="text-[9px] font-mono uppercase tracking-widest text-text-muted">{label}</label>
                  <input
                    type="number"
                    step="any"
                    value={form[key] || ""}
                    onChange={(e) => set(key, Number(e.target.value))}
                    placeholder="0.00"
                    className={clsx(
                      "w-full bg-bg-void/50 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none",
                      errors[key] ? "border-neon-red/40" : "focus:border-accent-gold/40",
                      color
                    )}
                  />
                  {errors[key] && <p className="text-[10px] text-neon-red font-mono">{errors[key]}</p>}
                </div>
              ))}
            </div>

            {/* TF + Risk + Lots */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] font-mono uppercase tracking-widest text-text-muted">Timeframe</label>
                <select
                  value={form.timeframe}
                  onChange={(e) => set("timeframe", e.target.value)}
                  className="w-full bg-bg-void/50 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-text-primary focus:outline-none focus:border-accent-gold/40 appearance-none cursor-pointer"
                >
                  {TIMEFRAMES.map((tf) => (
                    <option key={tf} value={tf} className="bg-bg-surface text-text-primary">{tf}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-mono uppercase tracking-widest text-text-muted">Risk %</label>
                <input
                  type="number"
                  step="0.1"
                  value={form.riskPercent}
                  onChange={(e) => set("riskPercent", Number(e.target.value))}
                  className="w-full bg-bg-void/50 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-text-primary focus:outline-none focus:border-accent-gold/40"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-mono uppercase tracking-widest text-text-muted">Lot Size</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.lotSize}
                  onChange={(e) => set("lotSize", Number(e.target.value))}
                  className="w-full bg-bg-void/50 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-text-primary focus:outline-none focus:border-accent-gold/40"
                />
              </div>
            </div>
          </>
        )}

        {step === "details" && (
          <div className="space-y-1">
            <label className="text-[9px] font-mono uppercase tracking-widest text-text-muted">Trade Notes / Strategy</label>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={6}
              placeholder="Deskripsi setup, konfirmasi indikator, atau alasan entry..."
              className="w-full bg-bg-void/50 border border-white/10 rounded-xl p-3 text-xs font-mono text-text-primary focus:outline-none focus:border-accent-gold/40 resize-none"
            />
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between items-center pt-3 border-t border-white/10">
          <button
            type="button"
            onClick={() => setStep(step === "basic" ? "details" : "basic")}
            className="bg-transparent border border-white/10 text-text-primary text-[11px] font-mono px-4 py-2 rounded-lg transition-all hover:border-accent-gold/30 hover:text-accent-gold"
          >
            {step === "basic" ? "Lanjut Notes →" : "← Kembali"}
          </button>
          <button
            type="button"
            disabled={submitting || loading}
            onClick={handleSubmit}
            className="bg-accent-gold text-bg-void font-mono font-bold text-[11px] uppercase tracking-widest px-6 py-2.5 rounded-lg hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
          >
            {submitting || loading ? "Processing..." : submitText}
          </button>
        </div>
      </div>
    </div>
  );
}
