"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { brokerRegistrationService } from "@/services/broker-registration.service";
import { ArrowLeft, Check, ExternalLink, Loader2 } from "lucide-react";

type Step = "select" | "register" | "confirm";

const EXNESS_REFERRAL = "https://one.exnessonelink.com/a/c717fhr01j/?campaign=42313";

const VALETAX_EMBED = `<iframe src="https://ma.valetax.com/embed/register/block/%2FVnB%2BKHlS7fIPaqJdAVra770S6pPsLrWAulIB5XEzSxd7mrTkwAxNaF6l8n94tfVMK3cyIQFJvPY6Pi2Or%2BlTcwXADDWr2%2FU1%2FuaT0kelI6KExChGGcFvILbWhbleMpN?lang=en&background=dark" width="100%" height="490px" title="Valetax Registration"></iframe>`;

export default function BrokerRegistrationPage() {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = useSession();

  const [step, setStep] = useState<Step>("select");
  const [selectedBroker, setSelectedBroker] = useState<"exness" | "valetax" | null>(null);
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!sessionPending && !session) router.push("/");
  }, [session, sessionPending, router]);

  const handleSelect = (broker: "exness" | "valetax") => {
    setSelectedBroker(broker);
    setStep("register");
  };

  const handleConfirm = async () => {
    if (!selectedBroker || !email.trim()) return;

    try {
      setIsSubmitting(true);
      setError(null);

      const result = await brokerRegistrationService.save({
        referralBroker: selectedBroker,
        referralEmail: email.trim(),
      });

      if (result.success) {
        setStep("confirm");
      } else {
        setError(result.error || "Gagal menyimpan");
      }
    } catch (err: any) {
      setError(err.message || "System error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(EXNESS_REFERRAL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  if (sessionPending) return null;

  return (
    <div className="min-h-screen bg-[#050508] text-[#e5e1e7] font-sans flex flex-col items-center justify-center p-6 relative overflow-hidden selection:bg-[#d4af37]/30 selection:text-[#f2ca50]">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#d4af37]/5 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#d4af37]/5 rounded-full blur-[120px]"></div>
      </div>

      <main className="w-full max-w-[640px] flex flex-col gap-8">
        {/* Back */}
        <button
          onClick={() => (step === "select" ? router.push("/dashboard") : setStep("select"))}
          className="flex items-center gap-2 text-[#d0c5af]/60 hover:text-[#d4af37] transition text-xs uppercase tracking-widest self-start"
        >
          <ArrowLeft className="w-4 h-4" />{" "}
          {step === "select" ? "Kembali" : "Ganti Broker"}
        </button>

        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-[#d4af37] text-xl font-bold tracking-[0.2em] uppercase">
            Registrasi Broker
          </h1>
          <p className="text-[#d0c5af]/60 text-xs tracking-wider">
            Daftar akun broker baru untuk digunakan dengan AI Trading
          </p>
        </div>

        {/* Step: Select Broker */}
        {step === "select" && (
          <section className="bg-[#0A0A12]/70 backdrop-blur-xl border border-white/5 rounded-2xl p-8 space-y-6">
            <p className="text-sm text-[#d0c5af]/70">
              Pilih salah satu broker di bawah untuk mendaftar akun baru.
              Akun ini akan digunakan khusus untuk AI Trading.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => handleSelect("exness")}
                className="group bg-[#1b1b1f] border border-white/5 rounded-xl p-6 text-left hover:border-[#d4af37]/50 hover:bg-[#d4af37]/5 transition-all space-y-3"
              >
                <div className="w-10 h-10 rounded-lg bg-[#d4af37]/10 flex items-center justify-center text-[#d4af37] font-mono text-sm font-bold">
                  EX
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Exness</h3>
                  <p className="text-[10px] text-[#d0c5af]/50 mt-1">
                    Forex, indeks, komoditas, kripto
                  </p>
                </div>
              </button>

              <button
                onClick={() => handleSelect("valetax")}
                className="group bg-[#1b1b1f] border border-white/5 rounded-xl p-6 text-left hover:border-[#d4af37]/50 hover:bg-[#d4af37]/5 transition-all space-y-3"
              >
                <div className="w-10 h-10 rounded-lg bg-[#d4af37]/10 flex items-center justify-center text-[#d4af37] font-mono text-sm font-bold">
                  VT
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Valetax</h3>
                  <p className="text-[10px] text-[#d0c5af]/50 mt-1">
                    Forex, kripto, emas, saham
                  </p>
                </div>
              </button>
            </div>
          </section>
        )}

        {/* Step: Register + Email Form */}
        {step === "register" && selectedBroker && (
          <section className="bg-[#0A0A12]/70 backdrop-blur-xl border border-white/5 rounded-2xl p-8 space-y-6">
            {selectedBroker === "exness" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">Daftar Exness</h3>
                  <p className="text-[10px] text-[#d0c5af]/50">
                    Klik tombol di bawah untuk membuka halaman pendaftaran Exness
                  </p>
                </div>

                <a
                  href={EXNESS_REFERRAL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between w-full bg-[#d4af37] text-[#050508] px-5 py-3 rounded-xl text-xs font-bold tracking-widest uppercase hover:brightness-110 transition-all"
                >
                  Buka Halaman Pendaftaran
                  <ExternalLink className="w-4 h-4" />
                </a>

                <button
                  onClick={copyLink}
                  className="w-full text-center text-[10px] text-[#d0c5af]/40 hover:text-[#d4af37] transition"
                >
                  {copied ? "Link tersalin" : "Atau salin link"}
                </button>

                <div className="border-t border-white/5 pt-6">
                  <p className="text-[10px] text-[#d0c5af]/50 mb-3">
                    Setelah selesai daftar, masukkan email yang digunakan:
                  </p>
                  <input
                    type="email"
                    required
                    placeholder="email@contoh.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#1b1b1f] border border-white/5 focus:border-[#f2ca50]/50 focus:ring-0 rounded-xl px-4 py-3 text-sm transition-all placeholder:text-white/10"
                  />
                </div>
              </div>
            )}

            {selectedBroker === "valetax" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">Daftar Valetax</h3>
                  <p className="text-[10px] text-[#d0c5af]/50">
                    Gunakan form di bawah untuk mendaftar akun Valetax
                  </p>
                </div>

                <div className="bg-[#1b1b1f] rounded-xl overflow-hidden border border-white/5">
                  <div
                    dangerouslySetInnerHTML={{ __html: VALETAX_EMBED }}
                    className="[&_iframe]:w-full"
                  />
                </div>

                <div className="border-t border-white/5 pt-6">
                  <p className="text-[10px] text-[#d0c5af]/50 mb-3">
                    Setelah selesai daftar, masukkan email yang digunakan:
                  </p>
                  <input
                    type="email"
                    required
                    placeholder="email@contoh.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#1b1b1f] border border-white/5 focus:border-[#f2ca50]/50 focus:ring-0 rounded-xl px-4 py-3 text-sm transition-all placeholder:text-white/10"
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs">
                {error}
              </div>
            )}

            <button
              onClick={handleConfirm}
              disabled={!email.trim() || isSubmitting}
              className="w-full py-3 bg-[#d4af37] text-[#050508] text-xs font-bold tracking-widest rounded-xl hover:brightness-110 transition-all disabled:opacity-40 uppercase"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...
                </span>
              ) : (
                "Konfirmasi & Selesai"
              )}
            </button>
          </section>
        )}

        {/* Step: Confirmation */}
        {step === "confirm" && (
          <section className="bg-[#0A0A12]/70 backdrop-blur-xl border border-white/5 rounded-2xl p-8 space-y-6 text-center">
            <div className="w-16 h-16 bg-[#d4af37]/10 rounded-2xl flex items-center justify-center mx-auto">
              <Check className="w-8 h-8 text-[#d4af37]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white mb-2">Registrasi Tersimpan</h2>
              <p className="text-sm text-[#d0c5af]/70">
                Data registrasi broker berhasil disimpan.
                Kamu sekarang bisa menggunakan AI Trading.
              </p>
            </div>
            <button
              onClick={() => router.push("/ai-trading")}
              className="px-10 py-3 bg-[#d4af37] text-[#050508] text-xs font-bold tracking-widest rounded-xl hover:brightness-110 transition-all uppercase"
            >
              Lanjut ke AI Trading
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
