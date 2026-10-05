"use client";

import { useState, useCallback, useRef, useEffect } from "react";

type Persona = "hawk" | "dove" | "contrarian";

interface Message {
  role: "user" | "assistant";
  content: string;
  toolsUsed?: string[];
}

interface ChatSession {
  _id: string;
  agentType: Persona;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

interface ChatState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  messages: Message[];
  input: string;
  isTyping: boolean;
}

const PERSONA_CONFIG: Record<Persona, { label: string; emoji: string; color: string }> = {
  hawk: { label: "Hawk · The Quant", emoji: "🦅", color: "#ef4444" },
  dove: { label: "Dove · The Strategist", emoji: "🕊️", color: "#22c55e" },
  contrarian: { label: "Contrarian · The Maverick", emoji: "🎯", color: "#a855f7" },
};

export function useAgentChat() {
  const [state, setState] = useState<ChatState>({
    sessions: [],
    activeSessionId: null,
    messages: [],
    input: "",
    isTyping: false,
  });

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch sessions list
  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/chat/sessions", {
        credentials: "include",
      });
      const data = await res.json();
      setState((prev) => ({ ...prev, sessions: data.sessions || [] }));
    } catch (e) {
      console.error("Failed to fetch sessions:", e);
    }
  }, []);

  // Create new session
  const createSession = useCallback(async (agentType: Persona = "hawk", title?: string) => {
    try {
      const res = await fetch("/api/v1/chat/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ agentType, title }),
      });
      const data = await res.json();
      if (data.sessionId) {
        const newSession: ChatSession = {
          _id: data.sessionId,
          agentType,
          title: title || "Chat Baru",
          messages: [
            {
              role: "assistant",
              content: `Halo! Saya ${PERSONA_CONFIG[agentType].label.split(" · ")[0]}. ${agentType === "hawk"
                ? "Fokus inflasi & pengetatan likuiditas."
                : agentType === "dove"
                  ? "Fokus growth & pelonggaran kebijakan."
                  : "Mencari anomali & kebalikan konsensus."
              }`,
            },
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setState((prev) => ({
          ...prev,
          sessions: [newSession, ...prev.sessions],
          activeSessionId: data.sessionId,
          messages: newSession.messages,
        }));
        return data.sessionId;
      }
    } catch (e) {
      console.error("Failed to create session:", e);
    }
  }, []);

  // Load messages for a session
  const loadMessages = useCallback(async (sessionId: string) => {
    try {
      const res = await fetch(`/api/v1/chat/session/${sessionId}/messages`, {
        credentials: "include",
      });
      const data = await res.json();
      setState((prev) => ({
        ...prev,
        activeSessionId: sessionId,
        messages: data.messages || [],
      }));
    } catch (e) {
      console.error("Failed to load messages:", e);
    }
  }, []);

  // Switch to a session
  const switchSession = useCallback((sessionId: string) => {
    loadMessages(sessionId);
  }, [loadMessages]);

  // Send message
  const sendMessage = useCallback(async (content: string, context?: Record<string, any>) => {
    if (!content.trim() || state.isTyping) return;

    const userMessage: Message = { role: "user", content };
    const newMessages = [...state.messages, userMessage];

    setState((prev) => ({
      ...prev,
      messages: newMessages,
      input: "",
      isTyping: true,
    }));

    try {
      const sessionId = state.activeSessionId || undefined;
      const res = await fetch("/api/v1/chat/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          messages: newMessages,
          currentRegime: context?.currentRegime,
          assets: context?.assets,
          liquidityStatus: context?.liquidityStatus,
          personaId: sessionId ? PERSONA_CONFIG[(sessionId as any) as Persona]?.label?.split(" · ")[0]?.toLowerCase() || "hawk" : context?.personaId || "hawk",
          sessionId,
          userId: null, // extracted from auth cookie
          context,
        }),
      });

      const data = await res.json();
      if (data.reply) {
        const assistantMessage: Message = {
          role: "assistant",
          content: data.reply,
          toolsUsed: data.toolsUsed,
        };
        setState((prev) => ({
          ...prev,
          messages: [...newMessages, assistantMessage],
          isTyping: false,
        }));
      } else {
        throw new Error(data.error || "AI response empty");
      }
    } catch (e: any) {
      setState((prev) => ({
        ...prev,
        messages: [...newMessages, { role: "assistant", content: `Error: ${e.message || "Gagal mendapatkan respons"}` }],
        isTyping: false,
      }));
    }
  }, [state.isTyping, state.messages, state.activeSessionId]);

  // Clear current chat
  const clearChat = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      messages: [{ role: "assistant", content: "Chat telah dibersihkan." }],
    }));
  }, []);

  // Delete session
  const deleteSession = useCallback(async (sessionId: string) => {
    // TODO: implement delete endpoint
    setState((prev) => ({
      ...prev,
      sessions: prev.sessions.filter((s) => s._id !== sessionId),
      activeSessionId: prev.activeSessionId === sessionId ? null : prev.activeSessionId,
    }));
  }, []);

  // Typing indicator simulation
  useEffect(() => {
    if (!state.isTyping) return;
    const timeout = setTimeout(() => {
      setState((prev) => ({ ...prev, isTyping: false }));
    }, 1500);
    return () => clearTimeout(timeout);
  }, [state.isTyping]);

  return {
    ...state,
    PERSONA_CONFIG,
    fetchSessions,
    createSession,
    loadMessages,
    switchSession,
    sendMessage,
    clearChat,
    deleteSession,
    setInput: (val: string) => setState((prev) => ({ ...prev, input: val })),
  };
}