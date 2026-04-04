"use client";

import { Strategy } from "@/services/playbook.service";
import { Eye, Edit, Trash2, Check, Target, Copy } from "lucide-react";

interface PlaybookCardProps {
  playbook: Strategy;
  onSelect?: (playbook: Strategy) => void;
  onView?: (playbook: Strategy) => void;
  onEdit?: (playbook: Strategy) => void;
  onDelete?: (playbook: Strategy) => void;
  onDuplicate?: (playbook: Strategy) => void;
  isSelectable?: boolean;
  isSelected?: boolean;
  showActions?: boolean;
}

export function PlaybookCard({
  playbook,
  onSelect,
  onView,
  onEdit,
  onDelete,
  onDuplicate,
  isSelectable = false,
  isSelected = false,
  showActions = true
}: PlaybookCardProps) {
  const handleCardClick = (e: React.MouseEvent) => {
    if (isSelectable && onSelect) {
      onSelect(playbook);
    }
  };

  const getCategoryColor = (methodology: string) => {
    const colors: Record<string, string> = {
      ICT: "bg-data-profit/10 text-data-profit border-data-profit/30",
      CRT: "bg-blue-500/10 text-blue-400 border-blue-500/30",
      MSNR: "bg-purple-500/10 text-purple-400 border-purple-500/30",
      SMC: "bg-accent-gold/10 text-accent-gold border-accent-gold/30",
      PA: "bg-green-500/10 text-green-400 border-green-500/30",
      IND: "bg-orange-500/10 text-orange-400 border-orange-500/30",
      HYBRID: "bg-pink-500/10 text-pink-400 border-pink-500/30",
      // Legacy support
      breakout: "bg-data-profit/10 text-data-profit border-data-profit/30",
      reversal: "bg-data-warning/10 text-data-warning border-data-warning/30",
      scalping: "bg-accent-gold/10 text-accent-gold border-accent-gold/30",
      swing: "bg-blue-500/10 text-blue-400 border-blue-500/30",
      news: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    };
    return colors[methodology] || "bg-bg-elevated text-text-secondary border-border-subtle";
  };

  return (
    <div
      className={`glass p-6 flex flex-col border ${isSelected ? 'border-accent-gold bg-accent-gold/10' : playbook.ictPoi ? 'border-accent-gold/20' : 'border-white/5'} hover:border-accent-gold/30 transition-all group relative`}
      onClick={handleCardClick}
      style={{ cursor: isSelectable ? 'pointer' : 'default' }}
    >
      {/* Selection Indicator */}
      {isSelectable && (
        <div className={`absolute top-4 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'border-accent-gold bg-accent-gold' : 'border-white/20 group-hover:border-accent-gold/50'}`}>
          {isSelected && <Check className="w-3 h-3 text-bg-void" />}
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center space-x-2 mb-2 flex-wrap gap-1">
            <span className={`px-2 py-1 text-[9px] font-bold uppercase border rounded ${getCategoryColor(playbook.methodology)}`}>
              {playbook.methodology}
            </span>
            {playbook.marketCondition && playbook.marketCondition !== "ALL" && (
              <span className="px-2 py-1 text-[9px] font-bold uppercase border rounded bg-bg-elevated text-text-secondary">
                {playbook.marketCondition}
              </span>
            )}
            {playbook.timeframe && (
              <span className="text-[10px] text-text-muted uppercase">{playbook.timeframe}</span>
            )}
          </div>
          <h3 className="text-lg font-bold text-text-primary">{playbook.name}</h3>
        </div>
      </div>

      {/* Description */}
      {playbook.description && (
        <p className="text-sm text-text-secondary mb-4 line-clamp-2">{playbook.description}</p>
      )}

      {/* Context Badges */}
      {(playbook.ictPoi || playbook.msnrLevel) && (
        <div className="flex flex-wrap gap-2 mb-4">
          {playbook.ictPoi && (
            <span className="px-2 py-0.5 bg-data-profit/10 text-data-profit text-[10px] font-bold rounded border border-data-profit/20 uppercase tracking-tight">
              POI: {playbook.ictPoi}
            </span>
          )}
          {playbook.msnrLevel && (
            <span className="px-2 py-0.5 bg-accent-gold/10 text-accent-gold text-[10px] font-bold rounded border border-accent-gold/20 uppercase tracking-tight">
              LVL: {playbook.msnrLevel}
            </span>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4 p-3 bg-bg-void/50 rounded-lg">
        <div className="text-center">
          <p className="text-[10px] text-text-muted uppercase tracking-wider">Win Rate</p>
          <p className="font-mono text-lg font-bold text-data-profit">
            {(playbook.stats?.winRate || 0).toFixed(1)}%
          </p>
        </div>
        <div className="text-center border-l border-white/10">
          <p className="text-[10px] text-text-muted uppercase tracking-wider">Avg R:R</p>
          <p className="font-mono text-lg font-bold text-accent-gold">
            {(playbook.stats?.avgRr || 0).toFixed(2)}R
          </p>
        </div>
      </div>

      {/* Rules */}
      <div className="flex-1">
        <h4 className="text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-2 flex items-center">
          <Target className="w-3.5 h-3.5 mr-2" />
          Execution Protocol
        </h4>
        <ul className="space-y-1 mb-4">
          {playbook.rules.slice(0, 3).map((rule, idx) => (
            <li key={`rule-${playbook.id || (playbook as any)._id}-${idx}`} className="text-sm text-text-secondary flex items-start">
              <span className="text-accent-gold mr-2 mt-1">▸</span>
              <span>{rule}</span>
            </li>
          ))}
          {playbook.rules.length > 3 && (
            <li className="text-sm text-text-muted italic">+{playbook.rules.length - 3} more rules</li>
          )}
        </ul>
      </div>

      {/* Markets */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {playbook.markets.map((market, idx) => (
          <span
            key={`market-${playbook.id || (playbook as any)._id}-${market}-${idx}`}
            className="px-2 py-1 text-[10px] font-medium bg-bg-elevated text-text-secondary rounded border border-border-subtle"
          >
            {market}
          </span>
        ))}
      </div>

      {/* Footer Actions (optional) */}
      {showActions && (
        <div className="flex justify-between items-center pt-4 border-t border-white/5 mt-auto">
          <span className="text-[10px] text-text-muted uppercase">
            Created {playbook.createdAt}
          </span>
          <div className="flex space-x-2">
            {onView && (
              <button
                onClick={(e) => { e.stopPropagation(); onView(playbook); }}
                className="p-1.5 text-text-muted hover:text-accent-gold hover:bg-white/5 rounded transition-colors"
                title="View"
              >
                <Eye className="w-4 h-4" />
              </button>
            )}
            {onEdit && (
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(playbook); }}
                className="p-1.5 text-text-muted hover:text-accent-gold hover:bg-white/5 rounded transition-colors"
                title="Edit"
              >
                <Edit className="w-4 h-4" />
              </button>
            )}
            {onDuplicate && (
              <button
                onClick={(e) => { e.stopPropagation(); onDuplicate(playbook); }}
                className="text-[11px] text-accent-gold hover:underline flex items-center"
                title="Duplicate"
              >
                <Copy className="w-3 h-3 mr-1" />
                Duplicate
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(playbook); }}
                className="p-1.5 text-text-muted hover:text-data-loss hover:bg-white/5 rounded transition-colors"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
