"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Brain,
  Edit3,
  Trash2,
  Save,
  X,
  Plus,
  Shield,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { SkeletonLoader } from "./SkeletonLoader";
import { EmptyState } from "./EmptyState";

// ─── Types & Constants ───────────────────────────────────

interface LearnedFact {
  date: string;
  fact: string;
}

interface PersonaMemory {
  personaId: string;
  facts: Array<{
    date: string;
    fact: string;
    category: string;
  }>;
}

interface UserMemory {
  userId: string;
  name: string;
  preferences: Record<string, unknown>;
  learnedFacts: LearnedFact[];
  agentMemories: PersonaMemory[];
  interactionCount: number;
}

interface Props {
  userId?: string;
}

const PERSONA_CONFIG = [
  { id: "hawk", label: "Hawk", emoji: "🦅", icon: Shield, color: "text-red-400" },
  { id: "dove", label: "Dove", emoji: "🕊️", icon: TrendingUp, color: "text-green-400" },
  { id: "contrarian", label: "Contrarian", emoji: "🦇", icon: AlertTriangle, color: "text-purple-400" },
];

// ─── Helper Functions ─────────────────────────────────────

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

// ─── Sub-Components ──────────────────────────────────────

function FactItem({
  fact,
  onEdit,
  onDelete,
}: {
  fact: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      className="bg-black/30 border border-accent-gold/10 rounded-lg p-3 group"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-gray-300 leading-relaxed flex-1">{fact}</p>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-1 text-text-muted hover:text-accent-gold transition-colors"
            aria-label="Edit fact"
          >
            <Edit3 className="w-3 h-3" />
          </button>
          <button
            onClick={onDelete}
            className="p-1 text-text-muted hover:text-neon-red transition-colors"
            aria-label="Delete fact"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function EditFactModal({
  fact,
  onSave,
  onCancel,
}: {
  fact: string;
  onSave: (newFact: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(fact);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="glass rounded-lg p-4 w-full max-w-md space-y-3">
        <h4 className="text-sm font-bold text-accent-gold">Edit Memory</h4>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full bg-black/40 border border-accent-gold/20 rounded-lg p-3 text-sm text-white resize-none focus:outline-none focus:border-accent-gold/50"
          rows={4}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-text-muted hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <button
            onClick={() => onSave(value)}
            className="px-3 py-1.5 text-xs bg-accent-gold/20 text-accent-gold rounded hover:bg-accent-gold/30 transition-colors"
          >
            <Save className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function PersonaSection({
  persona,
  memories,
}: {
  persona: (typeof PERSONA_CONFIG)[0];
  memories: PersonaMemory;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const Icon = persona.icon;

  return (
    <div className="border border-accent-gold/10 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-3 flex items-center gap-3 bg-black/20 hover:bg-black/30 transition-colors"
        aria-expanded={isOpen}
      >
        <span className="text-lg" aria-hidden="true">{persona.emoji}</span>
        <div className="flex-1 text-left">
          <span className="text-xs font-bold text-white">{persona.label}</span>
          <span className="text-[10px] text-text-muted ml-2">
            {memories.facts.length} fact{memories.facts.length !== 1 ? "s" : ""}
          </span>
        </div>
        <Icon className={`w-4 h-4 ${persona.color}`} />
        {isOpen ? <ChevronUp className="w-3 h-3 text-text-muted" /> : <ChevronDown className="w-3 h-3 text-text-muted" />}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3 space-y-2">
              {memories.facts.length === 0 ? (
                <p className="text-[10px] text-text-muted text-center py-2">No memories yet</p>
              ) : (
                memories.facts.map((f, idx) => (
                  <div key={idx} className="bg-black/30 rounded p-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[11px] text-gray-300 flex-1">{f.fact}</p>
                      <span className="text-[9px] text-text-muted whitespace-nowrap">{formatDate(f.date)}</span>
                    </div>
                    {f.category && (
                      <span className="inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded bg-accent-gold/10 text-accent-gold">
                        {f.category}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Export ─────────────────────────────────────────

export function MemoryInsights({ userId }: Props) {
  const [data, setData] = useState<UserMemory | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingFact, setEditingFact] = useState<{ index: number; fact: string } | null>(null);
  const [deletingFact, setDeletingFact] = useState<number | null>(null);

  const fetchMemory = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await globalThis.fetch(`/api/v1/user-memory/${userId}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setData(json.data);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchMemory();
  }, [fetchMemory]);

  const handleSaveFact = async (newFact: string) => {
    if (!editingFact || !userId) return;
    // TODO: Implement API call to update fact
    setEditingFact(null);
    fetchMemory();
  };

  const handleDeleteFact = async () => {
    if (deletingFact === null || !userId) return;
    // TODO: Implement API call to delete fact
    setDeletingFact(null);
    fetchMemory();
  };

  if (loading) {
    return <SkeletonLoader type="card" />;
  }

  if (!data) {
    return (
      <EmptyState
        type="data"
        title="No Memory Data"
        description="No memory insights available yet."
        actionText="Refresh"
        onAction={fetchMemory}
      />
    );
  }

  return (
    <div className="glass p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-bold tracking-widest uppercase text-accent-gold flex items-center gap-2 drop-shadow-[0_0_4px_rgba(212,175,55,0.4)]">
          <Brain className="w-4 h-4" />
          Memory Insights
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-muted">
            {data.interactionCount} interactions
          </span>
          <button
            onClick={fetchMemory}
            className="text-accent-gold-dim hover:text-accent-gold transition"
            aria-label="Refresh memory insights"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Learned Facts */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold text-accent-gold-dim uppercase tracking-widest">
            Learned Facts ({data.learnedFacts.length})
          </p>
        </div>
        {data.learnedFacts.length === 0 ? (
          <p className="text-xs text-text-muted text-center py-4">
            No learned facts yet. The agent will learn from your interactions.
          </p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
            <AnimatePresence>
              {data.learnedFacts.map((f, idx) => (
                <FactItem
                  key={idx}
                  fact={f.fact}
                  onEdit={() => setEditingFact({ index: idx, fact: f.fact })}
                  onDelete={() => setDeletingFact(idx)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Persona Memories */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold text-accent-gold-dim uppercase tracking-widest">
          Persona Memories
        </p>
        <div className="space-y-2">
          {PERSONA_CONFIG.map((persona) => {
            const memories = data.agentMemories?.find((m) => m.personaId === persona.id);
            if (!memories || memories.facts.length === 0) return null;
            return (
              <PersonaSection
                key={persona.id}
                persona={persona}
                memories={memories}
              />
            );
          })}
          {data.agentMemories?.every((m) => m.facts.length === 0) && (
            <p className="text-xs text-text-muted text-center py-4">
              No persona memories yet. Interact with agents to build memory.
            </p>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editingFact && (
        <EditFactModal
          fact={editingFact.fact}
          onSave={handleSaveFact}
          onCancel={() => setEditingFact(null)}
        />
      )}

      {/* Delete Confirmation */}
      {deletingFact !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="glass rounded-lg p-4 w-full max-w-sm space-y-3">
            <h4 className="text-sm font-bold text-neon-red">Delete Memory</h4>
            <p className="text-xs text-text-muted">
              Are you sure you want to delete this memory? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeletingFact(null)}
                className="px-3 py-1.5 text-xs text-text-muted hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteFact}
                className="px-3 py-1.5 text-xs bg-neon-red/20 text-neon-red rounded hover:bg-neon-red/30 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
