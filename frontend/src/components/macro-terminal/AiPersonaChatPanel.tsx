"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, Send, User, ChevronDown, Zap, Brain, History, Clock, Copy, Check, RefreshCw } from "lucide-react";
import { useMacroTerminal } from "./MacroTerminalContext";

interface Message {
  role: "user" | "assistant";
  content: string;
  toolsUsed?: string[];
  latency?: number;
  contextInjected?: boolean;
  timestamp?: number;
}

interface ToolExecution {
  tool: string;
  arguments?: Record<string, any>;
  result?: any;
  status: "pending" | "executing" | "success" | "error";
  timestamp: number;
}

type ThinkingState = "idle" | "thinking" | "responding" | "done";

// ── Persona Config ─────────────────────────────────────────────
const PERSONAS = [
  {
    id: "hawk",
    label: "Hawk · The Quant",
    emoji: "🦅",
    color: "#ef4444",
    borderColor: "border-red-500/40",
    bgColor: "bg-red-500/10",
    description: "Hawkish · Fokus inflasi & pengetatan likuiditas",
    greeting:
      "HAWK QUANT DESK ONLINE.\n\nAnalisis berbasis data pengetatan moneter. Sampaikan pertanyaan Anda — saya akan membedah risiko inflasi dan skenario crash likuiditas.",
  },
  {
    id: "dove",
    label: "Dove · The Strategist",
    emoji: "🕊️",
    color: "#22c55e",
    borderColor: "border-green-500/40",
    bgColor: "bg-green-500/10",
    description: "Dovish · Fokus growth & pelonggaran kebijakan",
    greeting:
      "DOVE STRATEGY DESK ONLINE.\n\nSaya mencari peluang di tengah pelonggaran. Tanya saya tentang rotasi aset, pivot Fed, atau skenario bull market berikutnya.",
  },
  {
    id: "contrarian",
    label: "Contrarian · The Maverick",
    emoji: "🎯",
    color: "#a855f7",
    borderColor: "border-purple-500/40",
    bgColor: "bg-purple-500/10",
    description: "Contrarian · Hunting anomalies & crowd reversals",
    greeting:
      "CONTRARIAN DESK ONLINE.\n\nSemua orang salah — setidaknya secara statistik. Tanya saya tentang anomali pasar, bearish traps, atau setup yang diabaikan konsensus.",
  },
] as const;

type PersonaId = (typeof PERSONAS)[number]["id"];

const THINKING_MESSAGES = [
  "Membaca posisi institusional...",
  "Menganalisis konteks makro...",
  "Menyusun perspektif strategis...",
];

const QUICK_PROMPTS = [
  "What breaks this regime?",
  "What would force Fed pivot?",
  "Where is liquidity leaking?",
  "What asset is most vulnerable if VIX > 20?",
];

// ── User Profile Component ────────────────────────────────────
interface UserProfileProps {
  name: string;
  role: string;
  avatar?: string;
}

function UserProfile({ name, role }: UserProfileProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-full bg-accent-gold/20 border border-accent-gold/30 flex items-center justify-center">
        <User className="w-4 h-4 text-accent-gold" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-mono font-bold text-text-primary truncate max-w-[120px]">
          {name}
        </p>
        <p className="text-[9px] text-text-muted font-mono truncate max-w-[120px]">
          {role}
        </p>
      </div>
    </div>
  );
}

// ── Memory Context Badge ──────────────────────────────────────
interface MemoryContextBadgeProps {
  tokenCount: number;
  maxTokens: number;
  factsCount?: number; // jumlah memory notes dari database (opsional)
}

