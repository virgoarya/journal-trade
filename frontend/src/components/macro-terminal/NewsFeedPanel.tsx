"use client";

import React, { useState, useEffect } from "react";
import { AlertCircle, ArrowDownRight, ArrowUpRight, Clock, ShieldAlert, Brain, X, Zap, TrendingUp, Activity, ShieldCheck } from "lucide-react";

interface NewsItem {
  id: string;
  time: string;
  headline: string;
  impact: "BULLISH" | "BEARISH" | "NEUTRAL";
  targetAsset: string;
  aiSummary: string;
}

interface ParsedAnalysis {
  fakta: string;
  dampak: string;
  logika: string;
  contrarian: string;
  confidence: string;
  risk: string;
}

const mockNews: NewsItem[] = [
  {
    id: "1",
    time: "10:24",
    headline: "US Core PCE Price Index MoM Exceeds Expectations at 0.4%",
    impact: "BULLISH",
    targetAsset: "USD",
    aiSummary: "Inflasi inti yang membandel memaksa The Fed menahan suku bunga lebih lama (Hawkish). USD menarik likuiditas.",
  },
  {
    id: "2",
    time: "10:15",
    headline: "ECB President Lagarde Signals Summer Rate Cuts",
    impact: "BEARISH",
    targetAsset: "EUR",
    aiSummary: "Dovish divergence. ECB memotong suku bunga mendahului Fed, melebarkan yield gap EU-US. Tekanan jual EUR/USD membesar.",
  },
  {
    id: "3",
    time: "09:45",
    headline: "Middle East Tensions Escalate: Supply Route Blocked",
    impact: "BULLISH",
    targetAsset: "GOLD",
    aiSummary: "Lonjakan premi risiko geopolitik (Fear Trade). Emas bertindak sebagai ultimate safe haven meski USD menguat.",
  },
  {
    id: "4",
    time: "09:30",
    headline: "US 10Y Treasury Yield Breaks Above 4.5%",
    impact: "BEARISH",
    targetAsset: "NASDAQ",
    aiSummary: "Naiknya yield bebas risiko menghancurkan valuasi aset growth dan saham teknologi (Bear Flattener impact).",
  },
  {
    id: "5",
    time: "08:15",
    headline: "Bank of Japan Unexpectedly Intervenes in FX Market",
    impact: "BULLISH",
    targetAsset: "JPY",
    aiSummary: "Alarm likuiditas menyala! Risiko Carry Trade Unwind tinggi. Ekuitas berpotensi mengalami collateral damage.",
  },
];

