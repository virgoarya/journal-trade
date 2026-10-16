"use client";

import React, { useState, useEffect } from "react";
import { Bot, Send, MessageCircle, Activity, Zap } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useMacroTerminal } from "@/components/macro-terminal/MacroTerminalContext";

const SCENARIO_DESCRIPTIONS = {
  hawk: {
    thesis: "Inflasi tinggi & pengetatan likuiditas mendesak instrumen lindung nilai",
    focus: "Kenaikan yield, penguatan mata uang utama, dan tekanan pada aset berisiko",
    scenario: "Restriksi moneter ketat mempercepat aliran modal ke Safe Haven & Dollar"
  },
  dove: {
    thesis: "Pelonggaran moneter & pemangkasan suku bunga mendorong ekspansi pasar",
    focus: "Suntikan likuiditas, rotasi ke aset komoditas & ekuitas berisiko tinggi",
    scenario: "Peluang rally pada komoditas & saham seiring penurunan real yields"
  },
  contrarian: {
    thesis: "Kondisi pasar overextended / mispricing ekstrem dari konsensus umum",
    focus: "Deteksi anomali harga, pola capitulation, dan potensi mean-reversion",
    scenario: "Eksploitasi jebakan likuiditas dan pembalikan arah tajam saat konsensus salah"
  }
};

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
      <div className="text-xs font-mono text-text-primary leading-relaxed prose prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{cleanReply}</ReactMarkdown>
      </div>
    </div>
  );
}

const AGENT_WEIGHTS = {
  hawk: 35,
  dove: 35,
  contrarian: 30,
} as const;

