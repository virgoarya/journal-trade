import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { AlertCircle, Clock, Search, ChevronRight, X, Activity, BrainCircuit } from "lucide-react";
import { useMacroTerminal } from "./MacroTerminalContext";

interface NewsItem {
  id: string;
  time: string;
  headline: string;
  source: string;
  analysis?: any;
}

function inferSource(headline: string, targetAsset: string): string {
  const lower = headline.toLowerCase();
  if (lower.includes("fed") || lower.includes("fomc") || lower.includes("powell")) return "[FED]";
  if (lower.includes("ecb") || lower.includes("lagarde")) return "[ECB]";
  if (lower.includes("boj") || lower.includes("ueda")) return "[BOJ]";
  if (lower.includes("cpi") || lower.includes("pce") || lower.includes("gdp") || lower.includes("payroll")) return "[DATA]";
  if (lower.includes("oil") || lower.includes("energy") || lower.includes("opec")) return "[ENERGY]";
  if (lower.includes("gold") || lower.includes("silver")) return "[METAL]";
  if (lower.includes("treasury") || lower.includes("bond")) return "[BONDS]";
  if (lower.includes("geopolitical") || lower.includes("war") || lower.includes("conflict")) return "[GEO]";
  if (targetAsset === "USD") return "[USD]";
  if (targetAsset === "EUR") return "[EUR]";
  if (targetAsset === "JPY") return "[JPY]";
  return "[NEWS]";
}

const mockNews: NewsItem[] = [
  { id: "1", time: "10:05", headline: "Powell speaks on inflation outlook, hints at rate trajectory", source: "[FED]" },
  { id: "2", time: "09:30", headline: "ECB raises interest rates by 25 basis points, citing persistent inflation", source: "[ECB]" },
  { id: "3", time: "08:45", headline: "US CPI data beats expectations, core inflation remains sticky", source: "[DATA]" },
  { id: "4", time: "07:10", headline: "OPEC+ considers deeper oil production cuts amid global demand concerns", source: "[ENERGY]" },
];

