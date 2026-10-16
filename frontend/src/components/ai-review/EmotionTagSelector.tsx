"use client";

import { useState } from "react";
import { X, SmilePlus, Check } from "lucide-react";
import {
  aiCoachService,
  EMOTION_TAGS,
  type EmotionTag,
  type TradingSession,
  type TradeType,
} from "@/services/ai-coach.service";
import { toast } from "sonner";

interface EmotionTagSelectorProps {
  tradeId: string;
  symbol: string;
  pnl: number;
  timeframe?: string;
  session?: string;
  tradeType?: "market" | "pending" | "ai-auto";
  rMultiple?: number;
  holdDurationMinutes?: number;
  marketContext?: any;
  defaultEmotion?: EmotionTag | null;
  defaultNotes?: string;
  onSave?: (emotion: any) => void;
  onClose?: () => void;
}

const sessionMap: Record<string, TradingSession> = {
  Asia: "ASIA",
  London: "LONDON",
  "NY AM": "NEW_YORK",
  "NY PM": "NEW_YORK",
  Other: "OVERLAP",
  NY: "NEW_YORK",
  ASIA: "ASIA",
  LONDON: "LONDON",
  NEW_YORK: "NEW_YORK",
  OVERLAP: "OVERLAP",
};

export function EmotionTagSelector({
  tradeId,
  symbol,
  pnl,
  timeframe = "M15",
  session = "Other",
  tradeType = "ai-auto",
  rMultiple,
  holdDurationMinutes,
  marketContext,
  defaultEmotion = null,
  defaultNotes = "",
  onSave,
  onClose,
}: EmotionTagSelectorProps) {
  const [selectedEmotion, setSelectedEmotion] = useState<EmotionTag | null>(defaultEmotion);
  const [notes, setNotes] = useState(defaultNotes);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!selectedEmotion) {
      toast.warning("Pilih emosi terlebih dahulu");
      return;
    }

    setSaving(true);
    try {
      const result = await aiCoachService.upsertEmotion({
        tradeId,
        tradeType,
        emotionTag: selectedEmotion,
        notes: notes.trim() || undefined,
        timestamp: new Date().toISOString(),
        pnl,
        symbol,
        timeframe,
        session: sessionMap[session] || "OVERLAP",
        rMultiple,
        holdDurationMinutes,
        marketContext,
      });

      if (result.success) {
        toast.success("Emosi tersimpan!");
        onSave?.(result.data);
        onClose?.();
      } else {
        toast.error(result.error || "Gagal menyimpan");
      }
    } catch (err: any) {
      toast.error("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass w-full max-w-md mx-4 p-6 border border-border-subtle rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-accent-gold/10 rounded-lg">
              <SmilePlus className="w-5 h-5 text-accent-gold" />
            </div>
            <div>
              <h3 className="font-bold text-text-primary">Catat Emosi</h3>
              <p className="text-[11px] text-text-muted">
                {symbol} • PnL: {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Emotion Grid */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          {EMOTION_TAGS.map((e) => {
            const isSelected = selectedEmotion === e.tag;
            return (
              <button
                key={e.tag}
                onClick={() => setSelectedEmotion(isSelected ? null : e.tag)}
                className={`flex flex-col items-center p-3 rounded-lg border transition-all duration-150 ${
                  isSelected
                    ? "border-current shadow-lg scale-105"
                    : "border-border-subtle hover:border-white/20"
                }`}
                style={
                  isSelected
                    ? { borderColor: e.color, backgroundColor: `${e.color}15`, color: e.color }
                    : {}
                }
              >
                <span className="text-2xl mb-1">{e.icon}</span>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider ${
                    isSelected ? "" : "text-text-secondary"
                  }`}
                >
                  {e.label}
                </span>
                {isSelected && (
                  <Check className="w-3 h-3 mt-1" style={{ color: e.color }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Notes */}
        <div className="mb-6">
          <label className="text-[10px] text-text-muted uppercase tracking-wider mb-2 block">
            Catatan (opsional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Kenapa kamu merasa seperti ini saat trade?"
            className="w-full bg-bg-void/50 border border-border-subtle rounded-lg p-3 text-sm text-text-primary placeholder-text-muted focus:border-accent-gold focus:outline-none resize-none h-20"
          />
        </div>

        {/* Actions */}
        <div className="flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm text-text-muted border border-border-subtle rounded-lg hover:bg-white/5 transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={!selectedEmotion || saving}
            className="flex-1 px-4 py-2.5 text-sm font-bold bg-accent-gold text-bg-void rounded-lg hover:bg-accent-gold/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-bg-void/30 border-t-bg-void rounded-full animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Simpan</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}