function ConsensusResult({ consensus }: { consensus: string }) {
  const cleanConsensus = consensus.replace(/```[a-z]*\s*$/g, "").replace(/`+\s*$/g, "").trim();

  // Extract bias and conviction if available in the text
  const biasMatch = cleanConsensus.match(/(?:bias(?:\s+akhir)?|sentimen|stance)\s*:\s*([^.\n]+)/i);
  const biasText = biasMatch ? biasMatch[1].trim() : null;

  return (
    <div className="p-4 rounded-lg border border-accent-gold/40 bg-accent-gold/5 space-y-3 shadow-md">
      {/* Header & Conflict Gauge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-accent-gold/20 pb-2.5">
        <div className="flex items-center gap-2">
          <MessageCircle size={15} className="text-accent-gold" />
          <h4 className="font-mono text-xs font-bold text-accent-gold uppercase tracking-wider">
            Consensus & Action Plan
          </h4>
        </div>
        
        {/* Conflict / Agent Weights Gauge */}
        <div className="flex items-center gap-1.5 font-mono text-[9px] bg-black/40 px-2 py-1 rounded border border-border-subtle/40 self-start sm:self-auto">
          <span className="text-text-muted">Influence:</span>
          <span className="text-red-300 font-bold">🦅 {AGENT_WEIGHTS.hawk}%</span>
          <span className="text-text-muted">|</span>
          <span className="text-emerald-300 font-bold">🕊️ {AGENT_WEIGHTS.dove}%</span>
          <span className="text-text-muted">|</span>
          <span className="text-purple-300 font-bold">🎯 {AGENT_WEIGHTS.contrarian}%</span>
        </div>
      </div>

      {/* Conviction / Bias Pill if detected */}
      {biasText && (
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-text-muted uppercase">Macro Bias:</span>
          <span className="inline-flex items-center px-2 py-0.5 rounded border border-amber-500/50 bg-amber-950/40 text-amber-300 font-mono text-[10px] font-bold shadow-sm">
            ⚡ {biasText}
          </span>
        </div>
      )}

      {/* Consensus Markdown Content */}
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
              ? "text-sky-300 bg-sky-950/40 border-sky-500/40"
              : tagUpper === "IMPLIKASI"
              ? "text-amber-300 bg-amber-950/40 border-amber-500/40"
              : "text-emerald-300 bg-emerald-950/40 border-emerald-500/40";

          return (
            <div key={idx} className="space-y-1 bg-bg-elevated/20 p-2 rounded border border-border-subtle/50">
              <span className={`inline-flex items-center font-mono text-[9px] font-bold px-2 py-0.5 rounded border tracking-wider shadow-sm ${badgeColor}`}>
                {fullHeader}
              </span>
              <p className="text-[11px] font-mono text-slate-200 leading-relaxed pl-1">
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
  const [deepResearchResults, setDeepResearchResults] = useState<any[]>([]);

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
          const insightsArray = Object.values(data.data || {}) as AgentInsight[];
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
      // FIX: Use correct endpoint that supports 'mode' parameter
      const res = await fetch(`${BACKEND_URL}/api/v1/agent-consensus`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          context: { currentRegime, liquidity, assets },
          mode,
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

  const handleDeepResearch = async () => {
    setLoading(true);
    setDeepResearchResults([]);
    setHawkReply("");
    setDoveReply("");
    setContrarianReply("");
    setConsensus("");

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/agent-consensus/deep-research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        const result = await res.json();
        if (result.success && Array.isArray(result.data)) {
          setDeepResearchResults(result.data);
          // Tetap di tab debate, jangan lempar ke dashboard
          setActiveTab("debate");
        }
      }
    } catch (e) {
      console.error("[UI] Deep research error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSingleAgent = async (persona: "hawk" | "dove" | "contrarian") => {
    const prompt = getActivePrompt() || "Berikan analisis makroekonomi singkat untuk kondisi pasar saat ini.";

    setLoading(true);
    try {
      const authHeader = localStorage.getItem("auth_token") || "";
      const res = await fetch(`${BACKEND_URL}/api/v1/agent-consensus/single/${persona}`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authHeader}`
        },
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
      <div className="flex items-center gap-1 bg-bg-elevated/40 rounded-lg p-1 border border-border-subtle shrink-0">
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 font-mono text-xs font-semibold rounded transition-all ${
            activeTab === "dashboard"
              ? "bg-data-profit/10 text-data-profit border border-data-profit/30"
              : "text-text-muted hover:text-text-primary"
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
              : "text-text-muted hover:text-text-primary"
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
            <div className="space-y-1.5 pb-2 pt-1">
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

            {/* Agent Market Stance & Real-time Biases */}
            <div className="space-y-2 pt-2 border-t border-border-subtle">
              <div className="flex items-center justify-between">
                <h4 className="font-mono text-[10px] uppercase tracking-widest text-text-muted flex items-center gap-1.5">
                  <Activity size={11} className="text-accent-gold" />
                  Instant Agent Market Stance & Tactical Bias
                </h4>
                <span className="text-[9px] font-mono text-text-muted">Klik card untuk jalankan kueri mendalam</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                {/* Hawk Tactical Stance Card */}
                <div
                  onClick={() => handleSingleAgent("hawk")}
                  className="p-3 rounded-lg border border-red-500/40 bg-red-950/20 hover:bg-red-900/20 cursor-pointer transition-all space-y-2 group shadow-sm"
                >
                  <div className="flex items-center justify-between border-b border-red-500/30 pb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">🦅</span>
                      <span className="font-mono text-xs font-bold text-red-300 group-hover:underline">Hawk Stance</span>
                    </div>
                    <span className="font-mono text-[9px] font-bold text-red-300 bg-red-500/20 px-2 py-0.5 rounded border border-red-500/40">
                      HAWKISH / TIGHT
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-slate-300 leading-relaxed">
                    <span className="text-red-300 font-bold">Thesis:</span> {SCENARIO_DESCRIPTIONS.hawk.thesis}
                  </p>
                  <p className="text-[11px] font-mono text-slate-300 leading-relaxed">
                    <span className="text-red-300 font-bold">Fokus:</span> {SCENARIO_DESCRIPTIONS.hawk.focus}
                  </p>
                  <p className="text-[10px] font-mono text-slate-400 leading-relaxed">
                    <span className="text-red-400 font-semibold">Scenario:</span> {SCENARIO_DESCRIPTIONS.hawk.scenario}
                  </p>
                  <div className="flex items-center justify-between text-[10px] font-mono pt-2 border-t border-red-500/20">
                    <span className="text-slate-400">Liquidity drain via QT</span>
                                        <span className="text-accent-gold font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5 bg-white/5 hover:bg-accent-gold/20 px-2 py-0.5 rounded transition-colors">Jalankan &rarr;</span>
                  </div>
                </div>

                {/* Dove Tactical Stance Card */}
                <div
                  onClick={() => handleSingleAgent("dove")}
                  className="p-3 rounded-lg border border-emerald-500/40 bg-emerald-950/20 hover:bg-emerald-900/20 cursor-pointer transition-all space-y-2 group shadow-sm"
                >
                  <div className="flex items-center justify-between border-b border-emerald-500/30 pb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">🕊️</span>
                      <span className="font-mono text-xs font-bold text-emerald-300 group-hover:underline">Dove Stance</span>
                    </div>
                    <span className="font-mono text-[9px] font-bold text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/40">
                      DOVISH / EASING
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-slate-300 leading-relaxed">
                    <span className="text-emerald-300 font-bold">Thesis:</span> {SCENARIO_DESCRIPTIONS.dove.thesis}
                  </p>
                  <p className="text-[11px] font-mono text-slate-300 leading-relaxed">
                    <span className="text-emerald-300 font-bold">Fokus:</span> {SCENARIO_DESCRIPTIONS.dove.focus}
                  </p>
                  <p className="text-[10px] font-mono text-slate-400 leading-relaxed">
                    <span className="text-emerald-400 font-semibold">Scenario:</span> {SCENARIO_DESCRIPTIONS.dove.scenario}
                  </p>
                  <div className="flex items-center justify-between text-[10px] font-mono pt-2 border-t border-emerald-500/20">
                    <span className="text-slate-400">Rotasi cyclically / commodities</span>
                                        <span className="text-accent-gold font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5 bg-white/5 hover:bg-accent-gold/20 px-2 py-0.5 rounded transition-colors">Jalankan &rarr;</span>
                  </div>
                </div>

                {/* Contrarian Tactical Stance Card */}
                <div
                  onClick={() => handleSingleAgent("contrarian")}
                  className="p-3 rounded-lg border border-purple-500/40 bg-purple-950/20 hover:bg-purple-900/20 cursor-pointer transition-all space-y-2 group shadow-sm"
                >
                  <div className="flex items-center justify-between border-b border-purple-500/30 pb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">🎯</span>
                      <span className="font-mono text-xs font-bold text-purple-300 group-hover:underline">Contrarian Stance</span>
                    </div>
                    <span className="font-mono text-[9px] font-bold text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded border border-purple-500/40">
                      MAVERICK / ANOMALY
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-slate-300 leading-relaxed">
                    <span className="text-purple-300 font-bold">Thesis:</span> {SCENARIO_DESCRIPTIONS.contrarian.thesis}
                  </p>
                  <p className="text-[11px] font-mono text-slate-300 leading-relaxed">
                    <span className="text-purple-300 font-bold">Fokus:</span> {SCENARIO_DESCRIPTIONS.contrarian.focus}
                  </p>
                  <p className="text-[10px] font-mono text-slate-400 leading-relaxed">
                    <span className="text-purple-400 font-semibold">Scenario:</span> {SCENARIO_DESCRIPTIONS.contrarian.scenario}
                  </p>
                  <div className="flex items-center justify-between text-[10px] font-mono pt-2 border-t border-purple-500/20">
                    <span className="text-slate-400">Fade consensus & liquidation</span>
                                        <span className="text-accent-gold font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5 bg-white/5 hover:bg-accent-gold/20 px-2 py-0.5 rounded transition-colors">Jalankan &rarr;</span>
                  </div>
                </div>
              </div>

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
            {/* Debate Setup Controls / Institutional AI War Room */}
            <div className="space-y-3 p-3.5 rounded-lg border border-border-subtle bg-card/30">
              
              {/* 1. Active Agents in War Room */}
              <div>
                <label className="font-mono text-[10px] uppercase tracking-widest text-text-muted flex items-center gap-1 mb-2">
                  <Bot size={11} className="text-accent-gold" />
                  Active Agents in War Room
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2 rounded border border-red-500/30 bg-red-950/25 flex items-center gap-2">
                    <span className="text-sm">🦅</span>
                    <div className="min-w-0">
                      <div className="font-mono text-[11px] font-bold text-red-300">Hawk Agent</div>
                      <div className="font-mono text-[9px] text-slate-400 truncate">Macro / Rates / QT</div>
                    </div>
                  </div>
                  <div className="p-2 rounded border border-emerald-500/30 bg-emerald-950/25 flex items-center gap-2">
                    <span className="text-sm">🕊️</span>
                    <div className="min-w-0">
                      <div className="font-mono text-[11px] font-bold text-emerald-300">Dove Agent</div>
                      <div className="font-mono text-[9px] text-slate-400 truncate">Liquidity / Easing</div>
                    </div>
                  </div>
                  <div className="p-2 rounded border border-purple-500/30 bg-purple-950/25 flex items-center gap-2">
                    <span className="text-sm">🎯</span>
                    <div className="min-w-0">
                      <div className="font-mono text-[11px] font-bold text-purple-300">Contrarian</div>
                      <div className="font-mono text-[9px] text-slate-400 truncate">Anomaly / Sizing</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Quick Scenarios with Sub-labels */}
              <div>
                <label className="font-mono text-[10px] uppercase tracking-wider text-text-muted block mb-1.5">
                  Debate Scenarios & Quick Topics
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {DEBATE_QUICK_PROMPTS.map((qp, idx) => {
                    const subLabels = [
                      "USD Liquidity vs Geo-Risk",
                      "Hawkish Pause vs Recession",
                      "Yield Corridor & Gold Flow"
                    ];
                    return (
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
                        className={`p-2 text-left font-mono rounded border transition-all ${
                          selectedPrompt === qp.prompt
                            ? "border-accent-gold bg-accent-gold/15 text-accent-gold"
                            : "border-border-subtle bg-surface-elev_tertiary/40 text-text-muted hover:text-text-primary hover:bg-bg-elevated"
                        }`}
                      >
                        <div className="text-[11px] font-bold">{qp.label}</div>
                        <div className="text-[9px] opacity-75 truncate mt-0.5">{subLabels[idx] || "Macro Analysis"}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Custom Input Textarea */}
              <div>
                <label className="font-mono text-[10px] uppercase tracking-wider text-text-muted block mb-1">
                  Custom Query / War Room Topic
                </label>
                <textarea
                  value={inputPrompt}
                  onChange={(e) => {
                    setInputPrompt(e.target.value);
                    if (selectedPrompt) setSelectedPrompt(null);
                  }}
                  placeholder="Masukkan topik, instrumen, atau dilema makro untuk didebatkan agen..."
                  className="w-full p-2.5 rounded border border-border-subtle bg-bg-elevated/50 font-mono text-xs text-text-primary focus:outline-none focus:border-accent-gold/50 resize-none shadow-inner"
                  rows={2}
                />
              </div>

              {/* 4. Segmented Action Modes & Execute */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                <button
                  onClick={() => handleDebate("parallel")}
                  disabled={loading || (!inputPrompt.trim() && !selectedPrompt)}
                  className="py-2.5 px-3 rounded bg-accent-gold/15 border border-accent-gold/30 font-mono text-xs font-bold text-accent-gold hover:bg-accent-gold/25 transition-all disabled:opacity-40 flex flex-col items-center justify-center gap-0.5 group shadow-sm"
                >
                  <div className="flex items-center gap-1">
                    <Send size={12} />
                    <span>Parallel Debate</span>
                  </div>
                  <span className="text-[8px] opacity-75 font-normal">Jawab bersamaan & independen</span>
                </button>
                <button
                  onClick={() => handleDebate("sequential")}
                  disabled={loading || (!inputPrompt.trim() && !selectedPrompt)}
                  className="py-2.5 px-3 rounded bg-data-profit/15 border border-data-profit/30 font-mono text-xs font-bold text-data-profit hover:bg-data-profit/25 transition-all disabled:opacity-40 flex flex-col items-center justify-center gap-0.5 group shadow-sm"
                >
                  <div className="flex items-center gap-1">
                    <Bot size={12} />
                    <span>Sequential Chain</span>
                  </div>
                  <span className="text-[8px] opacity-75 font-normal">Estafet & saling koreksi</span>
                </button>
                <button
                  onClick={handleDeepResearch}
                  disabled={loading}
                  className="py-2.5 px-3 rounded bg-purple-500/15 border border-purple-500/30 font-mono text-xs font-bold text-purple-400 hover:bg-purple-500/25 transition-all disabled:opacity-40 flex flex-col items-center justify-center gap-0.5 group shadow-sm"
                >
                  <div className="flex items-center gap-1">
                    <Activity size={12} />
                    <span>Deep Research</span>
                  </div>
                  <span className="text-[8px] opacity-75 font-normal">Multi-step web & data</span>
                </button>
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

            {/* Deep Research Results */}
            {deepResearchResults.length > 0 && (
              <div className="space-y-4">
                <div className="p-2 rounded bg-purple-500/10 border border-purple-500/20 text-purple-300 font-mono text-[10px] flex items-center justify-between">
                  <span>Deep Research & Self-Improvement Cycle Complete</span>
                  <span className="text-[9px] text-text-muted">Data Overview + Post-Hoc Analysis</span>
                </div>
                {deepResearchResults.map((res, idx) => (
                  <div key={idx} className="p-3 rounded border border-border-subtle bg-card/60 space-y-2">
                    <div className="flex items-center justify-between border-b border-border-subtle pb-1">
                      <span className="font-mono text-xs font-bold text-accent-gold uppercase">{res.personaId} Deep Research</span>
                      <span className={`font-mono text-[10px] font-bold ${res.conviction === 'TINGGI' ? 'text-red-400' : 'text-yellow-400'}`}>
                        Conviction: {res.conviction}
                      </span>
                    </div>
                    <div className="space-y-2 text-xs font-mono text-text-muted">
                      <div>
                        <span className="text-text-primary font-bold block mb-0.5">1. Post-Hoc Analysis (Self-Improvement):</span>
                        <p className="bg-bg-elevated/40 p-2 rounded text-[11px] leading-relaxed">{res.selfImprovement}</p>
                      </div>
                      <div>
                        <span className="text-text-primary font-bold block mb-0.5">2. Critical Synthesis:</span>
                        <p className="bg-bg-elevated/40 p-2 rounded text-[11px] leading-relaxed">{res.marketComparison}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}