function MemoryContextBadge({ tokenCount, maxTokens, factsCount }: MemoryContextBadgeProps) {
  // Kalau ada factsCount, tampilkan "N Facts Injected"
  if (factsCount !== undefined && factsCount > 0) {
    return (
      <div className="flex items-center gap-2 px-2 py-1 rounded-lg border border-border-subtle bg-surface-elevated">
        <div className="w-2 h-2 rounded-full bg-data-profit" />
        <div className="text-xs font-mono">
          <span className="text-text-muted">Memory: </span>
          <span className="text-data-profit font-bold">Active</span>
          <span className="text-[9px] text-text-muted/60"> ({factsCount} facts)</span>
        </div>
      </div>
    );
  }

  // Fallback: tampilkan token usage (estimasi dari message length)
  const percentage = Math.min(100, (tokenCount / maxTokens) * 100);
  const isNearLimit = percentage > 80;

  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded-lg border border-border-subtle bg-surface-elevated">
      <History className="w-3 h-3 text-text-muted flex-shrink-0" />
      <div className="text-xs font-mono">
        <span className="text-text-muted">Memory: </span>
        <span className={isNearLimit ? "text-data-loss font-bold" : percentage > 50 ? "text-accent-gold" : "text-data-profit"}>
          {tokenCount}/{maxTokens}
        </span>
        <span className="text-[8px] text-text-muted/60"> ({percentage.toFixed(0)}%)</span>
      </div>
      <div className="w-16 h-1 bg-border-subtle/30 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isNearLimit ? "bg-data-loss" : percentage > 50 ? "bg-accent-gold" : "bg-data-profit"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// ── Context Tags Component ─────────────────────────────────────
interface ContextTagProps {
  latency?: number;
  contextInjected?: boolean;
}

function ContextTags({ latency, contextInjected }: ContextTagProps) {
  if (latency === undefined && !contextInjected) return null;
  
  return (
    <div className="flex items-center gap-1.5 mt-1">
      {latency !== undefined && (
        <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-accent-gold/10 text-accent-gold border border-accent-gold/20">
          ⏱ {latency}ms
        </span>
      )}
      {contextInjected && (
        <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
          📚 CONTEXT
        </span>
      )}
    </div>
  );
}

// ── Copy to Clipboard Hook ─────────────────────────────────────
function useCopyToClipboard() {
  const [copied, setCopied] = useState(false);
  
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };
  
  return { copied, copy };
}

