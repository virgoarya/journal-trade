"use client";

import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  ShieldAlert,
  Brain,
  X,
  Zap,
  TrendingUp,
  Activity,
  ShieldCheck,
} from "lucide-react";
import { useMacroTerminal } from "./MacroTerminalContext";

interface NewsItem {
  id: string;
  time: string;
  headline: string;
  impact: "BULLISH" | "BEARISH" | "NEUTRAL";
  targetAsset: string;
  aiSummary: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  alignment: "REGIME-ALIGNED" | "REGIME-CONFLICT" | "UNVERIFIED";
}

interface ParsedAnalysis {
  fakta: string;
  dampakMarket: string;
  logika: string;
  contrarian: string;
  triggerFundamentalNonTeknikal: string;
  confidenceScore: string;
}

// Robust JSON extractor: finds first balanced { } block and normalizes legacy keys
function extractFirstJSON(raw: string): ParsedAnalysis | null {
  const start = raw.indexOf("{");
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
    if (!obj || typeof obj !== "object") return null;

    const normalized: ParsedAnalysis = {
      fakta: typeof obj.fakta === "string" ? obj.fakta : "",
      dampakMarket:
        typeof obj.dampakMarket === "string"
          ? obj.dampakMarket
          : typeof obj.dampak === "string"
            ? obj.dampak
            : "",
      logika: typeof obj.logika === "string" ? obj.logika : "",
      contrarian: typeof obj.contrarian === "string" ? obj.contrarian : "",
      triggerFundamentalNonTeknikal:
        typeof obj.triggerFundamentalNonTeknikal === "string"
          ? obj.triggerFundamentalNonTeknikal
          : "",
      confidenceScore:
        typeof obj.confidenceScore === "string" ? obj.confidenceScore : "",
    };

    if (!normalized.fakta && !normalized.dampakMarket) {
      return null;
    }

    return normalized;
  } catch {
    return null;
  }
}

const mockNews: Array<Omit<NewsItem, "confidence" | "alignment">> = [
  {
    id: "1",
    time: "10:24",
    headline: "US Core PCE Price Index MoM Exceeds Expectations at 0.4%",
    impact: "BULLISH",
    targetAsset: "USD",
    aiSummary:
      "Inflasi inti yang membandel memaksa The Fed menahan suku bunga lebih lama (Hawkish). USD menarik likuiditas.",
  },
  {
    id: "2",
    time: "10:15",
    headline: "ECB President Lagarde Signals Summer Rate Cuts",
    impact: "BEARISH",
    targetAsset: "EUR",
    aiSummary:
      "Dovish divergence. ECB memotong suku bunga mendahului Fed, melebarkan yield gap EU-US. Tekanan jual EUR/USD membesar.",
  },
  {
    id: "3",
    time: "09:45",
    headline: "Middle East Tensions Escalate: Supply Route Blocked",
    impact: "BULLISH",
    targetAsset: "GOLD",
    aiSummary:
      "Lonjakan premi risiko geopolitik (Fear Trade). Emas bertindak sebagai ultimate safe haven meski USD menguat.",
  },
  {
    id: "4",
    time: "09:30",
    headline: "US 10Y Treasury Yield Breaks Above 4.5%",
    impact: "BEARISH",
    targetAsset: "NASDAQ",
    aiSummary:
      "Naiknya yield bebas risiko menghancurkan valuasi aset growth dan saham teknologi (Bear Flattener impact).",
  },
  {
    id: "5",
    time: "08:15",
    headline: "Bank of Japan Unexpectedly Intervenes in FX Market",
    impact: "BULLISH",
    targetAsset: "JPY",
    aiSummary:
      "Alarm likuiditas menyala! Risiko Carry Trade Unwind tinggi. Ekuitas berpotensi mengalami collateral damage.",
  },
];

// Confidence level color helper
function getConfidenceColor(conf: string): string {
  const lower = conf.toLowerCase();
  if (lower.startsWith("tinggi") || lower.startsWith("high"))
    return "text-data-profit";
  if (lower.startsWith("rendah") || lower.startsWith("low"))
    return "text-data-loss";
  return "text-accent-gold";
}

function getConfidenceLabel(conf: string): string {
  const lower = conf.toLowerCase();
  if (lower.startsWith("tinggi") || lower.startsWith("high")) return "TINGGI";
  if (lower.startsWith("rendah") || lower.startsWith("low")) return "RENDAH";
  return "SEDANG";
}

