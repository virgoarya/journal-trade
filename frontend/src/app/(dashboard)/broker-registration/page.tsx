"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { brokerRegistrationService } from "@/services/broker-registration.service";
import { ArrowLeft, Check, ExternalLink, Loader2 } from "lucide-react";

type Step = "select" | "register" | "confirm";

const EXNESS_REFERRAL = "https://one.exnessonelink.com/boarding/sign-up/a/c717fhr01j/?campaign=42313";

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
    <div className="min-h-screen bg-bg-void text-text-primary font-sans flex flex-col items-center justify-center p-6 relative overflow-hidden selection:bg-accent-gold/30 selection:text-primary">
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent-gold/5 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent-gold/5 rounded-full blur-[120px]"></div>
      </div>

      <main className="w-full max-w-[640px] flex flex-col gap-8">
        <button
          onClick={() => (step === "select" ? router.push("/dashboard") : setStep("select"))}
          className="flex items-center gap-2 text-text-muted hover:text-accent-gold transition text-xs uppercase tracking-widest self-start"
        >
          <ArrowLeft className="w-4 h-4" />{" "}
          {step === "select" ? "Kembali" : "Ganti Broker"}
        </button>

        <div className="text-center space-y-2">
          <h1 className="text-accent-gold text-xl font-bold tracking-[0.2em] uppercase">
            Registrasi Broker
          </h1>
          <p className="text-text-muted text-xs tracking-wider">
            Daftar akun broker baru untuk digunakan dengan AI Trading
          </p>
        </div>

        {step === "select" && (
          <section className="bg-bg-elevated/70 backdrop-blur-xl border border-border-subtle rounded-2xl p-8 space-y-6">
            <p className="text-sm text-text-secondary">
              Pilih salah satu broker di bawah untuk mendaftar akun baru.
              Akun ini akan digunakan khusus untuk AI Trading.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => handleSelect("exness")}
                className="group bg-bg-surface border border-border-subtle rounded-xl p-6 text-left hover:border-accent-gold/50 hover:bg-accent-gold/5 transition-all space-y-3"
              >
                <div className="w-10 h-10 rounded-lg bg-accent-gold/10 flex items-center justify-center text-accent-gold font-mono text-sm font-bold">
                  EX
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-primary">Exness</h3>
                  <p className="text-[10px] text-text-muted mt-1">
                    Forex, indeks, komoditas, kripto
                  </p>
                </div>
              </button>

              <button
                onClick={() => handleSelect("valetax")}
                className="group bg-bg-surface border border-border-subtle rounded-xl p-6 text-left hover:border-accent-gold/50 hover:bg-accent-gold/5 transition-all space-y-3"
              >
                <div className="w-10 h-10 rounded-lg bg-accent-gold/10 flex items-center justify-center text-accent-gold font-mono text-sm font-bold">
                  VT
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-primary">Valetax</h3>
                  <p className="text-[10px] text-text-muted mt-1">
                    Forex, kripto, emas, saham
                  </p>
                </div>
              </button>
            </div>
          </section>
        )}

        {step === "register" && selectedBroker && (
          <section className="bg-bg-elevated/70 backdrop-blur-xl border border-border-subtle rounded-2xl p-8 space-y-6">
            {selectedBroker === "exness" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-text-primary mb-1">Daftar Exness</h3>
                  <p className="text-[10px] text-text-muted">
                    Klik tombol di bawah untuk membuka halaman pendaftaran Exness
                  </p>
                </div>

                <a
                  href={EXNESS_REFERRAL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between w-full bg-accent-gold text-bg-void px-5 py-3 rounded-xl text-xs font-bold tracking-widest uppercase hover:brightness-110 transition-all"
                >
                  Buka Halaman Pendaftaran
                  <ExternalLink className="w-4 h-4" />
                </a>

                <button
                  onClick={copyLink}
                  className="w-full text-center text-[10px] text-text-muted hover:text-accent-gold transition"
                >
                  {copied ? "Link tersalin" : "Atau salin link"}
                </button>

                <div className="border-t border-border-subtle pt-6">
                  <p className="text-[10px] text-text-muted mb-3">
                    Setelah selesai daftar, masukkan email yang digunakan:
                  </p>
                  <input
                    type="email"
                    required
                    placeholder="email@contoh.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-bg-input border border-border-subtle focus:border-accent-gold/50 focus:ring-0 rounded-xl px-4 py-3 text-text-primary text-sm transition-all placeholder:text-text-muted/30"
                  />
                </div>
              </div>
            )}

            {selectedBroker === "valetax" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-text-primary mb-1">Daftar Valetax</h3>
                  <p className="text-[10px] text-text-muted">
                    Gunakan form di bawah untuk mendaftar akun Valetax
                  </p>
                </div>

                <div className="bg-bg-surface rounded-xl overflow-hidden border border-border-subtle">
                  <div
                    dangerouslySetInnerHTML={{ __html: VALETAX_EMBED }}
                    className="[&_iframe]:w-full"
                  />
                </div>

                <div className="border-t border-border-subtle pt-6">
                  <p className="text-[10px] text-text-muted mb-3">
                    Setelah selesai daftar, masukkan email yang digunakan:
                  </p>
                  <input
                    type="email"
                    required
                    placeholder="email@contoh.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-bg-input border border-border-subtle focus:border-accent-gold/50 focus:ring-0 rounded-xl px-4 py-3 text-text-primary text-sm transition-all placeholder:text-text-muted/30"
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 bg-data-loss/10 border border-data-loss/20 rounded-xl text-data-loss text-xs">
                {error}
              </div>
            )}

            <button
              onClick={handleConfirm}
              disabled={!email.trim() || isSubmitting}
              className="w-full py-3 bg-accent-gold text-bg-void text-xs font-bold tracking-widest rounded-xl hover:brightness-110 transition-all disabled:opacity-40 uppercase"
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

        {step === "confirm" && (
          <section className="bg-bg-elevated/70 backdrop-blur-xl border border-border-subtle rounded-2xl p-8 space-y-6 text-center">
            <div className="w-16 h-16 bg-accent-gold/10 rounded-2xl flex items-center justify-center mx-auto">
              <Check className="w-8 h-8 text-accent-gold" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-primary mb-2">Registrasi Tersimpan</h2>
              <p className="text-sm text-text-secondary">
                Data registrasi broker berhasil disimpan.
                Kamu sekarang bisa menggunakan AI Trading.
              </p>
            </div>
            <button
              onClick={() => router.push("/ai-trading")}
              className="px-10 py-3 bg-accent-gold text-bg-void text-xs font-bold tracking-widest rounded-xl hover:brightness-110 transition-all uppercase"
            >
              Lanjut ke AI Trading
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
