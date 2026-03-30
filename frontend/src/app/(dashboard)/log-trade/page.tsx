"use client";

import { useEffect, useState } from "react";
import { PenLine, Plus, TrendingUp, TrendingDown, Target, Clock, DollarSign, Loader2 } from "lucide-react";
import { tradeService, type Trade } from "@/services/trade.service";

export default function LogTradePage() {
  const [showForm, setShowForm] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrades = async () => {
      try {
        setLoading(true);
        const result = await tradeService.getAll();
        if (result.success && Array.isArray(result.data)) {
          setTrades(result.data);
        } else {
          setTrades([]);
        }
      } catch (err: any) {
        setError(err.message || "Network error");
      } finally {
        setLoading(false);
      }
    };
    fetchTrades();
  }, []);

  const handleCreateTrade = async (formData: any) => {
    // Calculate P&L and result from exit price
    const pnl = formData.exit > formData.entry
      ? (formData.exit - formData.entry) * formData.size * 100
      : (formData.entry - formData.exit) * formData.size * 100;
    const result = formData.exit > formData.entry ? "WIN" : formData.exit < formData.entry ? "LOSS" : "BREAKEVEN";

    const resultApi = await tradeService.create({
      pair: formData.pair,
      direction: formData.type,  // LONG or SHORT
      entryPrice: formData.entry,
      stopLoss: formData.entry * (formData.type === "Long" ? 0.98 : 1.02), // Default 2% SL
      takeProfit: formData.exit,  // Use exit as takeProfit
      lotSize: formData.size,
      actualPnl: pnl,
      result: result,
      emotionalState: formData.psychology ? Math.floor(Math.random() * 3) + 3 : undefined, // Map to 1-5 scale
      notes: formData.notes,
    });
    if (resultApi.success && resultApi.data) {
      const newTrade = resultApi.data as Trade; // guaranteed by check
      setTrades(prev => [newTrade, ...prev]);
      setShowForm(false);
    } else {
      alert(resultApi.error || "Failed to create trade");
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const tradeData = {
      pair: formData.get('pair') as string,
      type: formData.get('type') as "Long" | "Short",
      entry: parseFloat(formData.get('entry') as string),
      exit: parseFloat(formData.get('exit') as string),
      size: parseFloat(formData.get('size') as string),
      notes: formData.get('notes') as string,
      psychology: formData.get('psychology') as "confident" | "fear" | "greed" | "hesitant" | "disciplined",
      tags: (formData.get('tags') as string).split(',').map(t => t.trim()),
    };
    await handleCreateTrade(tradeData);
  };

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
          <p className="text-data-loss font-medium mb-2">Error loading trades</p>
          <p className="text-sm text-text-secondary">{error}</p>
        </div>
      </div>
    );
  }

  const filteredTrades = selectedFilter === "all"
    ? trades
    : trades.filter(t => t.result === selectedFilter);

  const totalPnl = Array.isArray(filteredTrades) ? filteredTrades.reduce((sum, t) => sum + t.pnl, 0) : 0;
  const winningTrades = Array.isArray(trades) ? trades.filter(t => t.result === "win") : [];
  const losingTrades = Array.isArray(trades) ? trades.filter(t => t.result === "loss") : [];
  const avgWin = winningTrades.length > 0
    ? winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length
    : 0;
  const avgLoss = losingTrades.length > 0
    ? losingTrades.reduce((sum, t) => sum + Math.abs(t.pnl), 0) / losingTrades.length
    : 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-[0.1em]">Catat Trade</h1>
          <p className="text-sm text-text-secondary mt-1">Document every trade with discipline</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn-gold flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Trade Baru</span>
        </button>
      </div>

      {/* Stats Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass p-4">
          <div className="flex items-center text-text-secondary mb-2">
            <TrendingUp className="w-4 h-4 mr-2" />
            <span className="text-[10px] uppercase tracking-[0.15em]">Total P&L</span>
          </div>
          <p className={`font-mono text-xl font-bold ${totalPnl >= 0 ? "text-data-profit" : "text-data-loss"}`}>
            {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
          </p>
        </div>
        <div className="glass p-4">
          <div className="flex items-center text-text-secondary mb-2">
            <Target className="w-4 h-4 mr-2" />
            <span className="text-[10px] uppercase tracking-[0.15em]">Avg Win</span>
          </div>
          <p className="font-mono text-xl font-bold text-data-profit">${avgWin.toFixed(2)}</p>
        </div>
        <div className="glass p-4">
          <div className="flex items-center text-text-secondary mb-2">
            <TrendingDown className="w-4 h-4 mr-2" />
            <span className="text-[10px] uppercase tracking-[0.15em]">Avg Loss</span>
          </div>
          <p className="font-mono text-xl font-bold text-data-loss">${avgLoss.toFixed(2)}</p>
        </div>
        <div className="glass p-4">
          <div className="flex items-center text-text-secondary mb-2">
            <Clock className="w-4 h-4 mr-2" />
            <span className="text-[10px] uppercase tracking-[0.15em]">Trades</span>
          </div>
          <p className="font-mono text-xl font-bold text-text-primary">{filteredTrades.length}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex space-x-2">
        {["all", "win", "loss", "breakeven"].map((filter) => (
          <button
            key={filter}
            onClick={() => setSelectedFilter(filter)}
            className={`px-4 py-2 text-[11px] font-bold uppercase tracking-[0.15em] rounded-lg transition-all ${
              selectedFilter === filter
                ? "bg-accent-gold text-bg-void"
                : "bg-bg-elevated text-text-secondary hover:text-accent-gold"
            }`}
          >
            {filter === "all" ? "Semua" : filter === "breakeven" ? "Breakeven" : filter === "win" ? "Win" : "Loss"}
          </button>
        ))}
      </div>

      {/* Trade Entries Table */}
      <div className="glass overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left p-4 text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em]">Pair</th>
                <th className="text-left p-4 text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em]">Type</th>
                <th className="text-right p-4 text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em]">Entry</th>
                <th className="text-right p-4 text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em]">Exit</th>
                <th className="text-right p-4 text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em]">Size</th>
                <th className="text-right p-4 text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em]">P&L</th>
                <th className="text-left p-4 text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em]">Psychology</th>
                <th className="text-left p-4 text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em]">Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrades.map((trade, idx) => (
                <tr key={idx} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="p-4">
                    <span className="font-mono font-bold text-text-primary">{trade.pair}</span>
                  </td>
                  <td className="p-4">
                    <span className={`text-[11px] font-bold uppercase px-2 py-1 rounded ${
                      trade.direction === "Long"
                        ? "bg-data-profit/10 text-data-profit"
                        : "bg-data-loss/10 text-data-loss"
                    }`}>
                      {trade.direction}
                    </span>
                  </td>
                  <td className="p-4 text-right font-mono text-sm text-text-secondary">{trade.entryPrice}</td>
                  <td className="p-4 text-right font-mono text-sm text-text-secondary">{trade.stopLoss}</td>
                  <td className="p-4 text-right font-mono text-sm text-text-primary">{trade.lotSize}</td>
                  <td className="p-4 text-right font-mono text-sm font-bold">
                    <span className={trade.result === "win" ? "text-data-profit" : "text-data-loss"}>
                      {trade.pnl >= 0 ? "+" : ""}${trade.pnl.toFixed(2)}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${
                      trade.emotionalState && trade.emotionalState >= 4
                        ? "bg-accent-gold/10 text-accent-gold"
                        : "bg-text-muted/10 text-text-muted"
                    }`}>
                      {trade.emotionalState || "N/A"}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-text-secondary max-w-xs truncate">{trade.notes || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Trade Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass p-6 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-accent-gold">Entry Trade Baru</h2>
              <button onClick={() => setShowForm(false)} className="text-text-muted hover:text-accent-gold">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-2">Pair/Instrument</label>
                  <input
                    name="pair"
                    type="text"
                    placeholder="ex: XAUUSD, EURUSD"
                    required
                    className="w-full bg-bg-input border border-border-subtle rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-accent-gold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-2">Direction</label>
                  <select name="type" required className="w-full bg-bg-input border border-border-subtle rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-accent-gold focus:outline-none">
                    <option value="Long">Long</option>
                    <option value="Short">Short</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-2">Entry Price</label>
                  <input
                    name="entry"
                    type="number"
                    step="any"
                    placeholder="0.00"
                    required
                    className="w-full bg-bg-input border border-border-subtle rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-accent-gold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-2">Exit Price</label>
                  <input
                    name="exit"
                    type="number"
                    step="any"
                    placeholder="0.00"
                    required
                    className="w-full bg-bg-input border border-border-subtle rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-accent-gold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-2">Size/Lots</label>
                  <input
                    name="size"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    required
                    className="w-full bg-bg-input border border-border-subtle rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-accent-gold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-2">Psychology State</label>
                  <select name="psychology" className="w-full bg-bg-input border border-border-subtle rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-accent-gold focus:outline-none">
                    <option value="confident">Confident</option>
                    <option value="fear">Fear</option>
                    <option value="greed">Greed</option>
                    <option value="hesitant">Hesitant</option>
                    <option value="disciplined">Disciplined</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-2">Notes / Reasoning</label>
                <textarea
                  name="notes"
                  rows={3}
                  placeholder="Why did you enter? What was the setup?"
                  className="w-full bg-bg-input border border-border-subtle rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-accent-gold focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-2">Tags (comma separated)</label>
                <input
                  name="tags"
                  type="text"
                  placeholder="breakout, trend-following, support"
                  className="w-full bg-bg-input border border-border-subtle rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-accent-gold focus:outline-none"
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
                  Save Trade
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
