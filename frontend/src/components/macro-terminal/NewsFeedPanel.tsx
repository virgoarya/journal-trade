"use client";

import React, { useState, useEffect } from "react";
import { AlertCircle, ArrowDownRight, ArrowUpRight, Clock, ShieldAlert, Brain, X } from "lucide-react";
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

      {/* Modal */}
      {modalData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-bg-surface border border-border-subtle rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in duration-300">
            <div className="p-4 border-b border-border-subtle flex justify-between items-center bg-bg-surface/80">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-accent-gold" />
                <h3 className="font-mono font-bold text-text-primary uppercase tracking-widest text-sm">
                  Macro Feed Analysis
                </h3>
              </div>
              <button 
                onClick={() => setModalData(null)}
                className="text-text-muted hover:text-accent-gold transition-colors font-mono text-xs flex items-center gap-1"
              >
                [ CLOSE ]
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto font-mono text-sm leading-relaxed scrollbar-thin scrollbar-thumb-accent-gold/20 text-text-secondary">
              <div className="mb-4 pb-4 border-b border-border-subtle/50">
                <p className="text-text-primary font-semibold mb-2">{modalData.item.headline}</p>
                <div className="flex items-center gap-2 text-xs">
                  <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded font-bold border ${getImpactColor(modalData.item.impact)}`}>
                    {getImpactIcon(modalData.item.impact)}
                    {modalData.item.impact} {modalData.item.targetAsset}
                  </span>
                </div>
              </div>
              <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-bg-void prose-pre:border prose-pre:border-border-subtle prose-a:text-accent-gold hover:prose-a:text-accent-gold-dim text-xs">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {modalData.analysis}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
