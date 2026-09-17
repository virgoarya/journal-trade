"use client";

import React, { useState, useEffect } from "react";
import { Bot, Send, MessageCircle, Activity, Zap } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useMacroTerminal } from "@/components/macro-terminal/MacroTerminalContext";

interface AgentInsight {
  personaId: "hawk" | "dove" | "contrarian" | "consensus";
  conviction: "TINGGI" | "SEDANG" | "RENDAH";
  regime?: string;
  content: string;
  createdAt: string;
}

const PERSONAS = [
  {
    id: "hawk" as const,
    label: "Hawk",
    emoji: "🦅",
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
    description: "The Quant — Inflation & Tightening",
  },
  {
    id: "dove" as const,
    label: "Dove",
    emoji: "🕊️",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
    description: "The Strategist — Growth & Easing",
  },
  {
    id: "contrarian" as const,
    label: "Contrarian",
    emoji: "🎯",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
    description: "The Maverick — Anomaly & Reversals",
  },
];

const CONVICTION_COLORS: Record<string, string> = {
  TINGGI: "text-red-500",
  SEDANG: "text-yellow-400",
  RENDAH: "text-green-500",
};

const CONVICTION_LABELS: Record<string, string> = {
  TINGGI: "Sangat Yakin",
  SEDANG: "Cukup",
  RENDAH: "Ragu",
};

function AgentPulse({
  conviction,
  personaId,
}: {
  conviction: string;
  personaId: "hawk" | "dove" | "contrarian";
}) {
  const persona = PERSONAS.find((p) => p.id === personaId);
  return (
    <div className="w-9 h-9 rounded-full flex items-center justify-center text-base font-bold bg-card border border-border shrink-0">
      {persona?.emoji || "?"}
    </div>
  );
}

function AgentSentimentCard({
  insight,
  regime,
  personaId,
}: {
  insight?: AgentInsight;
  regime?: string;
  personaId: "hawk" | "dove" | "contrarian";
}) {
  const persona = PERSONAS.find((p) => p.id === personaId);
  const conviction = insight?.conviction || "SEDANG";

  return (
    <div className={`flex items-center gap-2.5 p-3 rounded-lg border ${persona?.borderColor || "border-border"} bg-card/40`}>
      <AgentPulse conviction={conviction} personaId={personaId} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <span className={`font-mono text-xs font-bold uppercase tracking-wide ${persona?.color}`}>
            {persona?.label}
          </span>
          <span className={`font-mono text-[10px] font-semibold ${CONVICTION_COLORS[conviction]}`}>
            {CONVICTION_LABELS[conviction]}
          </span>
        </div>
        {regime && (
          <p className="text-[10px] font-mono text-text-muted truncate mt-0.5">
            Regime: {regime}
          </p>
        )}
      </div>
    </div>
  );
}

function AgentReplyCard({
  title,
  reply,
  personaId,
}: {
  title: string;
  reply: string;
  personaId: "hawk" | "dove" | "contrarian";
}) {
  const persona = PERSONAS.find((p) => p.id === personaId);
  const cleanReply = reply.replace(/```[a-z]*\s*$/g, "").replace(/`+\s*$/g, "").trim();

  return (
    <div className={`p-3.5 rounded-lg border ${persona?.borderColor} bg-card/40 space-y-2`}>
      <div className="flex items-center gap-2 border-b border-border-subtle pb-2">
        <span className="text-base">{persona?.emoji}</span>
        <h4 className={`font-mono text-xs font-bold ${persona?.color}`}>{title}</h4>
      </div>
      <div className="text-xs font-mono text-text-main leading-relaxed prose prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{cleanReply}</ReactMarkdown>
      </div>
    </div>
  );
}

function ConsensusResult({ consensus }: { consensus: string }) {
  const cleanConsensus = consensus.replace(/```[a-z]*\s*$/g, "").replace(/`+\s*$/g, "").trim();

  return (
    <div className="p-4 rounded-lg border border-accent-gold/30 bg-accent-gold/5 space-y-2">
      <div className="flex items-center gap-2 border-b border-accent-gold/20 pb-2">
        <MessageCircle size={14} className="text-accent-gold" />
        <h4 className="font-mono text-xs font-bold text-accent-gold uppercase tracking-wider">
          Consensus & Action Plan
        </h4>
      </div>
      <div className="text-xs font-mono text-text-primary leading-relaxed prose prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{cleanConsensus}</ReactMarkdown>
      </div>
    </div>
  );
}