function getAlignmentColor(alignment: string) {
  if (alignment === "REGIME-ALIGNED")
    return "text-data-profit border-data-profit bg-data-profit/10";
  if (alignment === "REGIME-CONFLICT")
    return "text-data-loss border-data-loss bg-data-loss/10";
  return "text-text-muted border-border-subtle bg-surface-elevated/40";
}

function getImpactColor(impact: string) {
  if (impact === "BULLISH")
    return "text-data-profit border-data-profit bg-data-profit/10";
  if (impact === "BEARISH")
    return "text-data-loss border-data-loss bg-data-loss/10";
  return "text-text-muted border-border-subtle bg-bg-void";
}

function getImpactIcon(impact: string) {
  if (impact === "BULLISH")
    return <ArrowUpRight size={14} className="text-data-profit" />;
  if (impact === "BEARISH")
    return <ArrowDownRight size={14} className="text-data-loss" />;
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
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-3xl rounded-2xl overflow-hidden flex flex-col max-h-[85vh]"
        style={{
          backgroundColor: "#0c0c10",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow:
            "0 25px 50px -12px rgba(0,0,0,0.8), 0 0 60px rgba(180,152,255,0.05)",
        }}
      >
        <div
          className="px-6 py-5 flex justify-between items-start shrink-0"
          style={{
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            background:
              "linear-gradient(180deg, rgba(180,152,255,0.03) 0%, transparent 100%)",
          }}
        >
          <div className="flex items-center gap-4">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
              style={{
                background:
                  "linear-gradient(135deg, rgba(180,152,255,0.15) 0%, rgba(180,152,255,0.05) 100%)",
                border: "1px solid rgba(180,152,255,0.2)",
              }}
            >
              <Zap className="w-5 h-5" style={{ color: "#b498ff" }} />
            </div>
            <div>
              <h3
                className="font-bold text-lg tracking-wide"
                style={{ color: "#fff" }}
              >
                Macro Feed Intelligence
              </h3>
              <p
                className="text-[10px] uppercase tracking-[0.2em] font-bold mt-0.5"
                style={{ color: "#b498ff" }}
              >
                HUNTER TRADES AI ANALYSIS
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ color: "rgba(255,255,255,0.3)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "rgba(255,255,255,0.3)")
            }
          >
            <X size={18} />
          </button>
        </div>

        <div
          className="flex-1 overflow-y-auto px-6 py-5"
          style={{ scrollbarWidth: "thin" }}
        >
          <div
            className="mb-6 pb-5"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
          >
            <p
              className="text-sm font-medium italic leading-relaxed"
              style={{ color: "rgba(255,255,255,0.9)" }}
            >
              &ldquo;{item.headline}&rdquo;
            </p>
            <div className="flex items-center gap-2 mt-3">
              <span
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold border ${getImpactColor(item.impact)}`}
              >
                {getImpactIcon(item.impact)}
                {item.impact} {item.targetAsset}
              </span>
              {item.alignment !== "UNVERIFIED" && (
                <span
                  className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold border ${getAlignmentColor(item.alignment)}`}
                >
                  {item.alignment}
                </span>
              )}
              {item.confidence !== "LOW" && (
                <span className="px-2 py-1 rounded text-[10px] font-bold border border-border-subtle text-text-muted bg-surface-elevated/40">
                  CONF {item.confidence}
                </span>
              )}
            </div>
          </div>

          {parsed ? (
            <div className="flex flex-col gap-4">
              <Section title="Fakta" content={parsed.fakta} accent="default" />
              <Section title="Dampak Market" content={parsed.dampakMarket} />
              <Section title="Logika" content={parsed.logika} />
              <Section
                title="Contrarian"
                content={parsed.contrarian}
                accent="contrarian"
              />
              <Section
                title="Trigger Fundamental Non-Teknikal"
                content={parsed.triggerFundamentalNonTeknikal}
              />
              <div
                className="p-4 rounded-xl flex items-center justify-between"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <span
                  className="text-[10px] uppercase tracking-[0.15em] font-bold"
                  style={{ color: "rgba(255,255,255,0.5)" }}
                >
                  Confidence Score
                </span>
                <span
                  className={`text-lg font-black ${getConfidenceColor(parsed.confidenceScore)}`}
                >
                  {getConfidenceLabel(parsed.confidenceScore)}
                </span>
              </div>
            </div>
          ) : (
            <div
              className="p-4 rounded-xl"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <p
                className="text-sm leading-relaxed whitespace-pre-wrap"
                style={{ color: "rgba(255,255,255,0.7)" }}
              >
                {rawAnalysis}
              </p>
            </div>
          )}
        </div>

        <div
          className="px-6 py-4 flex justify-between items-center shrink-0"
          style={{
            borderTop: "1px solid rgba(255,255,255,0.05)",
            background: "rgba(0,0,0,0.3)",
          }}
        >
          <p className="text-[9px] text-text-muted font-mono italic max-w-[60%]">
            Disclaimer: Analisis ini di-generate oleh AI untuk tujuan informasi. Lakukan riset mandiri sebelum mengambil keputusan trading.
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2.5 font-bold text-xs uppercase tracking-widest rounded-full transition-all"
            style={{
              background: "#b498ff",
              color: "#0c0c10",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow =
                "0 0 20px rgba(180,152,255,0.4)";
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

  return ReactDOM.createPortal(modal, document.body);
}

function Section({
  title,
  content,
  accent,
}: {
  title: string;
  content: string;
  accent?: "contrarian" | "default";
}) {
  const isAccent = accent === "contrarian";

  return (
    <div
      className="p-4 rounded-xl"
      style={{
        background: isAccent
          ? "rgba(248,113,113,0.04)"
          : "rgba(255,255,255,0.02)",
        border: `1px solid ${isAccent ? "rgba(248,113,113,0.15)" : "rgba(255,255,255,0.04)"}`,
      }}
    >
      <h4
        className="text-[10px] font-bold uppercase tracking-[0.15em] mb-2"
        style={{ color: isAccent ? "#f87171" : "#b498ff" }}
      >
        {title}
      </h4>
      <p
        className="text-sm leading-relaxed"
        style={{ color: "rgba(255,255,255,0.8)" }}
      >
        {content || "Tidak ada data"}
      </p>
    </div>
  );
}

// ==================== MAIN COMPONENT ====================
export function NewsFeedPanel() {
  const { lastUpdated, currentRegime, dataStatus } = useMacroTerminal();
  const [feed, setFeed] = useState<NewsItem[]>([]);
  const [isFallback, setIsFallback] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Record<string, any>>({});
  const [modalData, setModalData] = useState<{
    item: NewsItem;
    rawAnalysis: string;
  } | null>(null);

  const parsedAnalysis = modalData
    ? extractFirstJSON(modalData.rawAnalysis)
    : null;

  const inferConfidence = (headline: string): NewsItem["confidence"] => {
    const strong = ["fed", "fomc", "powell", "cpi", "pce", "payroll", "nfp", "inflation", "rate", "recession", "war", "attack", "strike", "ecb", "boj"];
    const medium = ["claims", "pmi", "retail", "sentiment", "confidence", "oil", "yield", "earnings", "gdp"];
    const lower = headline.toLowerCase();
    if (strong.some((term) => lower.includes(term))) return "HIGH";
    if (medium.some((term) => lower.includes(term))) return "MEDIUM";
    return "LOW";
  };

  const inferAlignment = (headline: string): NewsItem["alignment"] => {
    const lower = headline.toLowerCase();
    if (!currentRegime) return "UNVERIFIED";

    const isHotInflation = /(inflation|cpi|pce|hot|sticky|surge|jump)/.test(lower);
    const isColdInflation = /(disinflation|cool|drop|fall|cut)/.test(lower);
    const isStrongGrowth = /(strong|beat|jump|rally|surge|growth|robust)/.test(lower);
    const isWeakGrowth = /(recession|weak|drop|fall|miss|slowdown|crash)/.test(lower);

    switch (currentRegime) {
      case "Goldilocks":
        if (isColdInflation || isStrongGrowth) return "REGIME-ALIGNED";
        if (isHotInflation || isWeakGrowth) return "REGIME-CONFLICT";
        break;
      case "Reflation":
        if (isHotInflation || isStrongGrowth) return "REGIME-ALIGNED";
        if (isColdInflation || isWeakGrowth) return "REGIME-CONFLICT";
        break;
      case "Stagflation":
        if (isHotInflation || isWeakGrowth) return "REGIME-ALIGNED";
        if (isColdInflation || isStrongGrowth) return "REGIME-CONFLICT";
        break;
      case "Deflation":
        if (isColdInflation || isWeakGrowth) return "REGIME-ALIGNED";
        if (isHotInflation || isStrongGrowth) return "REGIME-CONFLICT";
        break;
    }
    return "UNVERIFIED";
  };

  const mapNewsItem = (item: Record<string, unknown>, index: number): NewsItem => {
    const date = item.datetime ? new Date((item.datetime as number) * 1000) : new Date();
    const timeStr = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;

    let impact: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";
    let asset = "MKT";
    const rawHeadline = typeof item.headline === "string" ? item.headline : "";
    const headlineLower = rawHeadline.toLowerCase();
    
    let cleanHeadline = rawHeadline
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (cleanHeadline.length > 130) {
      cleanHeadline = cleanHeadline.substring(0, 127) + "...";
    }

    // 1. Asset & Impact Classification
    if (headlineLower.includes("fed") || headlineLower.includes("powell") || headlineLower.includes("fomc") || headlineLower.includes("cpi") || headlineLower.includes("pce")) {
      asset = "USD";
      // Hawkish = Bullish USD, Dovish = Bearish USD
      if (/(hike|hawkish|hot|sticky|higher|strong|beat)/.test(headlineLower)) impact = "BULLISH";
      else if (/(cut|dovish|cool|lower|weak|miss|soft)/.test(headlineLower)) impact = "BEARISH";
    } else if (headlineLower.includes("ecb") || headlineLower.includes("lagarde")) {
      asset = "EUR";
      if (/(hike|hawkish|strong|up)/.test(headlineLower)) impact = "BULLISH";
      else if (/(cut|dovish|weak|down)/.test(headlineLower)) impact = "BEARISH";
    } else if (headlineLower.includes("boj") || headlineLower.includes("ueda") || headlineLower.includes("yen")) {
      asset = "JPY";
      if (/(hike|hawkish|intervene|strong)/.test(headlineLower)) impact = "BULLISH";
      else if (/(cut|dovish|weak|down)/.test(headlineLower)) impact = "BEARISH";
    } else if (/(gold|safe haven|middle east|war|sanctions|conflict|military|strike|missile|geopolitical|iran|israel|russia|ukraine)/.test(headlineLower)) {
      asset = "GOLD";
      if (/(war|strike|attack|escalat|tension|fear|risk off)/.test(headlineLower)) impact = "BULLISH";
      else if (/(peace|truce|ease|risk on)/.test(headlineLower)) impact = "BEARISH";
    } else if (/(stocks|s&p|nasdaq|tech|earnings|market|equity)/.test(headlineLower)) {
      asset = "EQUITY";
      if (/(beat|jump|rally|surge|strong|buy|upgrade)/.test(headlineLower)) impact = "BULLISH";
      else if (/(miss|drop|crash|fall|weak|recession|sell|downgrade)/.test(headlineLower)) impact = "BEARISH";
    } else if (headlineLower.includes("yield") || headlineLower.includes("treasury") || headlineLower.includes("bond")) {
      asset = "BONDS";
      if (/(rise|jump|surge|higher)/.test(headlineLower)) impact = "BEARISH"; // Yields up = Bonds down
      else if (/(fall|drop|lower)/.test(headlineLower)) impact = "BULLISH";
    }

    const summaryStr = typeof item.summary === "string" ? item.summary : "";
    return {
      id: `news-${index}-${(item.headline || item.id || "fallback").toString().slice(0, 24)}`,
      time: timeStr,
      headline: cleanHeadline,
      impact,
      targetAsset: asset,
      aiSummary: summaryStr, // kept in object, but hidden in UI
      confidence: inferConfidence(cleanHeadline),
      alignment: inferAlignment(cleanHeadline),
    };
  };

  const analyzeFeedItem = async (item: NewsItem) => {
    // Jika sudah ada cache, langsung buka modal tanpa generate baru
    if (analysis[item.id]) {
      const rawAnalysis =
        typeof analysis[item.id] === "string"
          ? analysis[item.id]
          : JSON.stringify(analysis[item.id], null, 2);
      setModalData({ item, rawAnalysis });
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
        const rawAnalysis =
          typeof data.analysis === "string"
            ? data.analysis
            : JSON.stringify(data.analysis, null, 2);
        setAnalysis((prev) => ({ ...prev, [item.id]: data.analysis }));
        setModalData({ item, rawAnalysis });
      }
    } catch {
      // analyzer failure is surfaced by keeping the button enabled
    } finally {
      setAnalyzingId(null);
    }
  };

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const res = await fetch("/api/v1/market-data/news");
        const data = await res.json();

        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          const mappedNews = data.data.slice(0, 20).map(mapNewsItem);
          setFeed(mappedNews);
          setIsFallback(false);
        } else {
          throw new Error("Invalid API response");
        }
      } catch {
        setIsFallback(true);
        const highImpactMock = mockNews
          .map((item, index) => ({
            ...item,
            confidence: inferConfidence(item.headline),
            alignment: inferAlignment(item.headline),
          }))
          .filter((item) => 
            (item.impact === "BULLISH" || item.impact === "BEARISH") &&
            (item.confidence === "HIGH" || item.alignment !== "UNVERIFIED")
          ) as NewsItem[];
        setFeed(highImpactMock);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, []);

  return (
    <>
      <div className="flex flex-col h-full glass border border-border-subtle rounded-xl overflow-hidden relative">
        <div className="bg-bg-surface/80 border-b border-border-subtle p-3 flex justify-between items-center z-10 shadow-sm">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-text-primary uppercase tracking-wider text-[10px] sm:text-xs flex items-center gap-2">
              <AlertCircle size={14} />
              Macro Feed
            </h2>
            {lastUpdated && (
              <span className="text-[9px] text-text-muted font-mono whitespace-nowrap ml-2 hidden sm:inline-block">
                {new Intl.DateTimeFormat("id-ID", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                }).format(lastUpdated)}{" "}
                WIB
              </span>
            )}
          </div>
          {isFallback || dataStatus.news === "error" ? (
            <span className="flex items-center gap-1 text-[10px] text-data-warning font-mono bg-data-warning/10 px-2 py-0.5 rounded border border-data-warning/30">
              <ShieldAlert size={10} /> {isFallback ? "MOCK FALLBACK" : "ERROR"}
            </span>
          ) : dataStatus.news === "cache" ? (
            <span className="flex items-center gap-1 text-[10px] text-data-warning font-mono bg-data-warning/10 px-2 py-0.5 rounded border border-data-warning/30">
              <Clock size={10} /> CACHE
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] text-data-profit font-mono bg-data-profit/10 px-2 py-0.5 rounded border border-data-profit/30">
              <Clock size={10} /> LIVE API
            </span>
          )}
          </div>

          <div className="flex-1 overflow-y-auto p-0 scrollbar-thin scrollbar-thumb-accent-gold/20">
            {loading || feed.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <span className="text-xs text-text-muted font-mono animate-pulse">
                  {loading
                    ? "Fetching data from Bloomberg proxy..."
                    : "Awaiting data stream..."}
                </span>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border-subtle">
                {feed.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 hover:bg-bg-surface/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5 min-w-0">
                      <div className="flex items-start gap-2 min-w-0">
                        <span className="text-[10px] font-mono text-text-muted mt-0.5 whitespace-nowrap flex-shrink-0">
                          [{item.time}]
                        </span>
                        <p className="text-sm font-semibold text-text-primary leading-snug break-words min-w-0">
                          {item.headline}
                        </p>
                      </div>
                      <button
                        onClick={() => analyzeFeedItem(item)}
                        disabled={analyzingId === item.id}
                        className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono text-accent-gold border border-accent-gold/30 rounded hover:bg-accent-gold/10 transition-colors disabled:opacity-50 shrink-0"
                      >
                        <Brain size={12} />
                        {analyzingId === item.id
                          ? "ANALYZING..."
                          : analysis[item.id]
                            ? "VIEW"
                            : "ANALYZER"}
                      </button>
                    </div>

                  <div className="pl-10">
                    <div className="flex flex-wrap items-center gap-2">
                      <div
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${getImpactColor(item.impact)}`}
                      >
                        {getImpactIcon(item.impact)}
                        {item.impact} {item.targetAsset}
                      </div>
                      {item.alignment !== "UNVERIFIED" && (
                        <div
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${getAlignmentColor(item.alignment)}`}
                        >
                          {item.alignment}
                        </div>
                      )}
                      {item.confidence !== "LOW" && (
                        <div className="px-1.5 py-0.5 rounded text-[10px] font-bold border border-border-subtle text-text-muted bg-surface-elevated/40">
                          CONF {item.confidence}
                        </div>
                      )}
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
