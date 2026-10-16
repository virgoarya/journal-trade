"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, User, ChevronDown, Zap, Brain, History, Check, RefreshCw, Copy } from "lucide-react";
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
  "Apa yang merusak rezim ini?",
  "Apa yang memaksa Fed pivot?",
  "Di mana likuiditas bocor?",
  "Aset apa paling rentan jika VIX > 20?",
];


// ── Memory Context Badge ──────────────────────────────────────
interface MemoryContextBadgeProps {
  tokenCount: number;
  maxTokens: number;
  factsCount?: number; // jumlah memory notes dari database (opsional)
}

function MemoryContextBadge({ tokenCount, maxTokens, factsCount }: MemoryContextBadgeProps) {
  // Kalau ada factsCount, tampilkan jumlah fakta yang di-inject
  if (factsCount !== undefined && factsCount > 0) {
    return (
      <div
        className="flex items-center gap-1.5 px-1.5 py-1 rounded border border-border-subtle bg-bg-elevated"
        title={`Memori aktif — ${factsCount} fakta di-inject ke konteks`}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-data-profit" />
        <span className="text-[9px] font-mono text-text-muted">
          <span className="text-data-profit font-bold">{factsCount}</span> fakta
        </span>
      </div>
    );
  }

  // Fallback: estimasi pemakaian konteks dari panjang pesan
  const percentage = Math.min(100, (tokenCount / maxTokens) * 100);
  const isNearLimit = percentage > 80;
  const tone = isNearLimit ? "text-data-loss" : percentage > 50 ? "text-accent-gold" : "text-data-profit";

  return (
    <div
      className="flex items-center gap-1.5 px-1.5 py-1 rounded border border-border-subtle bg-bg-elevated"
      title={`Konteks terpakai ${tokenCount}/${maxTokens} token (${percentage.toFixed(0)}%)`}
    >
      <History className="w-3 h-3 text-text-muted shrink-0" />
      <span className={`text-[9px] font-mono ${tone}`}>{percentage.toFixed(0)}%</span>
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

// ── Copy to Clipboard ───────────────────────────────────────────
// Dipakai oleh bubble asisten: tombol copy muncul saat hover.

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
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(null);
  const [thinkingState, setThinkingState] = useState<ThinkingState>("idle");
  const [toolExecutions, setToolExecutions] = useState<ToolExecution[]>([]);
  // Jumlah memory notes dari database (diisi nanti dari API profile)
  const [memoryFactsCount, setMemoryFactsCount] = useState<number>(0);
  const [showReasoning, setShowReasoning] = useState(false);
  const [reasoningText, setReasoningText] = useState<string>("");
  // Indeks langkah thinking yang sedang aktif (untuk dropdown Urutan Berpikir)
  const [thinkingStepIndex, setThinkingStepIndex] = useState<number>(0);
  // Dropdown open state (Agent & Urutan Berpikir)
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);
  const [thinkingMenuOpen, setThinkingMenuOpen] = useState(false);
  // Nama user — diisi dari API profile (fallback: "User")
  const [userName, setUserName] = useState<string>("User");
  const [userPersona, setUserPersona] = useState<string>("hawk");
  const [userDisplayName, setUserDisplayName] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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

  const resizeComposer = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  };

  useEffect(() => {
    resizeComposer();
  }, [input]);

  const copyAssistantMessage = async (content: string, idx: number) => {
    if (!content.trim()) return;
    try {
      await navigator.clipboard.writeText(content.trim());
      setCopiedMessageIndex(idx);
      window.setTimeout(() => {
        setCopiedMessageIndex((current) => (current === idx ? null : current));
      }, 1500);
    } catch {
      setCopiedMessageIndex(null);
    }
  };

  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    e.currentTarget.form?.requestSubmit();
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

      // Populate toolExecutions dari toolsUsed supaya muncul di dropdown Urutan Berpikir
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

    // SESI BARU — reset riwayat chat saja.
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

    const hasUserMessage = messages.some((m) => m.role === "user");
    const contextChips: { label: string; value: string }[] = [
      { label: "REZIM", value: currentRegime ?? "—" },
      { label: "LIKUIDITAS", value: liquidity?.status ?? "—" },
      { label: "VIX", value: vix.value === null ? "—" : `${vix.value.toFixed(1)} ${vix.regime}` },
      { label: "KURVA", value: yieldCurve.inverted ? "INVERTED" : yieldCurve.curveRegime },
      { label: "GEO", value: geoRisk.topDriver },
      { label: "AGENDA", value: nextEvent ? `${nextEvent.country} · ${nextEvent.impact}` : "—" },
    ];

    return (
      <div
        className="flex flex-col h-full w-full glass overflow-hidden relative transition-colors duration-300"
        style={{ borderColor: activePersona.color + "35" }}
      >
        {/* ── Header padat — satu baris ─────────────────────── */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle shrink-0 bg-bg-elevated/50">
          {/* Identitas agent + user */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0"
              style={{ backgroundColor: activePersona.color }}
            />
            <span
              className="text-[11px] font-mono font-bold truncate"
              style={{ color: activePersona.color }}
            >
              {activePersona.emoji} {activePersona.label.split(" · ")[0]}
            </span>
            <span className="text-[10px] font-mono text-text-muted truncate hidden md:inline">
              · {userName}
            </span>
          </div>

          {/* Kontrol */}
          <div className="flex items-center gap-1.5 ml-auto shrink-0">
            {/* Badge memori */}
            <MemoryContextBadge
              tokenCount={Math.floor(memoryTokenCount)}
              maxTokens={MEMORY_MAX_TOKENS}
              factsCount={memoryFactsCount}
            />

            {/* Toggle penalaran */}
            <button
              type="button"
              onClick={() => setShowReasoning(!showReasoning)}
              disabled={isThinking}
              title="Penalaran — proses berpikir agent"
              aria-expanded={showReasoning}
              className={`p-1.5 rounded border transition-colors disabled:opacity-40 ${
                showReasoning
                  ? "border-accent-gold/40 text-accent-gold bg-accent-gold/10"
                  : "border-border-subtle text-text-muted hover:text-text-primary"
              }`}
            >
              <Brain className={`w-3.5 h-3.5 ${isThinking ? "animate-pulse text-data-profit" : isAnalyzing ? "animate-pulse" : ""}`} />
            </button>

            {/* Sesi baru */}
            <button
              type="button"
              onClick={handleNewSession}
              disabled={isThinking}
              title="Sesi baru — riwayat chat direset. Memori jangka panjang tetap tersimpan."
              className="p-1.5 rounded border border-border-subtle text-text-muted hover:text-accent-gold hover:border-accent-gold/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ── Strip konteks ──────────────────────────────── */}
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border-subtle/50 shrink-0 overflow-x-auto scrollbar-hide bg-bg-elevated/30"
          title={briefing}
        >
          {contextChips.map((chip) => (
            <span
              key={chip.label}
              className="shrink-0 text-[9px] font-mono px-1.5 py-0.5 rounded border border-border-subtle/60 text-text-primary whitespace-nowrap"
            >
              <span className="text-text-muted">{chip.label} </span>
              {chip.value}
            </span>
          ))}
        </div>

        {/* ── Area pesan ─────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-border-subtle">
          {/* Saran awal — hilang setelah pesan pertama user */}
          {!hasUserMessage && (
            <div className="flex flex-wrap gap-1.5 pb-1">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => setInput(prompt)}
                  disabled={isThinking}
                  className="text-[9px] font-mono text-text-muted border border-border-subtle rounded px-2 py-1 hover:text-accent-gold hover:border-accent-gold/40 disabled:opacity-40"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`group flex gap-1.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[11px]"
                  style={{ backgroundColor: activePersona.color + "25" }}
                >
                  {activePersona.emoji}
                </div>
              )}
              <div
                className={`relative max-w-[85%] px-3 py-2 rounded-xl text-[11px] font-mono leading-[1.65] ${
                  msg.role === "user"
                    ? "bg-accent-gold/10 border border-accent-gold/30 text-text-primary"
                    : isThinking && idx === messages.length - 1
                      ? "border border-border-subtle text-text-muted italic animate-pulse"
                      : "glass border border-border-subtle text-text-primary"
                }`}
              >
                {msg.role === "assistant" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => copyAssistantMessage(msg.content, idx)}
                      title={copiedMessageIndex === idx ? "Tersalin" : "Salin jawaban"}
                      className="absolute -right-2 -top-2 rounded border border-border-subtle bg-bg-elevated p-1 text-text-muted opacity-0 shadow-lg transition-all hover:text-accent-gold group-hover:opacity-100 focus:opacity-100"
                    >
                      {copiedMessageIndex === idx ? (
                        <Check className="h-3 w-3 text-data-profit" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content ? msg.content.replace(/```[a-z]*\s*$/g, "").replace(/`+\s*$/g, "").trim() : ""}
                    </ReactMarkdown>
                    <ContextTags latency={msg.latency} contextInjected={msg.contextInjected} />
                  </>
                ) : (
                  msg.content
                )}
              </div>
              {msg.role === "user" && (
                <div className="w-5 h-5 rounded-full bg-accent-gold/20 border border-accent-gold/30 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-3 h-3 text-accent-gold" />
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Panel penalaran — hanya dirender saat dibuka ───── */}
        {showReasoning && (
          <div className="border-t border-border-subtle shrink-0 max-h-56 overflow-y-auto px-3 py-2 bg-bg-elevated/30">
            {isAnalyzing ? (
              <div className="flex items-center gap-2 text-accent-gold">
                <div className="w-3 h-3 border border-accent-gold/30 border-t-accent-gold rounded-full animate-spin" />
                <span className="text-xs font-mono">Menganalisis struktur rezim dan dinamika pasar...</span>
              </div>
            ) : reasoningText ? (
              <pre className="text-[11px] font-mono text-text-muted whitespace-pre-wrap break-words">
                {reasoningText}
              </pre>
            ) : (
              <div className="text-[11px] font-mono text-text-muted">
                <p>Belum ada penalaran. Kirim pertanyaan ke agent untuk melihat proses berpikirnya.</p>
                <p className="mt-2">Rezim saat ini: {currentRegime || "UNKNOWN"}</p>
                <p className="mt-1">Likuiditas: {liquidity?.status || "UNKNOWN"}</p>
                <p className="mt-1">VIX: {vix.value ? `${vix.value.toFixed(1)} (${vix.regime})` : "N/A"}</p>
              </div>
            )}
          </div>
        )}

      {/* ── Baris kontrol: Agent & Urutan Berpikir ──────── */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border-subtle/50 shrink-0 bg-bg-elevated/30">
        {/* Dropdown Agent */}
          <div className="relative" ref={agentMenuRef}>
            <button
              type="button"
              onClick={() => { setAgentMenuOpen(!agentMenuOpen); setThinkingMenuOpen(false); }}
              disabled={isThinking}
              title="Ganti agent"
              className="flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-mono transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                color: activePersona.color,
                borderColor: activePersona.color + "55",
                backgroundColor: activePersona.color + "15",
              }}
            >
              <span>{activePersona.emoji}</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${agentMenuOpen ? "rotate-180" : ""}`} />
            </button>

            {agentMenuOpen && (
              <div className="absolute left-0 bottom-full mb-1 z-30 w-64 max-w-[calc(100vw-1.5rem)] bg-bg-elevated border border-border-subtle rounded-lg overflow-hidden shadow-xl">
                {PERSONAS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { handlePersonaSwitch(p.id); setAgentMenuOpen(false); }}
                    className={`w-full flex items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-bg-elevated/70 ${
                      p.id === activePersonaId ? "bg-bg-elevated/50" : ""
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

          {/* Dropdown Urutan Berpikir */}
          <div className="relative" ref={thinkingMenuRef}>
            <button
              type="button"
              onClick={() => { setThinkingMenuOpen(!thinkingMenuOpen); setAgentMenuOpen(false); }}
              title="Urutan berpikir"
              className="flex items-center gap-1 px-2 py-1 rounded border border-border-subtle bg-bg-elevated/50 text-[10px] font-mono text-text-muted hover:text-text-primary transition-all"
            >
              <Brain className={`w-3 h-3 ${isThinking ? "text-accent-gold animate-pulse" : ""}`} />
              <span className="hidden lg:inline">
                {isThinking ? "BERPIKIR…" : `URUTAN${toolExecutions.length > 0 ? ` (${toolExecutions.length})` : ""}`}
              </span>
              <ChevronDown className={`w-3 h-3 transition-transform ${thinkingMenuOpen ? "rotate-180" : ""}`} />
            </button>

            {thinkingMenuOpen && (
              <div className="absolute left-0 bottom-full mb-1 z-30 w-72 max-w-[calc(100vw-1.5rem)] bg-bg-elevated border border-border-subtle rounded-lg overflow-hidden shadow-xl">
                <div className="px-3 py-2 border-b border-border-subtle/50">
                  <span className="text-[9px] font-mono text-text-muted tracking-wider">URUTAN BERPIKIR</span>
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
                      <Zap className="w-2.5 h-2.5 text-accent-gold" />
                      <span className="text-[9px] font-mono text-text-muted tracking-wider">
                        TOOLS DIJALANKAN ({toolExecutions.length})
                      </span>
                    </div>
                    <div className="max-h-40 overflow-y-auto px-2 pb-2">
                      {toolExecutions.map((exec, idx2) => (
                        <div key={idx2} className="flex items-center justify-between gap-2 px-2 py-1">
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
                            {exec.status === "pending" ? "PENDING" : exec.status === "executing" ? "JALAN" : exec.status === "success" ? "✓" : "✗"}
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

        {/* ── Composer ──────────────────────────────────────── */}
        <form
          onSubmit={handleSubmit}
          className="flex items-end gap-2 px-3 py-2.5 border-t border-border-subtle shrink-0"
        >
          <div className="group/composer flex-1 flex items-start gap-2 bg-bg-elevated border border-border-subtle rounded-lg px-3 py-2 focus-within:border-accent-gold/40">
            <Zap className="w-3 h-3 shrink-0 mt-1" style={{ color: activePersona.color }} />
            <div className="flex-1">
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleComposerKeyDown}
                placeholder={`Tanya ${activePersona.emoji} ${activePersona.label.split(" · ")[0]}...`}
                className="max-h-24 min-h-[20px] w-full resize-none bg-transparent text-xs font-mono leading-5 text-text-primary placeholder-text-muted outline-none scrollbar-thin scrollbar-thumb-border-subtle"
                disabled={isThinking}
              />
              <div className="mt-1 hidden text-[9px] font-mono text-text-muted group-focus-within/composer:block">
                Enter kirim · Shift+Enter baris baru
              </div>
            </div>
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isThinking}
            title="Kirim"
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