// Robust JSON extractor: finds first balanced { } block
function extractFirstJSON(raw: string): ParsedAnalysis | null {
  let start = raw.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let end = -1;
  for (let i = start; i < raw.length; i++) {
    if (raw[i] === "{") depth++;
    else if (raw[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  if (end === -1) return null;

  try {
    const obj = JSON.parse(raw.substring(start, end + 1));
    if (obj.fakta && obj.dampak) return obj as ParsedAnalysis;
    return null;
  } catch {
    return null;
  }
}

// Confidence level color helper
function getConfidenceColor(conf: string): string {
  const lower = conf.toLowerCase();
  if (lower.startsWith("tinggi") || lower.startsWith("high")) return "text-data-profit";
  if (lower.startsWith("rendah") || lower.startsWith("low")) return "text-data-loss";
  return "text-accent-gold";
}

function getConfidenceLabel(conf: string): string {
  const lower = conf.toLowerCase();
  if (lower.startsWith("tinggi") || lower.startsWith("high")) return "TINGGI";
  if (lower.startsWith("rendah") || lower.startsWith("low")) return "RENDAH";
  return "SEDANG";
}

function getImpactColor(impact: string) {
  if (impact === "BULLISH") return "text-data-profit border-data-profit bg-data-profit/10";
  if (impact === "BEARISH") return "text-data-loss border-data-loss bg-data-loss/10";
  return "text-text-muted border-border-subtle bg-bg-void";
}

function getImpactIcon(impact: string) {
  if (impact === "BULLISH") return <ArrowUpRight size={14} className="text-data-profit" />;
  if (impact === "BEARISH") return <ArrowDownRight size={14} className="text-data-loss" />;
  return <AlertCircle size={14} className="text-text-muted" />;
}

// ==================== MODAL COMPONENT (rendered via Portal) ====================
function AnalysisModal({
  item,
  parsed,
  rawAnalysis,
  onClose,
}: {
  item: NewsItem;
  parsed: ParsedAnalysis | null;
  rawAnalysis: string;
  onClose: () => void;
}) {
  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.92)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-3xl rounded-2xl overflow-hidden flex flex-col max-h-[85vh]"
        style={{
          backgroundColor: "#0c0c10",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.8), 0 0 60px rgba(180,152,255,0.05)",
        }}
      >
        {/* Header */}
        <div
          className="px-6 py-5 flex justify-between items-start shrink-0"
          style={{
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            background: "linear-gradient(180deg, rgba(180,152,255,0.03) 0%, transparent 100%)",
          }}
        >
          <div className="flex items-center gap-4">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
              style={{
                background: "linear-gradient(135deg, rgba(180,152,255,0.15) 0%, rgba(180,152,255,0.05) 100%)",
                border: "1px solid rgba(180,152,255,0.2)",
              }}
            >
              <Zap className="w-5 h-5" style={{ color: "#b498ff" }} />
            </div>
            <div>
              <h3 className="font-bold text-lg tracking-wide" style={{ color: "#fff" }}>
                Macro Feed Intelligence
              </h3>
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold mt-0.5" style={{ color: "#b498ff" }}>
                HUNTER TRADES AI ANALYSIS
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ color: "rgba(255,255,255,0.3)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.3)")}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5" style={{ scrollbarWidth: "thin" }}>
          {/* Source Headline */}
          <div className="mb-6 pb-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <p className="text-sm font-medium italic leading-relaxed" style={{ color: "rgba(255,255,255,0.9)" }}>
              &ldquo;{item.headline}&rdquo;
            </p>
            <div className="flex items-center gap-2 mt-3">
              <span className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold border ${getImpactColor(item.impact)}`}>
                {getImpactIcon(item.impact)}
                {item.impact} {item.targetAsset}
              </span>
            </div>
          </div>

          {parsed ? (
            <div className="flex flex-col gap-5">
              {/* Fakta + Confidence */}
              <div className="flex flex-col sm:flex-row gap-4 items-stretch">
                <div className="flex-1">
                  <h4 className="text-[10px] font-bold uppercase tracking-[0.15em] mb-2.5" style={{ color: "#b498ff" }}>
                    EXECUTIVE SUMMARY
                  </h4>
                  <div
                    className="p-4 rounded-xl"
                    style={{
                      background: "linear-gradient(135deg, rgba(180,152,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
                      borderLeft: "3px solid #b498ff",
                    }}
                  >
                    <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.85)" }}>
                      {parsed.fakta}
                    </p>
                  </div>
                </div>
                <div
                  className="flex flex-col items-center justify-center p-4 rounded-xl shrink-0 sm:min-w-[130px]"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <span className="text-[9px] uppercase tracking-[0.15em] font-bold mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>
                    CONFIDENCE
                  </span>
                  <span className={`text-2xl font-black ${getConfidenceColor(parsed.confidence)}`}>
                    {getConfidenceLabel(parsed.confidence)}
                  </span>
                </div>
              </div>

              {/* Dampak & Logika | Contrarian */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  className="p-4 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}
                >
                  <h4 className="text-[10px] font-bold uppercase tracking-[0.15em] mb-3 flex items-center gap-2 text-data-profit">
                    <TrendingUp size={13} /> MARKET IMPACT
                  </h4>
                  <div className="space-y-3">
                    <div className="flex gap-2.5 items-start text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
                      <span className="text-data-profit mt-0.5 shrink-0">✦</span>
                      <span className="leading-relaxed">
                        <strong style={{ color: "rgba(255,255,255,0.9)" }}>Dampak: </strong>
                        {parsed.dampak}
                      </span>
                    </div>
                    <div className="flex gap-2.5 items-start text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
                      <span className="text-data-profit mt-0.5 shrink-0">✦</span>
                      <span className="leading-relaxed">
                        <strong style={{ color: "rgba(255,255,255,0.9)" }}>Logika: </strong>
                        {parsed.logika}
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  className="p-4 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}
                >
                  <h4 className="text-[10px] font-bold uppercase tracking-[0.15em] mb-3 flex items-center gap-2 text-data-loss">
                    <Activity size={13} /> CONTRARIAN VIEW
                  </h4>
                  <div className="flex gap-2.5 items-start text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
                    <span className="text-data-loss mt-0.5 shrink-0">⚡</span>
                    <span className="leading-relaxed">{parsed.contrarian}</span>
                  </div>
                </div>
              </div>

              {/* Risk Alert */}
              {parsed.risk && (
                <div
                  className="p-4 rounded-xl flex items-start gap-4"
                  style={{
                    background: "rgba(239,68,68,0.04)",
                    border: "1px solid rgba(239,68,68,0.15)",
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: "rgba(239,68,68,0.1)" }}
                  >
                    <ShieldCheck size={18} className="text-data-loss" />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-bold text-data-loss uppercase tracking-[0.15em] mb-1">RISK ALERT</h4>
                    <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>
                      {parsed.risk}
                    </p>
                  </div>
                </div>
              )}

              {/* Full Confidence Detail */}
              {parsed.confidence && parsed.confidence.length > 15 && (
                <div
                  className="p-4 rounded-xl"
                  style={{ background: "rgba(180,152,255,0.03)", border: "1px solid rgba(180,152,255,0.1)" }}
                >
                  <h4 className="text-[10px] font-bold uppercase tracking-[0.15em] mb-1.5" style={{ color: "#b498ff" }}>
                    PROFESSIONAL ASSESSMENT
                  </h4>
                  <p className="text-sm italic leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
                    &ldquo;{parsed.confidence}&rdquo;
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Fallback: show raw text in clean card */
            <div
              className="p-4 rounded-xl"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "rgba(255,255,255,0.7)" }}>
                {rawAnalysis}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 flex justify-end shrink-0"
          style={{
            borderTop: "1px solid rgba(255,255,255,0.05)",
            background: "rgba(0,0,0,0.3)",
          }}
        >
          <button
            onClick={onClose}
            className="px-6 py-2.5 font-bold text-xs uppercase tracking-widest rounded-full transition-all"
            style={{
              background: "#b498ff",
              color: "#0c0c10",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = "0 0 20px rgba(180,152,255,0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            Close Analysis
          </button>
        </div>
      </div>
    </div>
  );

  // Render via Portal to document.body — completely bypasses all parent stacking contexts
  return ReactDOM.createPortal(modal, document.body);
}

// ==================== MAIN COMPONENT ====================
export function NewsFeedPanel() {
  const [feed, setFeed] = useState<NewsItem[]>([]);
  const [isFallback, setIsFallback] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Record<string, string>>({});
  const [modalData, setModalData] = useState<{ item: NewsItem; rawAnalysis: string } | null>(null);

  const analyzeFeedItem = async (item: NewsItem) => {
    // Jika sudah ada cache, langsung buka modal tanpa generate baru
    if (analysis[item.id]) {
      setModalData({ item, rawAnalysis: analysis[item.id] });
      return;
    }

    setAnalyzingId(item.id);
    try {
      const res = await fetch("/api/v1/macro-ai/analyze-macro-feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headline: item.headline,
          targetAsset: item.targetAsset,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAnalysis((prev) => ({ ...prev, [item.id]: data.analysis }));
        setModalData({ item, rawAnalysis: data.analysis });
      }
    } catch (error) {
      console.error("Analyze error:", error);
    } finally {
      setAnalyzingId(null);
    }
  };

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const res = await fetch("/api/v1/market-data/news");
        const data = await res.json();
        
        if (data.success && data.data && data.data.length > 0) {
          const mappedNews = data.data.slice(0, 10).map((item: any, index: number) => {
            const date = new Date(item.datetime * 1000);
            
            let impact: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";
            let asset = "MKT";
            const headline = item.headline.toLowerCase();
            
            if (headline.includes("fed") || headline.includes("rate") || headline.includes("inflation")) {
              impact = headline.includes("cut") ? "BEARISH" : "BULLISH";
              asset = "USD";
            } else if (headline.includes("gold") || headline.includes("safe haven")) {
              impact = "BULLISH";
              asset = "GOLD";
            } else if (headline.includes("crash") || headline.includes("drop") || headline.includes("fall")) {
              impact = "BEARISH";
              asset = "EQUITY";
            } else if (headline.includes("jump") || headline.includes("rise") || headline.includes("gain")) {
              impact = "BULLISH";
              asset = "EQUITY";
            }

            return {
              id: String(item.id || index),
              time: `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`,
              headline: item.headline,
              impact,
              targetAsset: asset,
              aiSummary: item.summary ? item.summary.substring(0, 100) + "..." : "Simulated AI macro parsing complete.",
            };
          });
          
          setFeed(mappedNews);
          setIsFallback(false);
        } else {
          throw new Error("Invalid API response");
        }
      } catch (error) {
        console.warn("API Error, falling back to mock news");
        setIsFallback(true);
        let i = 0;
        setFeed([]);
        const interval = setInterval(() => {
          if (i < mockNews.length) {
            setFeed((prev) => [mockNews[i], ...prev]);
            i++;
          } else {
            clearInterval(interval);
          }
        }, 1500);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, []);

  // Parse JSON only when modal is open
  const parsedAnalysis = modalData ? extractFirstJSON(modalData.rawAnalysis) : null;

  return (
    <>
      <div className="flex flex-col h-full glass border border-border-subtle rounded-xl overflow-hidden relative">
        <div className="bg-bg-surface/80 border-b border-border-subtle p-3 flex justify-between items-center z-10 shadow-sm">
          <h2 className="text-xs font-mono font-bold text-accent-gold uppercase tracking-widest flex items-center gap-2">
            <AlertCircle size={14} />
            Macro Feed
          </h2>
          {isFallback ? (
            <span className="flex items-center gap-1 text-[10px] text-data-warning font-mono bg-data-warning/10 px-2 py-0.5 rounded border border-data-warning/30">
              <ShieldAlert size={10} /> MOCK FALLBACK
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] text-data-profit font-mono">
              <Clock size={10} /> LIVE API
            </span>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto p-0 scrollbar-thin scrollbar-thumb-accent-gold/20">
          {loading || feed.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <span className="text-xs text-text-muted font-mono animate-pulse">
                {loading ? "Fetching data from Bloomberg proxy..." : "Awaiting data stream..."}
              </span>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border-subtle">
              {feed.map((item) => (
                <div key={item.id} className="p-3 hover:bg-bg-surface/50 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] font-mono text-text-muted mt-0.5 whitespace-nowrap">
                        [{item.time}]
                      </span>
                      <p className="text-sm font-semibold text-text-primary leading-snug">
                        {item.headline}
                      </p>
                    </div>
                    <button
                      onClick={() => analyzeFeedItem(item)}
                      disabled={analyzingId === item.id}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono text-accent-gold border border-accent-gold/30 rounded hover:bg-accent-gold/10 transition-colors disabled:opacity-50 shrink-0"
                    >
                      <Brain size={12} />
                      {analyzingId === item.id ? "ANALYZING..." : analysis[item.id] ? "VIEW" : "ANALYZER"}
                    </button>
                  </div>
                  
                  <div className="pl-10">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${getImpactColor(item.impact)}`}>
                        {getImpactIcon(item.impact)}
                        {item.impact} {item.targetAsset}
                      </div>
                    </div>
                    <div className="relative pl-3 border-l-2 border-accent-gold/30">
                      <p className="text-xs text-text-secondary font-mono leading-relaxed">
                        {item.aiSummary}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal rendered via Portal — completely outside any parent stacking context */}
      {modalData && (
        <AnalysisModal
          item={modalData.item}
          parsed={parsedAnalysis}
          rawAnalysis={modalData.rawAnalysis}
          onClose={() => setModalData(null)}
        />
      )}
    </>
  );
}
