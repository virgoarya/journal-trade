"use client";

import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Bot,
  Send,
  User,
  Sparkles,
  ChevronRight,
  TrendingUp,
  BrainCircuit,
  Award
} from "lucide-react";
import { type AIReview } from "@/services/ai-review.service";

interface Message {
  role: "user" | "assistant";
  content: string;
}

type ThinkingState = "idle" | "thinking" | "responding" | "done";

const THINKING_MESSAGES = [
  "Menganalisis jurnal trading Anda...",
  "Mengevaluasi emosi saat entry/exit...",
  "Menilai kepatuhan aturan playbook...",
];

interface AiCoachChatPanelProps {
  selectedReview: AIReview | null;
}

export function AiCoachChatPanel({ selectedReview }: AiCoachChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinkingState, setThinkingState] = useState<ThinkingState>("idle");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const thinkingIndexRef = useRef<number>(0);
  const thinkingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize chat history with a contextual greeting based on the selected review
  useEffect(() => {
    if (selectedReview) {
      setMessages([
        {
          role: "assistant",
          content: `Halo! Saya adalah **AI Trading Coach** pribadi Anda.

Saya telah menganalisis review untuk trade **${selectedReview.pair}** Anda (Skor: **${selectedReview.overallScore}/10**).

Bagaimana saya bisa membantu Anda hari ini? Anda bisa menanyakan:
- *Apakah saya disiplin dengan stop loss pada trade ini?*
- *Bagaimana evaluasi kondisi emosi saya?*
- *Berikan rekomendasi konkret untuk memperbaiki performa saya.*`,
        },
      ]);
    } else {
      setMessages([
        {
          role: "assistant",
          content: `Halo! Saya adalah **AI Trading Coach** pribadi Anda.

Saya siap membantu Anda menganalisis jurnal trade, mendeteksi pola emosi (FOMO/Overtrading), mengevaluasi kepatuhan playbook, dan memberikan rencana aksi personal untuk meningkatkan performa trading Anda.

Silakan tanyakan apa saja seputar jurnal dan statistik Anda!`,
        },
      ]);
    }
  }, [selectedReview]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, thinkingState]);

  const clearThinking = () => {
    if (thinkingIntervalRef.current) {
      clearInterval(thinkingIntervalRef.current);
      thinkingIntervalRef.current = null;
    }
    thinkingIndexRef.current = 0;
  };

  const startThinking = () => {
    clearThinking();
    thinkingIndexRef.current = 0;
    setThinkingState("thinking");

    const initial = THINKING_MESSAGES[0];
    setMessages((prev) => [...prev, { role: "assistant", content: initial }]);

    thinkingIntervalRef.current = setInterval(() => {
      thinkingIndexRef.current =
        (thinkingIndexRef.current + 1) % THINKING_MESSAGES.length;
      setMessages((prev) => {
        const updated = [...prev];
        const lastIndex = updated.length - 1;
        if (lastIndex >= 0 && updated[lastIndex].role === "assistant") {
          updated[lastIndex] = {
            ...updated[lastIndex],
            content: THINKING_MESSAGES[thinkingIndexRef.current],
          };
        }
        return updated;
      });
    }, 800);
  };

  const stopThinking = () => {
    clearThinking();
    setThinkingState("idle");
  };

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || thinkingState === "thinking") return;

    const userMessage: Message = { role: "user", content: textToSend };
    const history = [...messages.filter(m => !THINKING_MESSAGES.includes(m.content))];
    const newMessages = [...messages, userMessage];

    setMessages(newMessages);
    setInput("");
    startThinking();

    try {
      const response = await fetch("/api/v1/ai-coach/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message: textToSend,
          history: history,
        }),
      });

      stopThinking();

      if (!response.ok) {
        let errText = "Failed to connect to AI Coach";
        try {
          const errData = await response.json();
          errText = errData.error?.message || errData.message || errText;
        } catch (e) {}
        throw new Error(errText);
      }

      const data = await response.json();

      setThinkingState("responding");

      setMessages((prev) => [
        ...prev.slice(0, -1), // Remove the thinking message placeholder
        { role: "assistant", content: data.data?.reply || data.reply || "AI Coach tidak merespons. Coba lagi." },
      ]);
    } catch (error: any) {
      stopThinking();
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          role: "assistant",
          content: `[KONEKSI GAGAL]: ${error.message || "Gagal menghubungi AI Coach."}`,
        },
      ]);
    } finally {
      setThinkingState("idle");
    }
  };

  const handleQuickPrompt = (promptText: string) => {
    handleSend(promptText);
  };

  const quickPrompts = selectedReview
    ? [
        { icon: <BrainCircuit className="w-3.5 h-3.5" />, text: `Evaluasi kondisi emosi saya di trade ${selectedReview.pair}` },
        { icon: <TrendingUp className="w-3.5 h-3.5" />, text: "Apakah saya disiplin dengan stop loss?" },
        { icon: <Award className="w-3.5 h-3.5" />, text: "Berikan 3 rekomendasi performa" }
      ]
    : [
        { icon: <BrainCircuit className="w-3.5 h-3.5" />, text: "Analisis kebiasaan emosi dominan saya" },
        { icon: <TrendingUp className="w-3.5 h-3.5" />, text: "Evaluasi trade terakhir di jurnal" },
        { icon: <Award className="w-3.5 h-3.5" />, text: "Bagaimana cara menaikkan Win Rate saya?" }
      ];

  return (
    <div className="flex flex-col h-full glass border border-border-subtle rounded-2xl overflow-hidden min-h-[500px]">
      {/* Panel Header */}
      <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between bg-bg-elevated/45">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-accent-gold/15 rounded-lg">
            <Bot className="w-4 h-4 text-accent-gold" />
          </div>
          <div>
            <h3 className="font-semibold text-text-primary text-sm uppercase tracking-wider">AI Trading Coach</h3>
            <p className="text-[10px] text-text-secondary">Personal Performance Analyst</p>
          </div>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-data-profit animate-pulse"></span>
          <span className="text-[10px] uppercase tracking-wider font-semibold text-data-profit">Active</span>
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 custom-scrollbar text-sm">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex items-start space-x-3 max-w-[85%] ${
              msg.role === "user" ? "ml-auto flex-row-reverse space-x-reverse" : "mr-auto"
            }`}
          >
            {/* Avatar */}
            <div
              className={`p-1.5 rounded-lg shrink-0 ${
                msg.role === "user"
                  ? "bg-bg-elevated border border-border-subtle text-text-secondary"
                  : "bg-accent-gold/10 border border-accent-gold/20 text-accent-gold"
              }`}
            >
              {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            {/* Bubble Content */}
            <div
              className={`p-3.5 rounded-2xl border ${
                msg.role === "user"
                  ? "bg-bg-elevated/80 border-border-subtle text-text-primary rounded-tr-none"
                  : "bg-bg-base/40 border-border-subtle/40 text-text-primary rounded-tl-none"
              } leading-relaxed`}
            >
              <div className="prose prose-invert max-w-none text-xs md:text-sm prose-p:my-1 prose-ul:my-1 prose-li:my-0.5">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.content}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        {thinkingState === "thinking" && (
          <div className="flex items-center space-x-2 text-xs text-accent-gold ml-11">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-gold animate-bounce"></span>
            <span className="w-1.5 h-1.5 rounded-full bg-accent-gold animate-bounce delay-100"></span>
            <span className="w-1.5 h-1.5 rounded-full bg-accent-gold animate-bounce delay-200"></span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompt Suggestions */}
      {messages.length === 1 && thinkingState === "idle" && (
        <div className="px-4 py-2 border-t border-border-subtle/30 bg-bg-base/20 space-y-1.5">
          <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest flex items-center space-x-1">
            <Sparkles className="w-3 h-3 text-accent-gold" />
            <span>Saran Konsultasi:</span>
          </p>
          <div className="flex flex-wrap gap-2 pb-1">
            {quickPrompts.map((qp, i) => (
              <button
                key={i}
                onClick={() => handleQuickPrompt(qp.text)}
                className="text-[11px] px-2.5 py-1.5 rounded-lg border border-border-subtle bg-bg-elevated/30 hover:bg-accent-gold/10 hover:border-accent-gold/30 hover:text-accent-gold transition-all text-text-primary text-left flex items-center space-x-1.5 cursor-pointer max-w-full truncate"
              >
                {qp.icon}
                <span className="truncate">{qp.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Form */}
      <div className="p-3 border-t border-border-subtle bg-bg-elevated/20">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
          className="flex items-center space-x-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={thinkingState === "thinking"}
            placeholder={
              selectedReview
                ? "Tanyakan seputar review trade ini..."
                : "Tanyakan performa jurnal trading Anda..."
            }
            className="flex-1 bg-bg-base border border-border-subtle rounded-xl px-3.5 py-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-gold focus:ring-1 focus:ring-accent-gold/20 disabled:opacity-40 placeholder:text-text-muted"
          />
          <button
            type="submit"
            disabled={!input.trim() || thinkingState === "thinking"}
            className="p-2.5 bg-accent-gold text-bg-base font-bold rounded-xl hover:bg-accent-gold-hover transition-all disabled:opacity-30 disabled:hover:bg-accent-gold flex items-center justify-center cursor-pointer active:scale-95"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