function FormattedInsightContent({ content }: { content: string }) {
  if (!content) return <p className="text-[11px] text-text-muted">Tidak ada konten.</p>;

  // Split by numbered headers like "1. [KONDISI]", "2. [IMPLIKASI]", "3. [AKSI]"
  const sections = content
    .split(/(?=\d+\.\s*\[(?:KONDISI|IMPLIKASI|AKSI)\])/gi)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sections.length <= 1) {
    // Fallback: split by newlines if no numbered headers
    const paragraphs = content.split(/\n\s*\n/).filter((p) => p.trim());
    return (
      <div className="space-y-2 mt-1">
        {paragraphs.map((para, i) => (
          <p key={i} className="text-[11px] text-text-muted leading-relaxed whitespace-pre-line">
            {para.trim()}
          </p>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2 mt-1.5">
      {sections.map((sec, idx) => {
        const headerMatch = sec.match(/^(\d+\.\s*\[(KONDISI|IMPLIKASI|AKSI)\])\s*[-—:]?\s*([\s\S]*)$/i);
        if (headerMatch) {
          const [, fullHeader, tag, text] = headerMatch;
          const tagUpper = tag.toUpperCase();
          const badgeColor =
            tagUpper === "KONDISI"
              ? "text-blue-400 bg-blue-500/10 border-blue-500/30"
              : tagUpper === "IMPLIKASI"
              ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
              : "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";

          return (
            <div key={idx} className="space-y-1">
              <span className={`inline-block font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border ${badgeColor}`}>
                {fullHeader}
              </span>
              <p className="text-[11px] text-text-muted leading-relaxed pl-1">
                {text.trim()}
              </p>
            </div>
          );
        }

        return (
          <p key={idx} className="text-[11px] text-text-muted leading-relaxed whitespace-pre-line">
            {sec}
          </p>
        );
      })}
    </div>
  );
}

const DEBATE_QUICK_PROMPTS = [
  {
    label: "XAUUSD Setup",
    prompt: "Analisis XAUUSD untuk minggu ini — faktor makro, korelasi yield, dan skenario entri/SL.",
  },
  {
    label: "Stagflation Impact",
    prompt: "Bagaimana dampak stagflasi terhadap XAUUSD, DXY, dan saham teknologi?",
  },
  {
    label: "Fed Pivot Risk",
    prompt: "Risiko Fed pivot Q4 — dampak pada Yield Obligasi, USD corridor, dan emas.",
  },
];

const PERSONA_QUICK_GUIDES = [
  {
    id: "hawk" as const,
    personaLabel: "Hawk · The Quant",
    category: "Pengetatan & Likuiditas",
    prompt: "Analisis risiko stagflasi, tekanan CPI YoY 3.71%, dan implikasi liquidity drain 93 terhadap aset berisiko.",
    border: "border-red-500/20",
    bg: "bg-red-500/5 hover:bg-red-500/10",
    textColor: "text-red-400",
    emoji: "🦅",
  },
  {
    id: "dove" as const,
    personaLabel: "Dove · The Strategist",
    category: "Peluang & Pertumbuhan",
    prompt: "Identifikasi peluang risk-on di tengah PMI ekspansif 55.6 dan potensi pelonggaran moneter bank sentral.",
    border: "border-green-500/20",
    bg: "bg-green-500/5 hover:bg-green-500/10",
    textColor: "text-green-400",
    emoji: "🕊️",
  },
  {
    id: "contrarian" as const,
    personaLabel: "Contrarian · The Maverick",
    category: "Anomali & Tail Risk",
    prompt: "Bongkar jebakan konsensus pasar, risiko likuidasi tersembunyi, dan pembalikan tren yang diabaikan.",
    border: "border-purple-500/20",
    bg: "bg-purple-500/5 hover:bg-purple-500/10",
    textColor: "text-purple-400",
    emoji: "🎯",
  },
];

export function AgentIntelligencePanel() {
  const { currentRegime, liquidity, assets } = useMacroTerminal();
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [proactiveInsights, setProactiveInsights] = useState<AgentInsight[]>([]);
  const [activeTab, setActiveTab] = useState<"dashboard" | "debate">("dashboard");
  const [hawkReply, setHawkReply] = useState<string>("");
  const [doveReply, setDoveReply] = useState<string>("");
  const [contrarianReply, setContrarianReply] = useState<string>("");
  const [consensus, setConsensus] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [inputPrompt, setInputPrompt] = useState<string>("");
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);

  useEffect(() => {
    const wsUrl = `${window.location.protocol}//${window.location.hostname}:5000`;
    const ws = new WebSocket(wsUrl);
    setSocket(ws);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "subscribe", channel: "agent:proactive" }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "agent:proactive") {
          const data = msg.data;
          const newInsight: AgentInsight = {
            personaId: data.personaId,
            conviction: data.conviction || "SEDANG",
            regime: data.regime,
            content: data.content,
            createdAt: data.timestamp,
          };
          setProactiveInsights((prev) => {
            const updated = [newInsight, ...prev.filter((i) => i.personaId !== newInsight.personaId)];
            return updated.slice(0, 10);
          });
        }
      } catch {
        /* ignore */
      }
    };

    return () => ws.close();
  }, []);

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/v1/agent-consensus/proactive/latest`);
        if (res.ok) {
          const data = await res.json();
          const insightsArray = Object.values(data.data || {});
          setProactiveInsights(insightsArray);
        }
      } catch (e) {
        console.error("[UI] Failed to fetch proactive insights:", e);
      }
    };
    fetchInsights();
  }, [BACKEND_URL]);

  const getActivePrompt = () => {
    if (selectedPrompt) return selectedPrompt;
    return inputPrompt.trim();
  };

  const handleDebate = async (mode: "parallel" | "sequential") => {
    const prompt = getActivePrompt();
    if (!prompt) return;

    setLoading(true);
    setConsensus("");
    setHawkReply("");
    setDoveReply("");
    setContrarianReply("");

    try {
      const res = await fetch(`${BACKEND_URL}/api/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          context: { currentRegime, liquidity, assets },
        }),
      });

      if (res.ok) {
        const result = await res.json();
        setHawkReply(result.hawk?.reply || "");
        setDoveReply(result.dove?.reply || "");
        setContrarianReply(result.contrarian?.reply || "");
        setConsensus(result.consensus || "");
      }
    } catch (e) {
      console.error("[UI] Debate error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSingleAgent = async (persona: "hawk" | "dove" | "contrarian") => {
    const prompt = getActivePrompt() || "Berikan analisis makroekonomi singkat untuk kondisi pasar saat ini.";

    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/agent-consensus/single/${persona}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          context: { currentRegime, liquidity, assets },
        }),
      });

      if (res.ok) {
        const result = await res.json();
        if (persona === "hawk") setHawkReply(result.reply);
        if (persona === "dove") setDoveReply(result.reply);
        if (persona === "contrarian") setContrarianReply(result.reply);
      }
    } catch (e) {
      console.error("[UI] Single agent error:", e);
    } finally {
      setLoading(false);
    }
  };

  const insightsByPersona = {
    hawk: proactiveInsights.find((i) => i.personaId === "hawk"),
    dove: proactiveInsights.find((i) => i.personaId === "dove"),
    contrarian: proactiveInsights.find((i) => i.personaId === "contrarian"),
  };

  return (
    <div className="flex flex-col h-full min-h-0 space-y-3">
      {/* Sub-tab Navigation */}
      <div className="flex items-center gap-1 bg-surface-elevated/40 rounded-lg p-1 border border-border-subtle shrink-0">
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 font-mono text-xs font-semibold rounded transition-all ${
            activeTab === "dashboard"
              ? "bg-data-profit/10 text-data-profit border border-data-profit/30"
              : "text-text-muted hover:text-text-main"
          }`}
        >
          <Activity size={12} />
          <span>Dashboard & Sentiment</span>
        </button>
        <button
          onClick={() => setActiveTab("debate")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 font-mono text-xs font-semibold rounded transition-all ${
            activeTab === "debate"
              ? "bg-accent-gold/10 text-accent-gold border border-accent-gold/30"
              : "text-text-muted hover:text-text-main"
          }`}
        >
          <MessageCircle size={12} />
          <span>Debate & Consensus</span>
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 custom-scrollbar pr-1">
        {activeTab === "dashboard" && (
          <>
            {/* Agent Sentiment Cards */}
            <div className="grid grid-cols-3 gap-2">
              <AgentSentimentCard
                personaId="hawk"
                insight={insightsByPersona.hawk}
                regime={currentRegime || undefined}
              />
              <AgentSentimentCard
                personaId="dove"
                insight={insightsByPersona.dove}
                regime={currentRegime || undefined}
              />
              <AgentSentimentCard
                personaId="contrarian"
                insight={insightsByPersona.contrarian}
                regime={currentRegime || undefined}
              />
            </div>

            {/* Proactive Insights */}
            <div className="space-y-1.5 max-h-[320px] overflow-y-auto pb-2 custom-scrollbar">
              <h4 className="font-mono text-[10px] uppercase tracking-widest text-text-muted flex items-center gap-1">
                <Zap size={10} className="text-accent-gold" />
                Proactive Insights (Auto-Watcher)
              </h4>
              {proactiveInsights.length > 0 ? (
                <div className="space-y-2">
                  {proactiveInsights.map((insight, idx) => {
                    const persona = PERSONAS.find((p) => p.id === insight.personaId);
                    return (
                      <div
                        key={idx}
                        className={`p-2.5 rounded-lg border ${persona?.borderColor || "border-border-subtle"} bg-card/30 font-mono text-xs space-y-1`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span>{persona?.emoji}</span>
                            <span className={`font-bold ${persona?.color}`}>{persona?.label}</span>
                          </div>
                          <span className={`text-[10px] font-semibold ${CONVICTION_COLORS[insight.conviction] || "text-text-muted"}`}>
                            {CONVICTION_LABELS[insight.conviction] || insight.conviction}
                          </span>
                        </div>
                        <FormattedInsightContent content={insight.content || ""} />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 rounded-lg border border-border-subtle bg-card/20 text-center font-mono text-xs text-text-muted">
                  Menunggu siklus analisis otomatis berikutnya...
                </div>
              )}
            </div>

            {/* Single Agent Quick Query */}
            <div className="space-y-1.5 pt-1">
              <h4 className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
                Single Agent Direct Query
              </h4>
              <div className="grid grid-cols-3 gap-2">
                {PERSONAS.map((persona) => (
                  <button
                    key={persona.id}
                    onClick={() => handleSingleAgent(persona.id)}
                    disabled={loading}
                    className={`py-2 px-3 rounded border font-mono text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                      persona.id === "hawk"
                        ? "border-red-500/30 text-red-400 hover:bg-red-500/10"
                        : persona.id === "dove"
                        ? "border-green-500/30 text-green-400 hover:bg-green-500/10"
                        : "border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                    }`}
                  >
                    <span>{persona.emoji}</span>
                    <span>{persona.label}</span>
                  </button>
                ))}
              </div>

              {/* Default Placeholder when no agent query has been executed yet */}
              {!loading && !hawkReply && !doveReply && !contrarianReply && (
                <div className="mt-3 p-3 rounded-lg border border-border-subtle bg-surface-elevated/30 font-mono text-xs space-y-2.5">
                  <div className="flex items-center justify-between border-b border-border-subtle pb-1.5">
                    <span className="text-[10px] uppercase font-bold text-accent-gold tracking-wider">
                      💡 Panduan Persona & Quick Prompts
                    </span>
                    <span className="text-[9px] text-text-muted">Klik untuk analisis instan</span>
                  </div>

                  <div className="space-y-2 text-[11px]">
                    {PERSONA_QUICK_GUIDES.map((guide) => (
                      <div key={guide.id}>
                        <div
                          onClick={() => handleSingleAgent(guide.id)}
                          className={`p-2 rounded border ${guide.border} ${guide.bg} cursor-pointer transition-all flex items-start gap-2`}
                        >
                          <span className="text-base">{guide.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className={`font-bold ${guide.textColor}`}>{guide.personaLabel}</span>
                              <span className="text-[9px] text-text-muted">{guide.category}</span>
                            </div>
                            <p className="text-[10px] text-text-muted mt-0.5">
                              "{guide.prompt}"
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Display Single Agent Response in the Dashboard tab */}
              {loading && (
                <div className="p-3 rounded border border-border-subtle bg-card/20 text-center font-mono text-xs text-accent-gold animate-pulse">
                  Agent sedang memproses kueri...
                </div>
              )}

              {hawkReply && (
                <AgentReplyCard
                  title="Hawk — Quant & Tightening Analysis"
                  reply={hawkReply}
                  personaId="hawk"
                />
              )}

              {doveReply && (
                <AgentReplyCard
                  title="Dove — Strategy & Accommodative View"
                  reply={doveReply}
                  personaId="dove"
                />
              )}

              {contrarianReply && (
                <AgentReplyCard
                  title="Contrarian — Maverick Anomaly Analysis"
                  reply={contrarianReply}
                  personaId="contrarian"
                />
              )}
            </div>
          </>
        )}

        {activeTab === "debate" && (
          <>
            {/* Debate Setup Controls */}
            <div className="space-y-2 p-3 rounded-lg border border-border-subtle bg-card/30">
              {/* Quick Prompt Selector */}
              <div>
                <label className="font-mono text-[10px] uppercase tracking-wider text-text-muted block mb-1.5">
                  Quick Topics
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {DEBATE_QUICK_PROMPTS.map((qp, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        if (selectedPrompt === qp.prompt) {
                          setSelectedPrompt(null);
                        } else {
                          setSelectedPrompt(qp.prompt);
                          setInputPrompt("");
                        }
                      }}
                      className={`px-2.5 py-1 font-mono text-[10px] rounded border transition-all ${
                        selectedPrompt === qp.prompt
                          ? "border-accent-gold bg-accent-gold/15 text-accent-gold font-bold"
                          : "border-border-subtle text-text-muted hover:text-text-main hover:bg-surface-elevated"
                      }`}
                    >
                      {qp.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Input Textarea */}
              <div>
                <textarea
                  value={inputPrompt}
                  onChange={(e) => {
                    setInputPrompt(e.target.value);
                    if (selectedPrompt) setSelectedPrompt(null);
                  }}
                  placeholder="Atau ketik topik debat & analisis spesifik..."
                  className="w-full p-2.5 rounded border border-border-subtle bg-surface-elevated/50 font-mono text-xs text-text-primary focus:outline-none focus:border-accent-gold/50 resize-none"
                  rows={2}
                />
              </div>

              {/* Debate Action Buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => handleDebate("parallel")}
                  disabled={loading || (!inputPrompt.trim() && !selectedPrompt)}
                  className="flex-1 py-2 px-3 rounded bg-accent-gold/15 border border-accent-gold/30 font-mono text-xs font-bold text-accent-gold hover:bg-accent-gold/25 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
                >
                  <Send size={12} />
                  <span>Parallel Debate</span>
                </button>
                <button
                  onClick={() => handleDebate("sequential")}
                  disabled={loading || (!inputPrompt.trim() && !selectedPrompt)}
                  className="flex-1 py-2 px-3 rounded bg-data-profit/15 border border-data-profit/30 font-mono text-xs font-bold text-data-profit hover:bg-data-profit/25 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
                >
                  <Bot size={12} />
                  <span>Sequential Chain</span>
                </button>
              </div>

              {/* Mode Explanation Card */}
              <div className="p-2.5 rounded-lg border border-border-subtle bg-surface-elevated/40 font-mono text-[10px] space-y-1.5 text-text-muted">
                <div className="flex items-start gap-1.5">
                  <span className="text-accent-gold font-bold">⚡ Parallel:</span>
                  <span>Agent menjawab <span className="text-text-main font-semibold">bersamaan & independen</span> (cepat, multi-sudut pandang murni).</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="text-data-profit font-bold">🌀 Sequential:</span>
                  <span>Agent menjawab <span className="text-text-main font-semibold">berantai/estafet</span> (saling mengoreksi, analisis lebih tajam & mendalam).</span>
                </div>
              </div>
            </div>

            {/* Loading Indicator */}
            {loading && (
              <div className="p-4 rounded-lg border border-border-subtle bg-card/20 text-center font-mono text-xs text-accent-gold animate-pulse">
                Agents sedang berdiskusi & menyusun konsensus...
              </div>
            )}

            {/* Individual Agent Replies */}
            {hawkReply && (
              <AgentReplyCard
                title="Hawk — Quant & Tightening Analysis"
                reply={hawkReply}
                personaId="hawk"
              />
            )}

            {doveReply && (
              <AgentReplyCard
                title="Dove — Strategy & Accommodative View"
                reply={doveReply}
                personaId="dove"
              />
            )}

            {contrarianReply && (
              <AgentReplyCard
                title="Contrarian — Maverick Anomaly Analysis"
                reply={contrarianReply}
                personaId="contrarian"
              />
            )}

            {consensus && <ConsensusResult consensus={consensus} />}
          </>
        )}
      </div>
    </div>
  );
}