export function AiPersonaChatPanel() {
  const {
    currentRegime,
    assets,
    liquidity,
    regimeData,
    vix,
    yieldCurve,
    geoRisk,
    nextEvent,
    isAnalyzing,
  } = useMacroTerminal();

  const [activePersonaId, setActivePersonaId] = useState<PersonaId>("hawk");
  const [allMessages, setAllMessages] = useState<Record<PersonaId, Message[]>>({
    hawk: [],
    dove: [],
    contrarian: [],
  });
  const [input, setInput] = useState("");
  const [thinkingState, setThinkingState] = useState<ThinkingState>("idle");
  const [toolExecutions, setToolExecutions] = useState<ToolExecution[]>([]);
  // Jumlah memory notes dari database (diisi nanti dari API profile)
  const [memoryFactsCount, setMemoryFactsCount] = useState<number>(0);
  const [showReasoning, setShowReasoning] = useState(false);
  const [reasoningText, setReasoningText] = useState<string>("");
  // Indeks langkah thinking yang sedang aktif (untuk dropdown Sequence Thinking)
  const [thinkingStepIndex, setThinkingStepIndex] = useState<number>(0);
  // Dropdown open state (Agent & Sequence Thinking)
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);
  const [thinkingMenuOpen, setThinkingMenuOpen] = useState(false);
  // Nama user — diisi dari API profile (fallback: "User")
  const [userName, setUserName] = useState<string>("User");
  const [userPersona, setUserPersona] = useState<string>("hawk");
  const [userDisplayName, setUserDisplayName] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const thinkingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const thinkingIndexRef = useRef(0);
  const lastSentAtRef = useRef(0);
  // Refs untuk menutup dropdown saat klik di luar
  const agentMenuRef = useRef<HTMLDivElement>(null);
  const thinkingMenuRef = useRef<HTMLDivElement>(null);
  const RATE_LIMIT_MS = 2000;
  const MEMORY_MAX_TOKENS = 16000;

  // ── Fetch user profile dari backend (identitas + jumlah memory facts) ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch("/api/v1/chat/profile", { credentials: "include" });
        if (!resp.ok) return;
        const data = await resp.json();
        if (cancelled) return;
        if (data?.profile?.preferredName) setUserName(data.profile.preferredName);
        if (data?.profile?.displayName) setUserDisplayName(data.profile.displayName);
        if (data?.profile?.agentPersona) setUserPersona(data.profile.agentPersona);
        if (typeof data?.factsCount === "number") setMemoryFactsCount(data.factsCount);
      } catch {
        /* badge tetap pakai default kalau gagal */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Tutup dropdown saat klik di luar / tekan Escape ──
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (agentMenuRef.current && !agentMenuRef.current.contains(t)) setAgentMenuOpen(false);
      if (thinkingMenuRef.current && !thinkingMenuRef.current.contains(t)) setThinkingMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setAgentMenuOpen(false); setThinkingMenuOpen(false); }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const { copied, copy } = useCopyToClipboard();
  const activePersona = PERSONAS.find((p) => p.id === activePersonaId)!;
  const messages = allMessages[activePersonaId];

  // Calculate memory usage based on messages
  const memoryTokenCount = useMemo(() => {
    return messages.reduce((total, msg) => {
      const contentLength = msg.content.length;
      const toolsLength = msg.toolsUsed?.join(" ").length || 0;
      return total + contentLength + toolsLength;
    }, 0) / 2; // Rough estimate: 2 chars ≈ 1 token
  }, [messages]);

  const briefing = useMemo(() => {
    const lines = [
      `Regime: ${currentRegime ?? "UNKNOWN"}`,
      `Liquidity: ${liquidity?.status ?? "UNKNOWN"}`,
      `VIX: ${vix.value === null ? "N/A" : `${vix.value.toFixed(1)} (${vix.regime})`}`,
      `Yield Curve: ${yieldCurve.curveRegime}${yieldCurve.inverted ? " / Inverted" : ""}`,
      `Geo-risk driver: ${geoRisk.topDriver}`,
      nextEvent
        ? `Next event: ${nextEvent.country} ${nextEvent.title} (${nextEvent.impact})`
        : "Next event: none high-impact",
    ];
    return lines.join(" · ");
  }, [currentRegime, liquidity, vix, yieldCurve, geoRisk, nextEvent]);

  // Initialize greeting for each persona
  useEffect(() => {
    setAllMessages((prev) => {
      const updated = { ...prev };
      PERSONAS.forEach((p) => {
        const storedKey = `intelligence_chat_${p.id}`;
        const stored = localStorage.getItem(storedKey);
        if (stored) {
          try {
            updated[p.id] = JSON.parse(stored);
          } catch {
            updated[p.id] = [{ role: "assistant", content: p.greeting }];
          }
        } else {
          updated[p.id] = [{ role: "assistant", content: p.greeting }];
        }
      });
      return updated;
    });
  }, []);

  // Save messages to localStorage on change
  useEffect(() => {
    const storedKey = `intelligence_chat_${activePersonaId}`;
    if (messages.length > 0) {
      localStorage.setItem(storedKey, JSON.stringify(messages));
    }
  }, [messages, activePersonaId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const clearThinking = () => {
    if (thinkingIntervalRef.current) {
      clearInterval(thinkingIntervalRef.current);
      thinkingIntervalRef.current = null;
    }
    thinkingIndexRef.current = 0;
    setThinkingStepIndex(0);
  };

  const startThinking = () => {
    clearThinking();
    setThinkingState("thinking");
    const initial = THINKING_MESSAGES[0];
    setAllMessages((prev) => ({
      ...prev,
      [activePersonaId]: [
        ...prev[activePersonaId],
        { role: "assistant", content: initial },
      ],
    }));
    thinkingIntervalRef.current = setInterval(() => {
      thinkingIndexRef.current =
        (thinkingIndexRef.current + 1) % THINKING_MESSAGES.length;
      setThinkingStepIndex(thinkingIndexRef.current);
      setAllMessages((prev) => {
        const updated = [...prev[activePersonaId]];
        const lastIdx = updated.length - 1;
        if (lastIdx >= 0 && updated[lastIdx].role === "assistant") {
          updated[lastIdx] = {
            role: "assistant",
            content: THINKING_MESSAGES[thinkingIndexRef.current],
          };
        }
        return { ...prev, [activePersonaId]: updated };
      });
    }, 900);
  };

  const finishThinking = (
    reply: string,
    toolsUsed?: string[],
    reasoningFromServer?: string,
    latencyMs?: number,
    contextInjected?: boolean
  ) => {
    clearThinking();
    setThinkingState("done");

    // Parse JSON dari backend (fallback kalau backend kirim raw JSON di reply)
    let reasoning = reasoningFromServer || "";
    let content = reply;
    try {
      const parsed = JSON.parse(reply);
      if (!reasoning && typeof parsed.reasoning === "string") reasoning = parsed.reasoning;
      if (typeof parsed.content === "string") content = parsed.content;
    } catch {
      // Kalau bukan JSON, pakai reply as-is
    }

    setReasoningText(reasoning);

    setAllMessages((prev) => {
      const updated = [...prev[activePersonaId]];
      const lastIdx = updated.length - 1;
      if (lastIdx >= 0 && updated[lastIdx].role === "assistant") {
        updated[lastIdx] = {
          role: "assistant",
          content,
          toolsUsed,
          latency: latencyMs,
          contextInjected,
          timestamp: Date.now(),
        };
      }
      return { ...prev, [activePersonaId]: updated };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = input.trim();
    if (
      !query ||
      thinkingState === "thinking" ||
      thinkingState === "responding"
    )
      return;

    const now = Date.now();
    if (now - lastSentAtRef.current < RATE_LIMIT_MS) return;
    lastSentAtRef.current = now;

    const userMsg: Message = { role: "user", content: query };
    const prevMessages = [...allMessages[activePersonaId], userMsg];

    setAllMessages((prev) => ({ ...prev, [activePersonaId]: prevMessages }));
    setInput("");
    startThinking();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);
      const requestStartedAt = Date.now();

      const resp = await fetch("/api/v1/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: controller.signal,
        body: JSON.stringify({
          messages: prevMessages,
          currentRegime,
          assets,
          liquidityStatus: liquidity?.status,
          personaId: activePersonaId,
          context: {
            vix,
            yieldCurve,
            geoRisk: {
              scores: geoRisk.scores,
              topDriver: geoRisk.topDriver,
            },
            nextEvent,
          },
        }),
      });
      
      clearTimeout(timeoutId);

      if (!resp.ok) {
        let errData;
        try {
          errData = await resp.json();
        } catch(e) {}
        // Handle nested error object (Express auth middleware returns {error: {code, message}})
        let errorMessage = "AI response error";
        if (errData?.error) {
          if (typeof errData.error === "object" && errData.error.message) {
            errorMessage = errData.error.message;
          } else if (typeof errData.error === "string") {
            errorMessage = errData.error;
          }
        } else if (errData?.message) {
          errorMessage = errData.message;
        }
        throw new Error(errorMessage);
      }
      
      const data = await resp.json();
      const latencyMs = Date.now() - requestStartedAt;

      // Populate toolExecutions dari toolsUsed supaya muncul di dropdown Sequence Thinking
      if (Array.isArray(data.toolsUsed) && data.toolsUsed.length > 0) {
        const now = Date.now();
        setToolExecutions(
          data.toolsUsed.map((tool: string) => ({
            tool,
            status: "success" as const,
            timestamp: now,
          }))
        );
      }

      finishThinking(
        data.reply || "AI tidak merespons. Coba lagi.",
        data.toolsUsed,
        data.reasoning,
        latencyMs,
        true // contextInjected — Hermes prompt selalu inject profile + memory
      );
    } catch (err: any) {
      finishThinking(
        `[Error Server]: ${err.message || "Koneksi ke AI Engine gagal."}`
      );
    }
  };

  const handlePersonaSwitch = (id: PersonaId) => {
      if (thinkingState === "thinking" || thinkingState === "responding") return;
      setActivePersonaId(id);
      setThinkingState("idle");
      setToolExecutions([]);
      setShowReasoning(false);
      setReasoningText("");
    };

    // NEW SESSION — reset riwayat chat saja.
    // PENTING: TIDAK menyentuh memory notes di PostgreSQL (fakta jangka panjang tetap utuh).
    const handleNewSession = () => {
      const key = `intelligence_chat_${activePersonaId}`;
      localStorage.removeItem(key);
      setAllMessages((prev) => ({
        ...prev,
        [activePersonaId]: [
          { role: "assistant", content: activePersona.greeting, timestamp: Date.now() },
        ],
      }));
      setToolExecutions([]);
      setShowReasoning(false);
      setReasoningText("");
      setInput("");
      setThinkingState("idle");
      clearThinking();
    };

    const isThinking =
      thinkingState === "thinking" || thinkingState === "responding";

    return (
      <div
        className="flex flex-col h-full w-full glass overflow-hidden relative transition-colors duration-300"
        style={{ borderColor: activePersona.color + "35" }}
      >
        {/* Header - Agent Status Bar & User Profile */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle shrink-0 bg-surface-elevated/50">
          <div className="flex items-center gap-3 min-w-0">
            {/* Agent Status */}
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-surface-elevated/50 border border-border-subtle">
              <div className="w-2 h-2 rounded-full animate-pulse bg-data-profit" />
              <span className="text-[10px] font-mono text-text-primary">
                {activePersona.id.toUpperCase()} ONLINE
              </span>
            </div>

            {/* User Profile Badge — dynamic name */}
            <UserProfile name={userName} role={activePersona.label} />

            {/* Persona Badge (aktif) */}
            <div className="flex items-center gap-1 px-2 py-1 rounded-md border border-border-subtle bg-surface-elevated/50">
              <span style={{ color: activePersona.color }}>{activePersona.emoji}</span>
              <span className="text-[9px] font-mono text-text-muted hidden sm:inline">{activePersona.label}</span>
            </div>

            {/* Memory Context Badge */}
            <MemoryContextBadge tokenCount={Math.floor(memoryTokenCount)} maxTokens={MEMORY_MAX_TOKENS} factsCount={memoryFactsCount} />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleNewSession}
              disabled={isThinking}
              title="Mulai sesi baru — riwayat chat direset. Memory jangka panjang tetap tersimpan."
              className="flex items-center gap-1.5 text-[10px] font-mono text-text-muted hover:text-accent-gold border border-border-subtle hover:border-accent-gold/40 px-2 py-1 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RefreshCw size={11} />
              NEW SESSION
            </button>
          </div>
        </div>

        {/* Briefing Context Banner */}
        <div className="px-4 py-2 border-b border-border-subtle/50 shrink-0 bg-surface-elevated/30">
          <p className="text-[11px] font-mono text-text-muted leading-relaxed">
            <span className="text-text-primary">{briefing}</span>
          </p>
        </div>

        {/* Agent & Sequence Thinking dropdowns */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border-subtle shrink-0">
          {/* ── Dropdown 1: Agent (Hawk / Dove / Contrarian) ── */}
          <div className="relative" ref={agentMenuRef}>
            <button
              type="button"
              onClick={() => { setAgentMenuOpen(!agentMenuOpen); setThinkingMenuOpen(false); }}
              disabled={isThinking}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                color: activePersona.color,
                borderColor: activePersona.color + "55",
                backgroundColor: activePersona.color + "15",
              }}
            >
              <span>{activePersona.emoji}</span>
              <span className="font-bold">{activePersona.label}</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${agentMenuOpen ? "rotate-180" : ""}`} />
            </button>

            {agentMenuOpen && (
              <div className="absolute left-0 top-full mt-1 z-30 w-64 glass border border-border-subtle rounded-lg overflow-hidden shadow-xl">
                {PERSONAS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { handlePersonaSwitch(p.id); setAgentMenuOpen(false); }}
                    className={`w-full flex items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-surface-elevated/70 ${
                      p.id === activePersonaId ? "bg-surface-elevated/50" : ""
                    }`}
                  >
                    <span className="text-base leading-none mt-0.5">{p.emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-mono font-bold" style={{ color: p.color }}>
                        {p.label}
                      </span>
                      <span className="block text-[9px] font-mono text-text-muted mt-0.5">
                        {p.description}
                      </span>
                    </span>
                    {p.id === activePersonaId && (
                      <Check className="w-3 h-3 shrink-0 mt-0.5" style={{ color: p.color }} />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Dropdown 2: Sequence Thinking ── */}
          <div className="relative" ref={thinkingMenuRef}>
            <button
              type="button"
              onClick={() => { setThinkingMenuOpen(!thinkingMenuOpen); setAgentMenuOpen(false); }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border-subtle bg-surface-elevated/50 text-xs font-mono text-text-muted hover:text-text-main transition-all"
            >
              <Brain className={`w-3 h-3 ${isThinking ? "text-accent-gold animate-pulse" : "text-text-muted"}`} />
              <span>
                {isThinking
                  ? THINKING_MESSAGES[thinkingStepIndex]
                  : `Sequence Thinking${toolExecutions.length > 0 ? ` (${toolExecutions.length})` : ""}`}
              </span>
              <ChevronDown className={`w-3 h-3 transition-transform ${thinkingMenuOpen ? "rotate-180" : ""}`} />
            </button>

            {thinkingMenuOpen && (
              <div className="absolute left-0 top-full mt-1 z-30 w-80 glass border border-border-subtle rounded-lg overflow-hidden shadow-xl">
                <div className="px-3 py-2 border-b border-border-subtle/50">
                  <span className="text-[9px] font-mono text-text-muted tracking-wider">THINKING SEQUENCE</span>
                </div>
                <div className="p-2">
                  {THINKING_MESSAGES.map((step, i) => {
                    const isDone = !isThinking && reasoningText.length > 0;
                    const isActive = isThinking && i === thinkingStepIndex;
                    const isPassed = isThinking && i < thinkingStepIndex;
                    return (
                      <div key={step} className="flex items-start gap-2 px-2 py-1.5">
                        <span className="shrink-0 mt-0.5">
                          {isActive ? (
                            <span className="block w-3 h-3 border border-accent-gold/40 border-t-accent-gold rounded-full animate-spin" />
                          ) : isDone || isPassed ? (
                            <Check className="w-3 h-3 text-data-profit" />
                          ) : (
                            <span className="block w-3 h-3 rounded-full border border-border-subtle" />
                          )}
                        </span>
                        <span
                          className={`text-[11px] font-mono ${
                            isActive ? "text-accent-gold" : isDone || isPassed ? "text-text-muted" : "text-text-muted/50"
                          }`}
                        >
                          {step}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {toolExecutions.length > 0 && (
                  <div className="border-t border-border-subtle/50">
                    <div className="px-3 py-2 flex items-center gap-1.5">
                      <Zap className="w-3 h-3 text-accent-gold" />
                      <span className="text-[9px] font-mono text-text-muted tracking-wider">
                        TOOLS EXECUTED ({toolExecutions.length})
                      </span>
                    </div>
                    <div className="max-h-40 overflow-y-auto px-2 pb-2">
                      {toolExecutions.map((exec, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-2 px-2 py-1">
                          <code className="text-[10px] font-mono text-accent-gold truncate">{exec.tool}</code>
                          <span
                            className={`shrink-0 text-[8px] font-mono px-1.5 py-0.5 rounded ${
                              exec.status === "success"
                                ? "bg-data-profit/10 text-data-profit"
                                : exec.status === "error"
                                ? "bg-data-loss/10 text-data-loss"
                                : "bg-accent-gold/10 text-accent-gold"
                            }`}
                          >
                            {exec.status === "pending" ? "PENDING" : exec.status === "executing" ? "RUNNING" : exec.status === "success" ? "✓" : "✗"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Quick Prompts */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border-subtle shrink-0 overflow-x-auto scrollbar-hide">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => setInput(prompt)}
              disabled={isThinking}
              className="text-[9px] font-mono text-text-muted border border-border-subtle rounded px-2 py-1 hover:text-accent-gold hover:border-accent-gold/40 disabled:opacity-40 whitespace-nowrap"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-border-subtle">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-sm"
                  style={{ backgroundColor: activePersona.color + "25" }}
                >
                  {activePersona.emoji}
                </div>
              )}
              <div
                className={`max-w-[80%] px-3 py-2 rounded-xl text-xs font-mono leading-relaxed ${
                  msg.role === "user"
                    ? "bg-accent-gold/10 border border-accent-gold/30 text-text-primary"
                    : isThinking && idx === messages.length - 1
                      ? "border border-border-subtle text-text-muted italic animate-pulse"
                      : "glass border border-border-subtle text-text-main"
                }`}
              >
                {msg.role === "assistant" ? (
                  <>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content ? msg.content.replace(/```[a-z]*\s*$/g, "").replace(/`+\s*$/g, "").trim() : ""}
                    </ReactMarkdown>
                    <ContextTags latency={msg.latency} contextInjected={msg.contextInjected} />
                  
                    {/* Tools Used Section */}
                    {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1 border-t border-border-subtle/30 pt-2">
                        <span className="text-[9px] text-text-muted flex items-center gap-1">
                          <Zap size={10} className="text-accent-gold" />
                          Tools:
                        </span>
                        {msg.toolsUsed.map((t, i) => (
                          <span
                            key={i}
                            className="text-[9px] bg-accent-gold/10 text-accent-gold border border-accent-gold/20 px-1.5 py-0.5 rounded font-bold tracking-wider cursor-pointer hover:bg-accent-gold/20"
                            title="Click to copy"
                            onClick={() => copy(t)}
                          >
                            {t}
                            {copied && t === msg.toolsUsed?.[i] && (
                              <Check className="w-3 h-3 ml-1 text-data-profit" />
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  msg.content
                )}
              </div>
              {msg.role === "user" && (
                <div className="w-6 h-6 rounded-full bg-accent-gold/20 border border-accent-gold/30 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-3 h-3 text-accent-gold" />
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Reasoning Panel — di bawah area chat, tepat di atas input */}
        <div className="border-t border-border-subtle shrink-0">
          <button
            type="button"
            onClick={() => setShowReasoning(!showReasoning)}
            className="w-full flex items-center justify-between px-4 py-2 text-xs font-mono text-text-muted hover:bg-surface-elevated/50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Brain className={`w-3 h-3 ${isAnalyzing ? "text-accent-gold animate-pulse" : "text-accent-gold"}`} />
              REASONING
              {reasoningText && (
                <span className="text-[9px] text-text-muted/60">
                  ({reasoningText.length} chars)
                </span>
              )}
            </span>
            <ChevronDown
              className={`w-3 h-3 transition-transform ${showReasoning ? "rotate-180" : ""}`}
            />
          </button>

          {showReasoning && (
            <div className="px-4 pb-2 max-h-64 overflow-y-auto">
              <div className="bg-surface-elevated/30 border border-border-subtle/30 rounded-lg p-3">
                {isAnalyzing ? (
                  <div className="flex items-center gap-2 text-accent-gold">
                    <div className="w-3 h-3 border border-accent-gold/30 border-t-accent-gold rounded-full animate-spin" />
                    <span className="text-xs font-mono">Analyzing regime structure and market dynamics...</span>
                  </div>
                ) : reasoningText ? (
                  <pre className="text-[11px] font-mono text-text-muted whitespace-pre-wrap break-words">
                    {reasoningText}
                  </pre>
                ) : (
                  <div className="text-[11px] font-mono text-text-muted">
                    <p>Belum ada reasoning. Kirim pertanyaan ke agent untuk melihat proses berpikirnya.</p>
                    <p className="mt-2">Current regime: {currentRegime || "UNKNOWN"}</p>
                    <p className="mt-1">Liquidity: {liquidity?.status || "UNKNOWN"}</p>
                    <p className="mt-1">VIX: {vix.value ? `${vix.value.toFixed(1)} (${vix.regime})` : "N/A"}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 px-4 py-3 border-t border-border-subtle shrink-0"
        >
          <div className="flex-1 flex items-center gap-2 bg-surface-elevated border border-border-subtle rounded-lg px-3 py-2">
            <Zap
              className="w-3 h-3 shrink-0"
              style={{ color: activePersona.color }}
            />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Tanya ${activePersona.emoji} ${activePersona.label.split(" · ")[0]}...`}
              className="flex-1 bg-transparent text-xs font-mono text-text-primary placeholder-text-muted outline-none"
              disabled={isThinking}
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isThinking}
            className="p-2 rounded-lg transition-all disabled:opacity-30"
            style={{
              backgroundColor: activePersona.color + "25",
              color: activePersona.color,
            }}
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    );
  }
