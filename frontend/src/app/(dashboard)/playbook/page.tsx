"use client";

import { useEffect, useState } from "react";
import { BookOpen, Plus, Target, TrendingUp, Eye, Edit, Trash2, Copy, Loader2 } from "lucide-react";
import { playbookService, type Strategy } from "@/services/playbook.service";
import { PlaybookCard } from "@/components/playbook/PlaybookCard";
import { CreatePlaybookForm } from "@/components/playbook/CreatePlaybookForm";

export default function PlaybookPage() {
  const [showForm, setShowForm] = useState(false);
  const [viewingStrategy, setViewingStrategy] = useState<Strategy | null>(null);
  const [editingStrategy, setEditingStrategy] = useState<Strategy | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStrategies = async () => {
      try {
        setLoading(true);
        const result = await playbookService.getAll();
        if (result.success && result.data) {
          setStrategies(Array.isArray(result.data) ? result.data : []);
        } else {
          setError(result.error || "Failed to load playbook");
        }
      } catch (err: any) {
        setError(err.message || "Network error");
      } finally {
        setLoading(false);
      }
    };
    fetchStrategies();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent-gold animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <p className="text-data-loss font-medium mb-2">Error loading playbook</p>
          <p className="text-sm text-text-secondary">{error}</p>
        </div>
      </div>
    );
  }

  const filteredStrategies = selectedCategory === "all"
    ? strategies
    : strategies.filter(s => s.methodology === selectedCategory);

  const categories = [
    { id: "all", label: "All Methodologies" },
    { id: "ICT", label: "ICT" },
    { id: "CRT", label: "CRT" },
    { id: "MSNR", label: "MSNR" },
    { id: "SMC", label: "SMC" },
    { id: "PA", label: "Price Action" },
    { id: "IND", label: "Indicator-based" },
    { id: "HYBRID", label: "Hybrid" },
  ];

  const getCategoryColor = (methodology: string) => {
    const colors: Record<string, string> = {
      ICT: "bg-data-profit/10 text-data-profit border-data-profit/30",
      CRT: "bg-blue-500/10 text-blue-400 border-blue-500/30",
      MSNR: "bg-purple-500/10 text-purple-400 border-purple-500/30",
      SMC: "bg-accent-gold/10 text-accent-gold border-accent-gold/30",
      PA: "bg-green-500/10 text-green-400 border-green-500/30",
      IND: "bg-orange-500/10 text-orange-400 border-orange-500/30",
      HYBRID: "bg-pink-500/10 text-pink-400 border-pink-500/30",
    };
    return colors[methodology] || "bg-bg-elevated text-text-secondary border-border-subtle";
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-[0.1em]">Playbook</h1>
          <p className="text-sm text-text-secondary mt-1">Your proven trading strategies</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn-gold flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>New Strategy</span>
        </button>
      </div>

      {/* Categories Filter */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-2 text-[11px] font-bold uppercase tracking-[0.15em] rounded-lg transition-all ${
              selectedCategory === cat.id
                ? "bg-accent-gold text-bg-void"
                : "bg-bg-elevated text-text-secondary hover:text-accent-gold"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Strategies Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredStrategies.map((strategy) => (
          <PlaybookCard
            key={strategy.id || (strategy as any)._id}
            playbook={strategy}
            onView={() => setViewingStrategy(strategy)}
            onEdit={() => setEditingStrategy(strategy)}
            onDelete={async (s) => {
              const strategyId = s.id || (s as any)._id;
              if (window.confirm("Delete this strategy from the database?")) {
                try {
                  const res = await playbookService.delete(strategyId);
                  if (res.success) {
                    setStrategies(prev => prev.filter(item => (item.id || (item as any)._id) !== strategyId));
                  } else {
                    alert(res.error || "Failed to delete strategy");
                  }
                } catch (err: any) {
                  alert("System error occurred while deleting");
                }
              }
            }}
            onDuplicate={async (s) => {
              const id = s.id || (s as any)._id;
              const res = await playbookService.duplicate(id);
              if (res.success && res.data) {
                setStrategies(prev => [res.data!, ...prev]);
              }
            }}
          />
        ))}
      </div>

      {/* Create Strategy Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass p-6 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-accent-gold">Create New Playbook</h2>
              <button onClick={() => setShowForm(false)} className="text-text-muted hover:text-accent-gold">✕</button>
            </div>
            <CreatePlaybookForm
              onSubmit={(playbook) => {
                setStrategies(prev => [playbook, ...prev]);
                setShowForm(false);
              }}
              onCancel={() => setShowForm(false)}
              mode="create"
            />
          </div>
        </div>
      )}
      {/* View Strategy Modal */}
      {viewingStrategy && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass p-6 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className={`px-2 py-1 text-[9px] font-bold uppercase border rounded mb-2 inline-block ${getCategoryColor(viewingStrategy.methodology)}`}>
                  {viewingStrategy.methodology}
                </span>
                <h2 className="text-2xl font-bold text-accent-gold">{viewingStrategy.name}</h2>
                <p className="text-sm text-text-secondary mt-1">
                  {viewingStrategy.timeframe} • {viewingStrategy.markets.join(', ')}
                  {viewingStrategy.marketCondition && ` • ${viewingStrategy.marketCondition}`}
                </p>
              </div>
              <button onClick={() => setViewingStrategy(null)} className="text-text-muted hover:text-accent-gold text-xl">✕</button>
            </div>

            <div className="space-y-6">
              {viewingStrategy.description && (
                <div>
                  <h4 className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">Description</h4>
                  <p className="text-sm text-text-secondary leading-relaxed">{viewingStrategy.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-6">
                {/* Strategy Info */}
                <div className="space-y-3 p-4 bg-bg-void/40 rounded-lg border border-white/5">
                  <h4 className="text-[11px] font-bold text-accent-gold uppercase tracking-wider">Strategy Details</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-[10px] text-text-muted uppercase">Methodology</span>
                      <span className="text-xs text-accent-gold font-bold">{viewingStrategy.methodology}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[10px] text-text-muted uppercase">Market Condition</span>
                      <span className="text-xs text-text-primary">{viewingStrategy.marketCondition || "ALL"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[10px] text-text-muted uppercase">Timeframe</span>
                      <span className="text-xs text-text-primary">{viewingStrategy.timeframe || "-"}</span>
                    </div>
                  </div>
                </div>

                {/* Performance Stats */}
                <div className="space-y-3 p-4 bg-bg-void/40 rounded-lg border border-white/5">
                  <h4 className="text-[11px] font-bold text-data-profit uppercase tracking-wider">Performance</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-[10px] text-text-muted uppercase">Total Trades</span>
                      <span className="text-xs font-mono text-text-primary">{viewingStrategy.stats?.totalTrades || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[10px] text-text-muted uppercase">Win Rate</span>
                      <span className="text-xs font-mono text-data-profit">{(viewingStrategy.stats?.winRate || 0).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[10px] text-text-muted uppercase">Avg R:R</span>
                      <span className="text-xs font-mono text-accent-gold">{(viewingStrategy.stats?.avgRr || 0).toFixed(2)}R</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[10px] text-text-muted uppercase">Total P&L</span>
                      <span className={`text-xs font-mono ${viewingStrategy.stats?.totalPnL && viewingStrategy.stats.totalPnL >= 0 ? "text-data-profit" : "text-data-loss"}`}>
                        {viewingStrategy.stats?.totalPnL ? `${viewingStrategy.stats.totalPnL >= 0 ? '+' : ''}$${viewingStrategy.stats.totalPnL.toLocaleString()}` : "$0"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* HTF Context */}
              {(viewingStrategy.htfKeyLevel || viewingStrategy.ictPoi || viewingStrategy.msnrLevel || viewingStrategy.htfTimeframe) && (
                <div className="space-y-3 p-4 bg-bg-void/40 rounded-lg border border-white/5">
                  <h4 className="text-[11px] font-bold text-accent-gold uppercase tracking-wider">HTF Context</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {viewingStrategy.htfTimeframe && (
                      <div>
                        <span className="text-[10px] text-text-muted uppercase block mb-1">HTF Timeframe</span>
                        <span className="text-xs text-text-primary">{viewingStrategy.htfTimeframe}</span>
                      </div>
                    )}
                    {viewingStrategy.htfKeyLevel && (
                      <div>
                        <span className="text-[10px] text-text-muted uppercase block mb-1">Key Level</span>
                        <span className="text-xs text-text-primary font-mono">{viewingStrategy.htfKeyLevel}</span>
                      </div>
                    )}
                    {viewingStrategy.ictPoi && (
                      <div>
                        <span className="text-[10px] text-text-muted uppercase block mb-1">ICT POI</span>
                        <span className="text-xs text-data-profit font-bold">{viewingStrategy.ictPoi}</span>
                      </div>
                    )}
                    {viewingStrategy.msnrLevel && (
                      <div>
                        <span className="text-[10px] text-text-muted uppercase block mb-1">MSNR Level</span>
                        <span className="text-xs text-accent-gold font-bold">{viewingStrategy.msnrLevel}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Entry Setup */}
              <div className="space-y-3 p-4 bg-bg-void/40 rounded-lg border border-white/5">
                <h4 className="text-[11px] font-bold text-accent-gold uppercase tracking-wider">Entry Setup</h4>
                <div className="space-y-2">
                  {viewingStrategy.entryTimeframe && (
                    <div className="flex justify-between">
                      <span className="text-[10px] text-text-muted uppercase">Confirmation TF</span>
                      <span className="text-xs text-text-primary">{viewingStrategy.entryTimeframe}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-[10px] text-text-muted uppercase block mb-1">Checklist</span>
                    <div className="flex flex-wrap gap-1">
                      {viewingStrategy.entryChecklist && Array.isArray(viewingStrategy.entryChecklist) && viewingStrategy.entryChecklist.length > 0 ? (
                        viewingStrategy.entryChecklist.map(item => (
                          <span key={item} className="px-1.5 py-0.5 bg-accent-gold/10 text-accent-gold text-[9px] font-bold rounded border border-accent-gold/20">{item}</span>
                        ))
                      ) : (
                        <span className="text-xs text-text-muted italic">None</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-3 flex items-center">
                  <Target className="w-3.5 h-3.5 mr-2" />
                  Execution Protocol
                </h4>
                <ul className="space-y-2">
                  {viewingStrategy.rules.map((rule, idx) => (
                    <li key={idx} className="text-sm text-text-secondary flex items-start p-2 bg-white/5 rounded border border-white/5 hover:border-accent-gold/20 transition-all">
                      <span className="text-accent-gold mr-3 font-bold">{idx + 1}.</span>
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex justify-end pt-6 mt-6 border-t border-white/5">
              <button 
                onClick={() => {
                  setEditingStrategy(viewingStrategy);
                  setViewingStrategy(null);
                }}
                className="btn-gold flex items-center space-x-2"
              >
                <Edit className="w-4 h-4" />
                <span>Edit Strategy</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Strategy Modal */}
      {editingStrategy && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass p-6 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-accent-gold">Edit Strategy</h2>
              <button onClick={() => setEditingStrategy(null)} className="text-text-muted hover:text-accent-gold">✕</button>
            </div>
            <CreatePlaybookForm
              mode="edit"
              initialData={editingStrategy}
              onSubmit={(updated) => {
                setStrategies(prev => prev.map(s => (s.id || (s as any)._id) === (updated.id || (updated as any)._id) ? updated : s));
                setEditingStrategy(null);
                if (viewingStrategy && (viewingStrategy.id === updated.id || (viewingStrategy as any)._id === (updated as any)._id)) {
                  setViewingStrategy(updated);
                }
              }}
              onCancel={() => setEditingStrategy(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