function NewsAnalysisModal({
  show,
  item,
  analysis,
  error,
  isAnalyzing,
  onClose,
}: {
  show: boolean;
  item: NewsItem | null;
  analysis: any;
  error: string | null;
  isAnalyzing: boolean;
  onClose: () => void;
}) {
  if (!show || !item) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }} onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[80vh] flex flex-col rounded-xl border glass overflow-hidden" style={{ backgroundColor: "#0a0a0a", borderColor: "rgba(212, 175, 55, 0.4)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: "rgba(212, 175, 55, 0.2)" }}>
              <BrainCircuit className="w-5 h-5 text-accent-gold" />
            </div>
            <div>
              <span className="text-xs font-mono font-bold uppercase tracking-widest text-accent-gold">News Analyzer / AI</span>
              <p className="text-[10px] text-text-muted font-mono mt-0.5 truncate max-w-md">{item.headline}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-white p-2 rounded-lg hover:bg-neutral-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {isAnalyzing ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-10 h-10 border-2 border-neutral-700 border-t-accent-gold rounded-full animate-spin" />
              <span className="text-[11px] text-text-muted font-mono animate-pulse">Hunter AI sedang mengekstrak implikasi pasar dari berita ini...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-data-loss text-sm font-mono">{error}</p>
            </div>
          ) : !analysis ? (
             <div className="text-center py-12">
              <p className="text-text-muted text-sm font-mono">Hasil analisa tidak tersedia.</p>
            </div>
          ) : (
            <div className="font-mono text-[11px] text-text-secondary leading-relaxed whitespace-pre-wrap">
              {typeof analysis === "string" ? (
                <div className="p-4 rounded-lg border border-neutral-800 bg-neutral-900/40">
                  {analysis.replace(/\*\*/g, "")}
                </div>
              ) : (
                <div className="space-y-3">
                  {Object.entries(analysis).map(([key, value]) => {
                      if (key === "reasoning" || key === "topic") return null; // Skip redundant keys if any
                      const labelMap: Record<string, string> = {
                      Fakta: "Fakta",
                      dampakMarket: "Dampak Market",
                      logika: "Logika",
                      contrarian: "Contrarian",
                      triggerFundamentalNonTeknikal: "Trigger Fundamental",
                      confidenceScore: "Confidence Score",
                    };
                    const label = labelMap[key] || key.replace(/([A-Z])/g, ' $1').trim().replace(/^./, (str) => str.toUpperCase());
                    
                    // Specific coloring for Confidence Score if needed
                    let valColor = "text-text-primary";
                    if (key === "confidenceScore") {
                      const strVal = String(value).toUpperCase();
                      if (strVal.includes("TINGGI") || strVal.includes("HIGH")) valColor = "text-data-profit font-bold";
                      else if (strVal.includes("RENDAH") || strVal.includes("LOW")) valColor = "text-data-loss font-bold";
                      else valColor = "text-accent-gold font-bold";
                    }

                    return (
                      <div key={key} className="p-3.5 bg-neutral-900/40 rounded-lg border border-neutral-800/60 hover:border-accent-gold/30 transition-colors">
                        <div className="text-[10px] font-bold text-accent-gold mb-1.5 uppercase tracking-widest">{label}</div>
                        <div className={`${valColor} text-[11.5px] leading-relaxed`}>{String(value)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-neutral-800 shrink-0 flex items-center justify-between">
          <span className="text-[10px] text-text-muted font-mono">Generated by Hunter Desk AI · Not financial advice</span>
          <button onClick={onClose} className="text-[11px] text-text-muted font-mono hover:text-white transition-colors">Tutup [ESC]</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function NewsFeedPanel({ className }: { className?: string }) {
  const { currentRegime, liquidity, dataStatus } = useMacroTerminal();
  const [feed, setFeed] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayCount, setDisplayCount] = useState(10);

  // Analysis State
  const [analysisState, setAnalysisState] = useState<{
    show: boolean;
    item: NewsItem | null;
    isAnalyzing: boolean;
    result: any;
    error: string | null;
  }>({ show: false, item: null, isAnalyzing: false, result: null, error: null });

  const fetchNews = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/v1/market-data/news");
      const data = await res.json();
      if (data.success && Array.isArray(data.data) && data.data.length > 0) {
        const mappedNews = data.data.map((item: any, index: number) => ({
          id: `news-${index}-${item.id || item.headline}`,
          time: new Date((item.datetime as number) * 1000).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).replace(/\./g, ':'),
          headline: item.headline.length > 100 ? item.headline.substring(0, 97) + "..." : item.headline,
          source: inferSource(item.headline, item.targetAsset || ""),
          analysis: item.analysis,
        }));
        setFeed(mappedNews);
      } else {
        setFeed(mockNews);
      }
    } catch (err: unknown) {
      console.error("Error fetching news:", err);
      setError("Failed to load news feed");
      setFeed(mockNews);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
    const interval = setInterval(fetchNews, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleAnalyze = async (item: NewsItem) => {
    if (item.analysis) {
      setAnalysisState({ show: true, item, isAnalyzing: false, result: item.analysis, error: null });
      return;
    }
    
    setAnalysisState({ show: true, item, isAnalyzing: true, result: null, error: null });
    try {
      const token = localStorage.getItem("token") || "";
      const res = await fetch("/api/v1/macro-ai/analyze-macro-feed", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          headline: item.headline,
          targetAsset: item.source.replace(/[\[\]]/g, ""),
          context: `Regime: ${currentRegime || "Unknown"}, Liquidity: ${liquidity?.status || "UNKNOWN"}`
        }),
      });
      const data = await res.json();
      if (data.success && data.analysis) {
        let content = data.analysis;
        if (typeof data.analysis === 'string') {
          try {
            content = JSON.parse(data.analysis);
          } catch(e) {
            // Biarkan sebagai string jika bukan JSON valid
          }
        }
        
        // Jika ada properti reasoning, kita mungkin ingin menampilkan reasoning saja, tapi karena format baru butuh semua key, kita biarkan object apa adanya.
        
        setFeed((prev) => prev.map((n) => (n.id === item.id ? { ...n, analysis: content } : n)));
        setAnalysisState((prev) => ({ ...prev, isAnalyzing: false, result: content }));
      } else {
        throw new Error(data.error || "Gagal mendapatkan analisa");
      }
    } catch (err: any) {
      setAnalysisState((prev) => ({ ...prev, isAnalyzing: false, error: err.message }));
    }
  };

  return (
    <>
      <NewsAnalysisModal 
        show={analysisState.show}
        item={analysisState.item}
        analysis={analysisState.result}
        error={analysisState.error}
        isAnalyzing={analysisState.isAnalyzing}
        onClose={() => setAnalysisState((prev) => ({ ...prev, show: false }))}
      />
      
      <div className={`flex flex-col w-full glass overflow-hidden relative ${className ?? ""}`}>
        <div className="flex items-center justify-between border-b border-border-subtle p-2 shrink-0">
          <h2 className="font-bold text-text-primary uppercase tracking-wider text-[11px] sm:text-xs flex items-center gap-2 min-w-0">
            <Search size={14} className="text-accent-gold flex-shrink-0" /> Macro Feed
          </h2>
          <div className="flex items-center gap-2">
            {error && <span className="text-[9px] font-mono text-data-loss animate-pulse">FAILED</span>}
            <button
              onClick={fetchNews}
              disabled={loading}
              className="flex items-center gap-1 text-[9px] font-mono text-text-muted hover:text-white transition-colors"
            >
              <Activity size={10} className={loading ? "animate-spin" : ""} />
              {loading ? "REFRESHING..." : "RELOAD"}
            </button>
            {dataStatus.news === "stale" || dataStatus.news === "error" ? (
              <span className="flex items-center gap-1.5 text-[8px] sm:text-[9px] font-mono font-medium text-text-muted bg-white/5 px-2 py-0.5 rounded border border-white/10 uppercase tracking-widest whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-gold/50 animate-pulse"></span>
                Connecting...
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[8px] sm:text-[9px] font-mono font-bold text-data-profit bg-data-profit/10 px-2 py-0.5 rounded border border-data-profit/20 uppercase tracking-widest whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-data-profit animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                LIVE
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-0 min-h-0 custom-scrollbar">
          {loading && feed.length === 0 ? (
            <div className="flex justify-center items-center h-full">
              <span className="text-xs font-mono text-text-muted animate-pulse">Fetching news...</span>
            </div>
          ) : feed.length === 0 ? (
            <div className="flex justify-center items-center h-full text-text-muted text-xs font-mono">No news available.</div>
          ) : (
            <div className="flex flex-col divide-y divide-border-subtle">
              {feed.slice(0, displayCount).map((item) => (
                <div key={item.id} className="p-3 hover:bg-white/5 transition-colors group border-b border-border-subtle last:border-0">
                  <div className="flex items-start justify-between gap-3 min-w-0">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <span className="text-[10px] font-mono text-text-muted whitespace-nowrap flex-shrink-0 mt-0.5">{item.time}</span>
                      <div className="flex flex-col min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-text-primary leading-snug break-words min-w-0">{item.headline}</p>
                        
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          <span className="text-[9.5px] font-mono text-accent-gold bg-accent-gold/10 border border-accent-gold/20 px-1.5 py-0.5 rounded">
                            Topic: {item.analysis?.topic || item.source.replace(/[\[\]]/g, '')}
                          </span>
                          <span className="text-[9.5px] font-mono text-text-muted bg-white/5 border border-white/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                            Assets: <span className={item.analysis?.assets ? "text-text-primary" : "opacity-50"}>{item.analysis?.assets || "Pending AI"}</span>
                          </span>
                          <span className="text-[9.5px] font-mono text-text-muted bg-white/5 border border-white/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                            Regime: <span className={item.analysis?.regime ? "text-text-primary" : "opacity-50"}>{item.analysis?.regime || "Pending AI"}</span>
                          </span>
                          <span className="text-[9.5px] font-mono text-text-muted bg-white/5 border border-white/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                            Score: <span className={item.analysis?.confidenceScore ? "text-text-primary font-bold" : "opacity-50"}>{item.analysis?.confidenceScore || "Pending AI"}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleAnalyze(item); }}
                      className={`p-1.5 mt-0.5 rounded transition-all shrink-0 border flex items-center gap-1.5 ${item.analysis ? "text-white bg-white/10 border-white/20 hover:bg-white/20" : "text-accent-gold hover:bg-accent-gold/20 border-accent-gold/20 bg-accent-gold/5 group-hover:bg-accent-gold/10"}`}
                      title={item.analysis ? "View AI Analysis" : "Analyze with Hunter AI"}
                    >
                      <BrainCircuit size={13} />
                      <span className="text-[10px] font-mono font-bold hidden sm:inline">{item.analysis ? "VIEW" : "ANALYZE"}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {feed.length > displayCount && (
            <div className="flex justify-center p-2 border-t border-border-subtle">
              <button onClick={() => setDisplayCount((prev) => prev + 10)} className="text-[9px] font-mono text-accent-gold hover:underline flex items-center gap-1">
                Load More <ChevronRight size={10} />
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
