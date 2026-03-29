"use client";

import { useEffect, useState } from "react";
import { BookOpen, Plus, Target, TrendingUp, Eye, Edit, Trash2, Copy, Loader2 } from "lucide-react";
import { playbookService, type Strategy } from "@/services/playbook.service";

export default function PlaybookPage() {
  const [showForm, setShowForm] = useState(false);
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
    : strategies.filter(s => s.category === selectedCategory);

  const categories = [
    { id: "all", label: "All" },
    { id: "breakout", label: "Breakout" },
    { id: "reversal", label: "Reversal" },
    { id: "scalping", label: "Scalping" },
    { id: "swing", label: "Swing" },
    { id: "news", label: "News" },
  ];

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      breakout: "bg-data-profit/10 text-data-profit border-data-profit/30",
      reversal: "bg-data-warning/10 text-data-warning border-data-warning/30",
      scalping: "bg-accent-gold/10 text-accent-gold border-accent-gold/30",
      swing: "bg-blue-500/10 text-blue-400 border-blue-500/30",
      news: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    };
    return colors[category] || "bg-bg-elevated text-text-secondary border-border-subtle";
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
          <div key={strategy.id} className="glass p-6 flex flex-col hover:border-accent-gold/30 transition-all">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <span className={`px-2 py-1 text-[9px] font-bold uppercase border rounded ${getCategoryColor(strategy.category)}`}>
                    {strategy.category}
                  </span>
                  <span className="text-[10px] text-text-muted uppercase">{strategy.timeframe}</span>
                </div>
                <h3 className="text-lg font-bold text-text-primary">{strategy.name}</h3>
              </div>
              <div className="flex space-x-1">
                <button className="p-2 text-text-muted hover:text-accent-gold hover:bg-white/5 rounded transition-colors">
                  <Eye className="w-4 h-4" />
                </button>
                <button className="p-2 text-text-muted hover:text-accent-gold hover:bg-white/5 rounded transition-colors">
                  <Edit className="w-4 h-4" />
                </button>
                <button className="p-2 text-text-muted hover:text-data-loss hover:bg-white/5 rounded transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <p className="text-sm text-text-secondary mb-4">{strategy.description}</p>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 mb-4 p-3 bg-bg-void/50 rounded-lg">
              <div className="text-center">
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Win Rate</p>
                <p className="font-mono text-lg font-bold text-data-profit">{strategy.winRate}%</p>
              </div>
              <div className="text-center border-l border-white/10">
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Avg R:R</p>
                <p className="font-mono text-lg font-bold text-accent-gold">{strategy.avgRr.toFixed(1)}</p>
              </div>
            </div>

            {/* Rules */}
            <div className="flex-1">
              <h4 className="text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-2 flex items-center">
                <Target className="w-3.5 h-3.5 mr-2" />
                Entry Rules
              </h4>
              <ul className="space-y-1 mb-4">
                {strategy.rules.slice(0, 3).map((rule, idx) => (
                  <li key={idx} className="text-sm text-text-secondary flex items-start">
                    <span className="text-accent-gold mr-2 mt-1">▸</span>
                    <span>{rule}</span>
                  </li>
                ))}
                {strategy.rules.length > 3 && (
                  <li className="text-sm text-text-muted italic">+{strategy.rules.length - 3} more rules</li>
                )}
              </ul>
            </div>

            {/* Markets */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {strategy.markets.map((market) => (
                <span
                  key={market}
                  className="px-2 py-1 text-[10px] font-medium bg-bg-elevated text-text-secondary rounded border border-border-subtle"
                >
                  {market}
                </span>
              ))}
            </div>

            {/* Footer Actions */}
            <div className="flex justify-between items-center pt-4 border-t border-white/5">
              <span className="text-[10px] text-text-muted uppercase">Created {strategy.createdAt}</span>
              <div className="flex space-x-2">
                <button className="flex items-center space-x-1 text-[11px] text-accent-gold hover:underline">
                  <Copy className="w-3 h-3" />
                  <span>Duplicate</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Strategy Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass p-6 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-accent-gold">Create New Strategy</h2>
              <button onClick={() => setShowForm(false)} className="text-text-muted hover:text-accent-gold">
                ✕
              </button>
            </div>
            <form className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-2">Strategy Name</label>
                  <input
                    type="text"
                    placeholder="ex: London Breakout"
                    className="w-full bg-bg-input border border-border-subtle rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-accent-gold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-2">Category</label>
                  <select className="w-full bg-bg-input border border-border-subtle rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-accent-gold focus:outline-none">
                    <option value="breakout">Breakout</option>
                    <option value="reversal">Reversal</option>
                    <option value="scalping">Scalping</option>
                    <option value="swing">Swing</option>
                    <option value="news">News</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-2">Timeframe</label>
                  <input
                    type="text"
                    placeholder="ex: M15, H1"
                    className="w-full bg-bg-input border border-border-subtle rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-accent-gold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-2">Markets</label>
                  <input
                    type="text"
                    placeholder="ex: EURUSD, GBPUSD"
                    className="w-full bg-bg-input border border-border-subtle rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-accent-gold focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-2">Description</label>
                <textarea
                  rows={2}
                  placeholder="Brief description of your strategy"
                  className="w-full bg-bg-input border border-border-subtle rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-accent-gold focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-2">Entry Rules</label>
                <textarea
                  rows={4}
                  placeholder="1. Identify...&#10;2. Wait for...&#10;3. Enter when..."
                  className="w-full bg-bg-input border border-border-subtle rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-accent-gold focus:outline-none resize-none"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-gold">
                  Create Strategy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
