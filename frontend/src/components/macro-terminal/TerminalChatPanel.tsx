"use client";

import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, Send, User, ChevronRight, Terminal as TerminalIcon } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function TerminalChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    const saved = localStorage.getItem("hunterDeskHistory");
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load chat history", e);
      }
    } else {
      setMessages([
        {
          role: "assistant",
          content: "HUNTER DESK TERMINAL INITIALIZED.\n\nAwaiting macro data, central bank statements, or geopolitical inputs. Provide your inquiry for institutional analysis."
        }
      ]);
    }
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem("hunterDeskHistory", JSON.stringify(messages));
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const response = await fetch("/api/v1/macro-ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!response.ok) {
        throw new Error("Failed to connect to Terminal");
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ") && line !== "data: [DONE]") {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.text) {
                  setMessages((prev) => {
                    const updated = [...prev];
                    const lastIndex = updated.length - 1;
                    updated[lastIndex] = {
                      ...updated[lastIndex],
                      content: updated[lastIndex].content + data.text,
                    };
                    return updated;
                  });
                } else if (data.error) {
                  setMessages((prev) => {
                    const updated = [...prev];
                    const lastIndex = updated.length - 1;
                    updated[lastIndex] = {
                      ...updated[lastIndex],
                      content: updated[lastIndex].content + "\n\n[SYSTEM ERROR]: " + data.error,
                    };
                    return updated;
                  });
                }
              } catch (e) {
                // Ignore parse errors for incomplete chunks
              }
            }
          }
        }
      }
    } catch (error: any) {
      console.error("Chat error:", error);
      setMessages((prev) => {
        const updated = [...prev];
        const lastIndex = updated.length - 1;
        updated[lastIndex] = {
          ...updated[lastIndex],
          content: updated[lastIndex].content + "\n\n[CONNECTION FAILED]: " + error.message,
        };
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    if (confirm("Clear terminal history?")) {
      const initial = [
        {
          role: "assistant",
          content: "HUNTER DESK TERMINAL RESTARTED.\n\nAwaiting macro data..."
        }
      ] as Message[];
      setMessages(initial);
      localStorage.setItem("hunterDeskHistory", JSON.stringify(initial));
    }
  };

  return (
    <div className="flex flex-col h-full glass border border-border-subtle rounded-xl overflow-hidden relative">
      <div className="bg-bg-surface/80 border-b border-border-subtle p-3 flex justify-between items-center z-10 shadow-sm">
        <h2 className="text-xs font-mono font-bold text-accent-gold uppercase tracking-widest flex items-center gap-2">
          <TerminalIcon size={14} />
          Hunter Desk AI
        </h2>
        <button
          onClick={handleClearHistory}
          className="text-[10px] font-mono text-text-muted hover:text-accent-gold transition-colors"
        >
          [ CLEAR LOG ]
        </button>
      </div>

      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:20px_20px] opacity-20 mix-blend-overlay"></div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono z-10 scrollbar-thin scrollbar-thumb-accent-gold/20 scrollbar-track-transparent">
        {messages.map((msg, idx) => (
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
              {msg.role === "assistant" ? <Bot size={14} /> : <User size={14} />}
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
                <span className="text-[9px]">—</span>
                <span className="text-[9px]">
                  {new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="prose prose-invert prose-xs max-w-none prose-p:leading-relaxed prose-pre:bg-bg-void prose-pre:border prose-pre:border-border-subtle prose-a:text-accent-gold hover:prose-a:text-accent-gold-dim text-xs">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.content}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
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
              disabled={isLoading}
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="h-[38px] px-4 bg-accent-gold text-bg-void rounded font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 active:scale-95 transition-all flex items-center justify-center min-w-[50px]"
          >
            {isLoading ? (
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
