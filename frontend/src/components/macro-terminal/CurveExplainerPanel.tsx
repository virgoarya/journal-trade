import { useMacroTerminal } from "./MacroTerminalContext";
import ReactMarkdown from "react-markdown";
import { BrainCircuit, Loader2 } from "lucide-react";

export function CurveExplainerPanel() {
  const { yieldCurve, dataStatus } = useMacroTerminal();

  return (
    <div className="flex flex-col h-full w-full glass overflow-hidden relative">
      {/* HEADER */}
      <div className="flex-none p-4 border-b border-border-subtle glass sticky top-0 z-10 flex justify-between items-center">
        <div className="flex items-center gap-2 min-w-0">
          <BrainCircuit size={14} className="text-accent-gold flex-shrink-0" />
          <h2 className="font-bold text-text-primary uppercase tracking-wider text-[11px] sm:text-xs whitespace-nowrap">
            AI Yield Curve Analysis
          </h2>
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {dataStatus.quant === "stale" || dataStatus.quant === "error" ? (
          <div className="flex flex-col items-center justify-center h-full space-y-4">
            <Loader2 className="w-8 h-8 text-accent-gold animate-spin" />
            <p className="text-sm font-mono text-text-muted animate-pulse">
              Menghubungkan ke analis AI...
            </p>
          </div>
        ) : yieldCurve.aiExplainer ? (
          <div className="flex flex-col gap-4">
            <div className="inline-flex items-center self-start px-3 py-1.5 glass border border-accent-gold/30 rounded text-[11px] font-mono font-bold tracking-widest uppercase shadow-[0_0_10px_rgba(251,191,36,0.1)]">
              <span className="text-text-muted mr-2">CURRENT REGIME:</span> 
              <span className="text-accent-gold">{yieldCurve.curveRegime}</span>
            </div>
            <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-p:mb-4 prose-li:mb-2 text-text-secondary font-mono text-[13px] whitespace-pre-wrap">
              <ReactMarkdown>{yieldCurve.aiExplainer}</ReactMarkdown>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <p className="text-sm font-mono text-text-muted text-center max-w-sm">
              Analisis AI saat ini tidak tersedia atau masih menunggu pengumpulan data spread kurva yield.
            </p>
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div className="flex-none p-3 border-t border-border-subtle glass">
        <p className="text-[10px] text-text-muted font-mono text-center">
          Analisis ini digenerate secara otomatis oleh spesialis AI saat terjadi perubahan rezim yield curve.
        </p>
      </div>
    </div>
  );
}
