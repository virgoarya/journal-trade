"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, Send, User, ChevronDown, Zap } from "lucide-react";
import { useMacroTerminal } from "./MacroTerminalContext";

interface Message {
  role: "user" | "assistant";
  content: string;
  toolsUsed?: string[];
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

function PersonaBadge({
  persona,
  selected,
  onClick,
}: {
  persona: (typeof PERSONAS)[number];
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all ${
        selected
          ? `${persona.borderColor} ${persona.bgColor} font-bold`
          : "border-border-subtle text-text-muted hover:border-border-subtle/80 hover:text-text-main"
      }`}
      style={selected ? { color: persona.color } : {}}
    >
      <span>{persona.emoji}</span>
      <span className="hidden sm:inline">{persona.label}</span>
      <span className="sm:hidden">{persona.emoji}</span>
    </button>
  );
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
  } = useMacroTerminal();

  const [activePersonaId, setActivePersonaId] = useState<PersonaId>("hawk");
  const [allMessages, setAllMessages] = useState<Record<PersonaId, Message[]>>({
    hawk: [],
    dove: [],
    contrarian: [],
  });
  const [input, setInput] = useState("");
  const [thinkingState, setThinkingState] = useState<ThinkingState>("idle");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const thinkingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const thinkingIndexRef = useRef(0);
  const lastSentAtRef = useRef(0);
  const RATE_LIMIT_MS = 2000;

  const activePersona = PERSONAS.find((p) => p.id === activePersonaId)!;
  const messages = allMessages[activePersonaId];

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

  const finishThinking = (reply: string, toolsUsed?: string[]) => {
    clearThinking();
    setThinkingState("done");
    setAllMessages((prev) => {
      const updated = [...prev[activePersonaId]];
      const lastIdx = updated.length - 1;
      if (lastIdx >= 0 && updated[lastIdx].role === "assistant") {
        updated[lastIdx] = { role: "assistant", content: reply, toolsUsed };
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

      const resp = await fetch("/api/v1/macro-ai/chat", {
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
        throw new Error(errData?.error || "AI response error");
      }
      
      const data = await resp.json();
      finishThinking(data.reply || "AI tidak merespons. Coba lagi.", data.toolsUsed);
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
  };

  const handleClearChat = () => {
    const key = `intelligence_chat_${activePersonaId}`;
    localStorage.removeItem(key);
    setAllMessages((prev) => ({
      ...prev,
      [activePersonaId]: [
        { role: "assistant", content: activePersona.greeting },
      ],
    }));
  };

  const isThinking =
    thinkingState === "thinking" || thinkingState === "responding";

  return (
    <div
      className="flex flex-col h-full w-full glass overflow-hidden relative transition-colors duration-300"
      style={{ borderColor: activePersona.color + "35" }}
    >
      {/* Header with Persona selector */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl">{activePersona.emoji}</span>
          <div className="min-w-0">
            <p className="text-xs font-mono font-bold text-text-primary tracking-wider truncate max-w-[360px]">
              {activePersona.label}
            </p>
            <p className="text-[10px] text-text-muted font-mono truncate max-w-[360px]">
              {activePersona.description}
            </p>
            <p className="text-[9px] text-text-muted font-mono mt-1 max-w-[420px] truncate">
              {briefing}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleClearChat}
            className="text-[10px] font-mono text-text-muted hover:text-text-main border border-border-subtle hover:border-border-subtle/80 px-2 py-1 rounded transition-colors"
          >
            CLEAR
          </button>
        </div>
      </div>

      {/* Persona switcher row */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border-subtle shrink-0 overflow-x-auto scrollbar-hide">
        {PERSONAS.map((p) => (
          <PersonaBadge
            key={p.id}
            persona={p}
            selected={p.id === activePersonaId}
            onClick={() => handlePersonaSwitch(p.id)}
          />
        ))}
      </div>

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
                    {msg.content}
                  </ReactMarkdown>
                  {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1 border-t border-border-subtle pt-2">
                      <span className="text-[9px] text-text-muted flex items-center gap-1">
                        <Zap size={10} className="text-accent-gold" />
                        Tools dipanggil:
                      </span>
                      {msg.toolsUsed.map((t, i) => (
                        <span key={i} className="text-[9px] bg-accent-gold/10 text-accent-gold border border-accent-gold/20 px-1.5 py-0.5 rounded font-bold tracking-wider">
                          {t}
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
