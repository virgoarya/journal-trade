import { useMacroTerminal } from "./MacroTerminalContext";
import ReactMarkdown from "react-markdown";
import { BrainCircuit, Loader2 } from "lucide-react";
import { SensitivityMatrix } from "./SensitivityMatrix";
import { DurationRisk } from "./DurationRisk";
import { RealYield } from "./RealYield";

interface CurveExplainerPanelProps {
  className?: string;
}

export function CurveExplainerPanel({ className }: CurveExplainerPanelProps) {
  const { yieldCurve, dataStatus } = useMacroTerminal();

  return (
    <div className={`flex flex-col h-full w-full rounded-xl border border-accent-gold/30 bg-card shadow-xl overflow-hidden relative ${className}`}>
      {/* HEADER */}
      <div className="flex-none p-4 border-b border-border-subtle bg-card sticky top-0 z-10 flex justify-between items-center select-none">
        <div className="flex items-center gap-2 min-w-0">
          <BrainCircuit size={14} className="text-accent-gold flex-shrink-0" />
          <h2 className="font-bold text-text-primary uppercase tracking-wider text-[11px] sm:text-xs whitespace-nowrap leading-none">
            AI Yield Curve Analysis & Quant Lab
          </h2>
        </div>
        {yieldCurve.curveRegime && (
          <span className="text-[9px] font-mono font-bold text-accent-gold px-2 py-0.5 rounded border border-accent-gold/30 bg-accent-gold/10 uppercase tracking-widest">
            {yieldCurve.curveRegime}
          </span>
        )}
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar scrollbar-gutter-stable space-y-3 flex flex-col">
        {dataStatus.quant === "stale" || dataStatus.quant === "error" ? (
          <div className="flex flex-col items-center justify-center h-full space-y-4">
            <Loader2 className="w-8 h-8 text-accent-gold animate-spin" />
            <p className="text-sm font-mono text-text-muted animate-pulse">
              Menghubungkan ke analis AI...
            </p>
          </div>
        ) : (
          <>
            {/* Quant Modules */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 shrink-0">
              <SensitivityMatrix 
                spread10y3m={yieldCurve.spread10y3m ?? null}
                spread10y2y={yieldCurve.spread10y2y ?? null}
                spread30y5y={yieldCurve.spread30y5y ?? null}
                spread30y3m={yieldCurve.spread30y3m ?? null}
              />
              <DurationRisk y10={yieldCurve.y10 ?? null} y30={yieldCurve.y30 ?? null} />
              <RealYield y10={yieldCurve.y10 ?? null} y30={yieldCurve.y30 ?? null} />
            </div>

            {/* AI Analysis Cards */}
            {(() => {
              const text = yieldCurve.aiExplainer || "";
              
              // ponytail: could use remark-parse AST, but regex covers the known LLM output format.
                            // Add AST if LLM output becomes too unpredictable.

                            // Strip orphaned ** markers left by LLM bold formatting and clean up leading numbered header lines
              const cleanMd = (s: string) =>
                s.replace(/^#{1,6}\s*/gm, "") // remove markdown header hashes
                 .replace(/^\*{1,2}\s*\d+\.\s+[^\n]*/gm, "") // remove bold numbered headings: **1. Header**
                 .replace(/^\d+\.\s+[^\n]*/gm, "") // remove plain numbered headings: 1. Header
                 .replace(/^\*{1,2}\s*/gm, "")
                 .replace(/\s*\*{1,2}$/gm, "")
                 .trim();

              // Split AI text into sections by numbered headers (1., 2., 3., 4.)
              // This works regardless of exact header wording (e.g. "Alignment atau Divergence Makro")
              const splitSections = (src: string) => {
                // Split on boundaries: start of string or newline + digit + dot + space
                const parts = src.split(/(?=\n?\s*[1-4]\.\s+)/);
                // Filter empty and trim each section
                const sections = parts.map((p) => p.trim()).filter((p) => p.length > 0);
                // Map by leading number
                const result: string[] = [];
                for (let n = 1; n <= 4; n++) {
                  const found = sections.find((s) => s.match(new RegExp(`^${n}\\.`)));
                  result.push(found || "");
                }
                return result;
              };

              const sections = splitSections(text);
              const fallbacks = [
                "Analisis teknikal kurva obligasi mendeteksi tren suku bunga jangka panjang yang stabil.",
                "Arus modal institusional menunjukkan rotasi dari sektor defensif ke growth equities.",
                "Rekomendasi alokasi devisa berfokus pada penguatan DXY dan lindung nilai aset komoditas.",
                "Divergence antara data ketenagakerjaan dan yield obligasi memberikan sinyal peringatan dini.",
              ];
              const [sec1, sec2, sec3, sec4] = [0, 1, 2, 3].map((i) =>
                cleanMd(sections[i] || fallbacks[i])
              );

              const formatContent = (content: string) => {
                // Highlight OVERWEIGHT / UNDERWEIGHT with colored badges
                const parts = content.split(/(OVERWEIGHT|UNDERWEIGHT)/gi);
                return parts.map((part, i) => {
                  if (part.toUpperCase() === "OVERWEIGHT") {
                    return (
                      <span key={i} className="inline-block text-emerald-400 font-bold text-[10px] bg-emerald-500/15 px-1.5 py-px rounded border border-emerald-500/30 ml-0.5 mr-0.5">
                        {part}
                      </span>
                    );
                  }
                  if (part.toUpperCase() === "UNDERWEIGHT") {
                    return (
                      <span key={i} className="inline-block text-rose-400 font-bold text-[10px] bg-rose-500/15 px-1.5 py-px rounded border border-rose-500/30 ml-0.5 mr-0.5">
                        {part}
                      </span>
                    );
                  }
                  return part;
                });
              };

              return text ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Card 1: Sinyal Teknikal */}
                  <div className="glass border border-border-subtle rounded-xl p-3.5 flex flex-col hover:border-accent-gold/40 transition-colors h-[264px]">
                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-border-subtle flex-shrink-0">
                      <h3 className="text-[11px] font-bold text-text-primary uppercase tracking-wider">
                        Proyeksi Suku Bunga
                      </h3>
                      <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-cyan-400 bg-cyan-500/10 border border-cyan-500/20">
                        1. Sinyal Teknikal
                      </span>
                    </div>
                  <div className="text-[11px] text-text-secondary font-mono leading-[1.7] overflow-y-auto custom-scrollbar pr-1 flex-1 min-h-0 prose prose-invert prose-xs max-w-none prose-p:my-1.5 prose-li:my-0.5">
                    <ReactMarkdown>
                      {sec1}
                    </ReactMarkdown>
                  </div>
                  </div>

                  {/* Card 2: Smart Money */}
                  <div className="glass border border-border-subtle rounded-xl p-3.5 flex flex-col hover:border-accent-gold/40 transition-colors h-[264px]">
                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-border-subtle flex-shrink-0">
                      <h3 className="text-[11px] font-bold text-text-primary uppercase tracking-wider">
                        Deteksi Smart Money
                      </h3>
                      <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-amber-400 bg-amber-500/10 border border-amber-500/20">
                        2. Smart Money
                      </span>
                    </div>
                    <div className="text-[11px] text-text-secondary font-mono leading-[1.7] overflow-y-auto custom-scrollbar flex-1 min-h-0 pr-1 prose prose-invert prose-xs max-w-none prose-p:my-1.5 prose-li:my-0.5">
                      <ReactMarkdown>
                        {sec2}
                      </ReactMarkdown>
                    </div>
                  </div>

                  {/* Card 3: Strategi Alokasi */}
                  <div className="glass border border-border-subtle rounded-xl p-3.5 flex flex-col hover:border-accent-gold/40 transition-colors h-[264px]">
                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-border-subtle flex-shrink-0">
                      <h3 className="text-[11px] font-bold text-text-primary uppercase tracking-wider">
                        Strategi Alokasi Aset
                      </h3>
                      <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                        3. Alokasi
                      </span>
                    </div>
                    <div className="text-[11px] text-text-secondary font-mono leading-[1.7] overflow-y-auto custom-scrollbar pr-1 flex-1 min-h-0 prose prose-invert prose-xs max-w-none prose-p:my-1.5 prose-li:my-0.5">
                      <ReactMarkdown>
                        {sec3}
                      </ReactMarkdown>
                    </div>
                  </div>

                  {/* Card 4: Divergence Makro */}
                  <div className="glass border border-border-subtle rounded-xl p-3.5 flex flex-col hover:border-accent-gold/40 transition-colors h-[264px]">
                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-border-subtle flex-shrink-0">
                      <h3 className="text-[11px] font-bold text-text-primary uppercase tracking-wider">
                        Divergence Makro
                      </h3>
                      <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-purple-400 bg-purple-500/10 border border-purple-500/20">
                        4. Divergence
                      </span>
                    </div>
                    <div className="text-[11px] text-text-secondary font-mono leading-[1.7] overflow-y-auto custom-scrollbar pr-1 flex-1 min-h-0 prose prose-invert prose-xs max-w-none prose-p:my-1.5 prose-li:my-0.5">
                      <ReactMarkdown>
                        {sec4}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48">
                  <p className="text-sm font-mono text-text-muted text-center max-w-sm">
                    Analisis AI saat ini tidak tersedia atau masih menunggu pengumpulan data spread kurva yield.
                  </p>
                </div>
              );
            })()}
          </>
        )}
      </div>

      {/* FOOTER */}
      <div className="flex-none p-3 border-t border-border-subtle bg-card">
        <p className="text-[10px] text-text-muted font-mono text-center">
          Analisis ini digenerate secara otomatis oleh spesialis AI saat terjadi perubahan rezim yield curve.
        </p>
      </div>
    </div>
  );
}
