"use client";

import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Bot,
  Send,
  User,
  ChevronRight,
  Terminal as TerminalIcon,
} from "lucide-react";
import { useMacroTerminal } from "./MacroTerminalContext";

interface Message {
  role: "user" | "assistant";
  content: string;
}

type ThinkingState = "idle" | "thinking" | "responding" | "done";

const THINKING_MESSAGES = [
  "Hunter sedang membaca pasar...",
  "Menganalisis sentimen makro...",
  "Menghubungkan data likuiditas...",
];

export function TerminalChatPanel() {
  const { currentRegime, assets, liquidity, systemAlert, clearSystemAlert } =
    useMacroTerminal();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [debouncedInput, setDebouncedInput] = useState("");
  const [thinkingState, setThinkingState] = useState<ThinkingState>("idle");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const lastSentAtRef = useRef<number>(0);
  const RATE_LIMIT_MS = 2000;
  const thinkingIndexRef = useRef<number>(0);
  const thinkingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

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
    }, 700);
  };

  const stopThinking = () => {
    clearThinking();
    setThinkingState("idle");
  };

  useEffect(() => {
    return () => {
      clearThinking();
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, thinkingState]);

  useEffect(() => {
    const saved = localStorage.getItem("hunterDeskHistory");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Message[];
        setMessages(parsed);
      } catch {
        setMessages([
          {
            role: "assistant",
            content:
              "HUNTER DESK TERMINAL INITIALIZED.\n\nAwaiting macro data, central bank statements, or geopolitical inputs. Provide your inquiry for institutional analysis.",
          },
        ]);
      }
    } else {
      setMessages([
        {
          role: "assistant",
          content:
            "HUNTER DESK TERMINAL INITIALIZED.\n\nAwaiting macro data, central bank statements, or geopolitical inputs. Provide your inquiry for institutional analysis.",
        },
      ]);
    }
  }, []);

  useEffect(() => {
    if (systemAlert) {
      setMessages((prev) => {
        const newMsgs = [
          ...prev,
          { role: "assistant", content: systemAlert } as Message,
        ];
        localStorage.setItem("hunterDeskHistory", JSON.stringify(newMsgs));
        return newMsgs;
      });
      clearSystemAlert();
    }
  }, [systemAlert, clearSystemAlert]);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem("hunterDeskHistory", JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  useEffect(() => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    debounceTimeout.current = setTimeout(() => {
      setDebouncedInput(input);
    }, 300);
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, [input]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = debouncedInput.trim();
    if (
      !query ||
      thinkingState === "thinking" ||
      thinkingState === "responding"
    )
      return;

    const now = Date.now();
    if (now - lastSentAtRef.current < RATE_LIMIT_MS) {
      return;
    }
    lastSentAtRef.current = now;

    const userMessage: Message = { role: "user", content: query };
    const newMessages = [...messages, userMessage];

    setMessages(newMessages);
    setInput("");
    setDebouncedInput("");
    startThinking();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      const response = await fetch("/api/v1/macro-ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        signal: controller.signal,
        body: JSON.stringify({
          messages: newMessages,
          currentRegime,
          assets,
          liquidityStatus: liquidity?.status,
        }),
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error("Failed to connect to Terminal");
      }

      const contentType = response.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        const text = await response.text();
        throw new Error("Server returned non-JSON: " + text.slice(0, 200));
      }
      const data = await response.json() as { success?: boolean; reply?: string; error?: string };

      stopThinking();
      setThinkingState("responding");

      if (data.success && data.reply) {
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: "assistant", content: data.reply as string },
        ]);
      } else if (data.error) {
        setMessages((prev) => [
          ...prev.slice(0, -1),
          {
            role: "assistant",
            content: `[SYSTEM ERROR]: ${data.error}`,
          },
        ]);
      } else {
        throw new Error("Empty AI response");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          role: "assistant",
          content: `[CONNECTION FAILED]: ${message}`,
        },
      ]);
    } finally {
      stopThinking();
      setThinkingState("idle");
    }
  };

  const handleClearHistory = () => {
    if (confirm("Clear terminal history?")) {
      const initial = [
        {
          role: "assistant",
          content: "HUNTER DESK TERMINAL RESTARTED.\n\nAwaiting macro data...",
        },
      ] as Message[];
      setMessages(initial);
      localStorage.setItem("hunterDeskHistory", JSON.stringify(initial));
    }
  };

  return (
    <div className="flex flex-col h-full w-full glass overflow-hidden relative">
      <div className="bg-bg-surface/80 border-b border-border-subtle p-2 flex justify-between items-center z-10 shadow-sm">
        <h2 className="font-bold text-text-primary uppercase tracking-wider text-[11px] sm:text-xs flex items-center gap-2 min-w-0">
          <TerminalIcon size={14} className="text-accent-gold flex-shrink-0" aria-hidden />
          Hunter Desk AI
        </h2>
        <button
          onClick={handleClearHistory}
          aria-label="Clear terminal history"
          className="text-[10px] font-mono text-text-muted hover:text-accent-gold transition-colors"
        >
          [ CLEAR LOG ]
        </button>
      </div>

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {systemAlert}
      </div>

      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:20px_20px] opacity-20 mix-blend-overlay" />

      <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono z-10 scrollbar-thin scrollbar-thumb-accent-gold/20 scrollbar-track-transparent">
        {messages.map((msg, idx) => {
          const isLastAssistantThinking =
            msg.role === "assistant" &&
            idx === messages.length - 1 &&
            (thinkingState === "thinking" || thinkingState === "responding");

          return (
            <div
              key={idx}
              className={`flex gap-3 ${
                msg.role === "assistant" ? "flex-row" : "flex-row-reverse"
              }`}
            >
              <div
                className={`flex-shrink-0 w-6 h-6 rounded flex items-center justify-center ${
                  msg.role === "assistant"
                    ? "bg-accent-gold/10 border border-accent-gold/30 text-accent-gold"
                    : "bg-bg-surface border border-border-subtle text-text-secondary"
                }`}
              >
                {msg.role === "assistant" ? (
                  <Bot size={14} />
                ) : (
                  <User size={14} />
                )}
              </div>

              <div
                className={`max-w-[85%] rounded-lg p-3 ${
                  msg.role === "assistant"
                    ? "bg-bg-surface/80 border border-accent-gold/10 text-text-primary"
                    : "bg-accent-gold/5 border border-accent-gold/20 text-text-primary"
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5 opacity-60">
                  <span className="text-[9px] uppercase tracking-widest">
                    {msg.role === "assistant" ? "SYSTEM.AI" : "USER.OP"}
                  </span>
                  <span className="text-[9px]">â€”</span>
                  <span className="text-[9px]">
                    {new Date().toLocaleTimeString([], {
                      hour12: false,
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                {isLastAssistantThinking ? (
                  <div className="text-[10px] font-mono text-accent-gold animate-pulse">
                    {msg.content}
                  </div>
                ) : (
                  <div className="prose prose-invert prose-xs max-w-none prose-p:leading-relaxed prose-pre:bg-bg-void prose-pre:border prose-pre:border-border-subtle prose-a:text-accent-gold hover:prose-a:text-accent-gold-dim text-xs">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 border-t border-border-subtle bg-bg-surface/50 z-10">
        <form onSubmit={handleSubmit} className="flex items-end gap-2 relative">
          <div className="flex-1 relative">
            <div className="absolute left-2 top-2.5 text-accent-gold/50">
              <ChevronRight size={16} />
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="Query analysis..."
              className="w-full bg-bg-void border border-border-subtle rounded py-2 pl-8 pr-3 text-text-primary font-mono text-xs focus:outline-none focus:border-accent-gold/50 focus:ring-1 focus:ring-accent-gold/50 resize-none min-h-[38px] max-h-[120px] scrollbar-thin transition-all"
              rows={1}
              disabled={
                thinkingState === "thinking" || thinkingState === "responding"
              }
            />
          </div>
          <button
            type="submit"
            disabled={
              !debouncedInput.trim() ||
              thinkingState === "thinking" ||
              thinkingState === "responding"
            }
            className="h-[38px] px-4 bg-accent-gold text-bg-void rounded font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 active:scale-95 transition-all flex items-center justify-center min-w-[50px]"
          >
            {thinkingState === "thinking" || thinkingState === "responding" ? (
              <div className="w-4 h-4 border-2 border-bg-void/30 border-t-bg-void rounded-full animate-spin" />
            ) : (
              <Send size={14} />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
