"use client";

import React, { useState, useEffect } from "react";
import { AlertCircle, ArrowDownRight, ArrowUpRight, Clock, ShieldAlert, Brain, X, Zap, TrendingUp, Activity } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface NewsItem {
  id: string;
  time: string;
  headline: string;
  impact: "BULLISH" | "BEARISH" | "NEUTRAL";
  targetAsset: string;
  aiSummary: string;
}

interface MacroAnalysis {
  Fakta: string;
  DampakMarket: string;
  Logika: string;
  Contrarian: string;
  Trigger: string;
  Confidence: string;
  Risk: string;
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

export function NewsFeedPanel() {
  const [feed, setFeed] = useState<NewsItem[]>([]);
  const [isFallback, setIsFallback] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Record<string, string>>({});
  const [modalData, setModalData] = useState<{ item: NewsItem; analysis: string } | null>(null);

  const analyzeFeedItem = async (item: NewsItem) => {
    if (analysis[item.id]) {
      setModalData({ item, analysis: analysis[item.id] });
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
        setModalData({ item, analysis: data.analysis });
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

  const getImpactColor = (impact: string) => {
    if (impact === "BULLISH") return "text-data-profit border-data-profit bg-data-profit/10";
    if (impact === "BEARISH") return "text-data-loss border-data-loss bg-data-loss/10";
    return "text-text-muted border-border-subtle bg-bg-void";
  };

  const getImpactIcon = (impact: string) => {
    if (impact === "BULLISH") return <ArrowUpRight size={14} className="text-data-profit" />;
    if (impact === "BEARISH") return <ArrowDownRight size={14} className="text-data-loss" />;
    return <AlertCircle size={14} className="text-text-muted" />;
  };

  let parsedAnalysis: any = null;
  if (modalData?.analysis) {
    try {
      const cleanedStr = modalData.analysis.replace(/```json/gi, "").replace(/```/g, "").trim();
      parsedAnalysis = JSON.parse(cleanedStr);
    } catch (e) {
      // Fallback ke markdown biasa jika gagal parse
    }
  }

  return (
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
                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono text-accent-gold border border-accent-gold/30 rounded hover:bg-accent-gold/10 transition-colors disabled:opacity-50"
                  >
                    <Brain size={12} />
                    {analyzingId === item.id ? "ANALYZING..." : "ANALYZER"}
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

      {/* Premium Elite AI Coach Analysis Modal */}
      {modalData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-3xl bg-[#0a0a0c] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in duration-300">
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex justify-between items-start bg-gradient-to-b from-white/[0.02] to-transparent">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#b498ff]/10 flex items-center justify-center border border-[#b498ff]/20 shrink-0">
                  <Zap className="w-6 h-6 text-[#b498ff]" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-xl tracking-wide">
                    Macro Feed Intelligence
                  </h3>
                  <p className="text-[10px] text-[#b498ff] uppercase tracking-widest font-bold mt-1">
                    HUNTER TRADES AI ANALYSIS
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setModalData(null)}
                className="text-white/40 hover:text-white transition-colors p-1"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Body */}
            <div className="p-6 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 text-white/80">
              {/* Context / Source Info */}
              <div className="mb-6 pb-6 border-b border-white/5">
                <p className="text-white font-medium mb-3 italic">"{modalData.item.headline}"</p>
                <div className="flex items-center gap-2 text-xs">
                  <span className={`flex items-center gap-1 px-2 py-1 rounded font-bold border ${getImpactColor(modalData.item.impact)}`}>
                    {getImpactIcon(modalData.item.impact)}
                    {modalData.item.impact} {modalData.item.targetAsset}
                  </span>
                </div>
              </div>

              {parsedAnalysis ? (
                <div className="flex flex-col gap-6">
                  {/* Executive Summary (Fakta) & Confidence */}
                  <div className="flex flex-col sm:flex-row gap-6 items-start">
                    <div className="flex-1 w-full">
                      <h4 className="text-[10px] font-bold text-[#b498ff] uppercase tracking-widest mb-3">EXECUTIVE SUMMARY / FACT</h4>
                      <div className="p-5 rounded-xl bg-gradient-to-br from-white/5 to-transparent border-l-2 border-[#b498ff]">
                        <p className="text-sm text-white/90 leading-relaxed">
                          {parsedAnalysis.fakta}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-center justify-center p-5 rounded-xl bg-white/5 border border-white/10 shrink-0 sm:min-w-[140px] w-full sm:w-auto">
                      <span className="text-[10px] text-white/50 uppercase tracking-widest font-bold mb-2">CONFIDENCE</span>
                      <span className="text-xl font-bold text-accent-gold text-center">
                        {parsedAnalysis.confidence?.split(" ")[0]?.split("-")[0] || "HIGH"}
                      </span>
                    </div>
                  </div>

                  {/* Logika & Contrarian */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-[10px] font-bold text-data-profit uppercase tracking-widest mb-4 flex items-center gap-2">
                        <TrendingUp size={14} /> LOGICAL IMPACT
                      </h4>
                      <ul className="space-y-4">
                        <li className="flex gap-3 items-start text-sm text-white/70">
                          <span className="text-data-profit mt-0.5">✦</span>
                          <span className="leading-relaxed"><strong className="text-white/90">Dampak:</strong> {parsedAnalysis.dampak}</span>
                        </li>
                        <li className="flex gap-3 items-start text-sm text-white/70">
                          <span className="text-data-profit mt-0.5">✦</span>
                          <span className="leading-relaxed"><strong className="text-white/90">Logika:</strong> {parsedAnalysis.logika}</span>
                        </li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-bold text-data-loss uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Activity size={14} /> CONTRARIAN VIEW
                      </h4>
                      <ul className="space-y-4">
                        <li className="flex gap-3 items-start text-sm text-white/70">
                          <span className="text-data-loss mt-0.5">⎔</span>
                          <span className="leading-relaxed">{parsedAnalysis.contrarian}</span>
                        </li>
                      </ul>
                    </div>
                  </div>

                  {/* Risk Alert */}
                  {parsedAnalysis.risk && (
                    <div className="p-5 rounded-xl border border-data-loss/30 bg-data-loss/5 flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-data-loss/20 flex items-center justify-center shrink-0">
                        <AlertCircle size={20} className="text-data-loss" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-data-loss uppercase tracking-widest mb-1.5">RISK ALERT</h4>
                        <p className="text-sm text-white/80 leading-relaxed">{parsedAnalysis.risk}</p>
                      </div>
                    </div>
                  )}

                  {/* Confidence Full Description */}
                  {parsedAnalysis.confidence && parsedAnalysis.confidence.length > 15 && (
                    <div className="p-5 rounded-xl border border-white/5 bg-white/[0.02]">
                      <h4 className="text-[10px] font-bold text-[#b498ff] uppercase tracking-widest mb-2">PROFESSIONAL RECOMMENDATION</h4>
                      <p className="text-sm text-white/70 italic">"{parsedAnalysis.confidence}"</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-black/50 prose-pre:border prose-pre:border-white/10 prose-a:text-[#b498ff] hover:prose-a:brightness-110 text-white/80">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {modalData.analysis}
                  </ReactMarkdown>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-white/5 bg-black/40 flex justify-end shrink-0">
              <button 
                onClick={() => setModalData(null)}
                className="px-6 py-2.5 bg-[#b498ff] text-black font-bold text-xs uppercase tracking-widest rounded-full hover:brightness-110 hover:shadow-[0_0_15px_rgba(180,152,255,0.4)] transition-all"
              >
                Close Analysis
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
