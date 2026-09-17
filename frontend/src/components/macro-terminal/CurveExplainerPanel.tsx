import { useMacroTerminal } from "./MacroTerminalContext";
import ReactMarkdown from "react-markdown";
import { BrainCircuit, Loader2 } from "lucide-react";

function FormattedYieldCurveAnalysis({ content }: { content: string }) {
  if (!content) return <p className="text-[11px] text-text-muted">Tidak ada konten.</p>;

  return (
    <div className="space-y-3 text-text-secondary font-mono text-[11px] leading-relaxed">
    <ReactMarkdown
      components={{
        h1: ({ children }) => (
          <h3 className="text-accent-gold font-bold text-[12px] uppercase tracking-wider mt-4 mb-2 pb-1 border-b border-border-subtle">
            {children}
          </h3>
        ),
        h2: ({ children }) => (
          <h4 className="text-accent-gold font-bold text-[11px] uppercase tracking-wider mt-3 mb-1.5">
            {children}
          </h4>
        ),
        h3: ({ children }) => (
          <h4 className="text-accent-gold font-bold text-[11px] uppercase tracking-wider mt-3 mb-1.5">
            {children}
          </h4>
        ),
        p: ({ children }) => (
          <p className="text-[11px] text-text-secondary leading-relaxed mb-2">
            {children}
          </p>
        ),
        strong: ({ children }) => (
          <strong className="text-accent-gold font-bold">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="text-text-primary italic">{children}</em>
        ),
        ul: ({ children }) => (
          <ul className="list-disc list-inside space-y-1 mb-2 ml-1">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside space-y-1 mb-2 ml-1">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="text-[11px] text-text-secondary">{children}</li>
        ),
        code: ({ children, className }) => {
          const isInline = !className;
          return isInline ? (
            <code className="px-1.5 py-0.5 rounded bg-surface-elevated text-accent-gold text-[10px] font-bold">
              {children}
            </code>
          ) : (
            <code className={`${className} text-[10px]`}>{children}</code>
          );
        },
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-accent-gold/40 pl-3 py-1 my-2 bg-accent-gold/5 rounded-r text-text-muted italic">
            {children}
          </blockquote>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
    </div>
  );
}

export function CurveExplainerPanel() {
  const { yieldCurve, dataStatus } = useMacroTerminal();

  return (
    <div className="flex flex-col h-full w-full rounded-xl border border-accent-gold/30 bg-card shadow-xl overflow-hidden relative">
      {/* HEADER */}
      <div className="flex-none p-4 border-b border-border-subtle bg-card sticky top-0 z-10 flex justify-between items-center select-none">
        <div className="flex items-center gap-2 min-w-0">
          <BrainCircuit size={14} className="text-accent-gold flex-shrink-0" />
          <h2 className="font-bold text-text-primary uppercase tracking-wider text-[11px] sm:text-xs whitespace-nowrap leading-none">
            AI Yield Curve Analysis
          </h2>
        </div>
        {yieldCurve.curveRegime && (
          <span className="text-[9px] font-mono font-bold text-accent-gold px-2 py-0.5 rounded border border-accent-gold/30 bg-accent-gold/10 uppercase tracking-widest">
            {yieldCurve.curveRegime}
          </span>
        )}
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar scrollbar-gutter-stable">
        {dataStatus.quant === "stale" || dataStatus.quant === "error" ? (
          <div className="flex flex-col items-center justify-center h-full space-y-4">
            <Loader2 className="w-8 h-8 text-accent-gold animate-spin" />
            <p className="text-sm font-mono text-text-muted animate-pulse">
              Menghubungkan ke analis AI...
            </p>
          </div>
        ) : yieldCurve.aiExplainer ? (
          <FormattedYieldCurveAnalysis content={yieldCurve.aiExplainer} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <p className="text-sm font-mono text-text-muted text-center max-w-sm">
              Analisis AI saat ini tidak tersedia atau masih menunggu pengumpulan data spread kurva yield.
            </p>
          </div>
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
