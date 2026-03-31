"use client";

import { useEffect, useState } from "react";
import { PenLine, Plus, TrendingUp, TrendingDown, Target, Clock, Loader2, Link as LinkIcon, BarChart2, DollarSign } from "lucide-react";
import { tradeService, type Trade } from "@/services/trade.service";

export default function LogTradePage() {
  const [showForm, setShowForm] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Live calculator states
  const [entryPrice, setEntryPrice] = useState<number | "">("");
  const [stopLoss, setStopLoss] = useState<number | "">("");
  const [takeProfit, setTakeProfit] = useState<number | "">("");
  const [direction, setDirection] = useState<"LONG" | "SHORT">("LONG");
  const [predictedR, setPredictedR] = useState<number | null>(null);

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

  // Real-time R-Multiple Calculator Engine
  useEffect(() => {
    if (entryPrice && stopLoss && takeProfit) {
      let risk, reward;
      if (direction === "LONG") {
        risk = Number(entryPrice) - Number(stopLoss);
        reward = Number(takeProfit) - Number(entryPrice);
      } else {
        risk = Number(stopLoss) - Number(entryPrice);
        reward = Number(entryPrice) - Number(takeProfit);
      }
      
      if (risk > 0) {
        const rMulti = reward / risk;
        setPredictedR(parseFloat(rMulti.toFixed(2)));
      } else {
        setPredictedR(null);
      }
    } else {
      setPredictedR(null);
    }
  }, [entryPrice, stopLoss, takeProfit, direction]);


  const handleCreateTrade = async (formData: any) => {
    const actualPnl = parseFloat(formData.actualPnl);
    const resultStatus = actualPnl > 0 ? "WIN" : actualPnl < 0 ? "LOSS" : "BREAKEVEN";

    const resultApi = await tradeService.create({
      tradeDate: new Date().toISOString(),
      pair: formData.pair.toUpperCase(),
      direction: formData.direction as "LONG" | "SHORT",
      entryPrice: parseFloat(formData.entryPrice),
      stopLoss: parseFloat(formData.stopLoss),
      takeProfit: formData.takeProfit ? parseFloat(formData.takeProfit) : undefined,
      lotSize: parseFloat(formData.lotSize),
      actualPnl: actualPnl,
      result: resultStatus,
      emotionalState: parseInt(formData.emotionalState),
      notes: formData.notes,
      chartLink: formData.chartLink || undefined,
    });

    if (resultApi.success && resultApi.data) {
      const newTrade = resultApi.data as Trade;
      setTrades(prev => [newTrade, ...prev]);
      setShowForm(false);
      resetForm();
    } else {
      alert(resultApi.error || "Gagal mencatat trade ke database");
    }
  };

  const resetForm = () => {
    setEntryPrice("");
    setStopLoss("");
    setTakeProfit("");
    setDirection("LONG");
    setPredictedR(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const tradeData = {
      pair: formData.get('pair') as string,
      direction: direction,
      entryPrice: formData.get('entryPrice') as string,
      stopLoss: formData.get('stopLoss') as string,
      takeProfit: formData.get('takeProfit') as string,
      lotSize: formData.get('lotSize') as string,
      actualPnl: formData.get('actualPnl') as string,
      emotionalState: formData.get('emotionalState') as string,
      chartLink: formData.get('chartLink') as string,
      notes: formData.get('notes') as string,
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
    : trades.filter(t => t.result.toLowerCase() === selectedFilter.toLowerCase());

  const totalPnl = Array.isArray(filteredTrades) ? filteredTrades.reduce((sum, t) => sum + t.pnl, 0) : 0;
  const winningTrades = Array.isArray(trades) ? trades.filter(t => t.result.toLowerCase() === "win") : [];
  const losingTrades = Array.isArray(trades) ? trades.filter(t => t.result.toLowerCase() === "loss") : [];
  const avgWin = winningTrades.length > 0
    ? winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length
    : 0;
  const avgLoss = losingTrades.length > 0
    ? losingTrades.reduce((sum, t) => sum + Math.abs(t.pnl), 0) / losingTrades.length
    : 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700 pb-12">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-[0.1em]">Buku Jurnal Trade</h1>
          <p className="text-sm text-text-secondary mt-1">Siklus psikologi, kebiasaan, dan angka absolut mu</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn-gold flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Trade</span>
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
          <p className="font-mono text-xl font-bold text-data-loss">-${avgLoss.toFixed(2)}</p>
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
      <div className="glass overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.01]">
                <th className="text-left p-4 text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em]">Pair</th>
                <th className="text-left p-4 text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em]">Arah</th>
                <th className="text-right p-4 text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em]">Setup (En/SL/TP)</th>
                <th className="text-right p-4 text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em]">Size</th>
                <th className="text-right p-4 text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em]">R-Ratio</th>
                <th className="text-right p-4 text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em]">Akhir P&L</th>
                <th className="text-center p-4 text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em]">Psikologi</th>
                <th className="text-left p-4 text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em]">Data</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrades.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-text-muted text-sm italic">
                    Belum ada rekaman eksekusi
                  </td>
                </tr>
              ) : filteredTrades.map((trade, idx) => (
                <tr key={idx} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                  <td className="p-4">
                    <span className="font-mono font-bold text-text-primary text-sm">{trade.pair}</span>
                  </td>
                  <td className="p-4">
                    <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded shadow-sm ${
                      trade.direction.toLowerCase() === "long"
                        ? "bg-data-profit/10 text-data-profit border border-data-profit/20"
                        : "bg-data-loss/10 text-data-loss border border-data-loss/20"
                    }`}>
                      {trade.direction}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex flex-col text-xs font-mono">
                      <span className="text-text-primary">{trade.entryPrice}</span>
                      <span className="text-text-muted">SL: {trade.stopLoss}</span>
                      {trade.takeProfit && <span className="text-text-muted">TP: {trade.takeProfit}</span>}
                    </div>
                  </td>
                  <td className="p-4 text-right font-mono text-sm text-text-primary">{trade.lotSize}</td>
                  <td className="p-4 text-right font-mono text-xs">
                    {trade.rMultiple ? (
                        <span className="text-accent-gold">{trade.rMultiple}R</span>
                    ) : (
                        <span className="text-text-muted">-</span>
                    )}
                  </td>
                  <td className="p-4 text-right font-mono text-sm font-bold">
                    <span className={trade.result.toLowerCase() === "win" ? "text-data-profit" : trade.result.toLowerCase() === "loss" ? "text-data-loss" : "text-text-secondary"}>
                      {trade.pnl > 0 ? "+" : ""}${trade.pnl.toFixed(2)}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex justify-center">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        trade.emotionalState === 5 ? "bg-accent-gold text-bg-void shadow-[0_0_10px_rgba(234,179,8,0.3)]" : 
                        trade.emotionalState === 4 ? "bg-accent-gold/50 text-white" :
                        trade.emotionalState === 3 ? "bg-bg-elevated text-text-primary" :
                        "bg-data-loss/50 text-white"
                      }`}>
                        {trade.emotionalState || "-"}
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center space-x-3">
                      {trade.chartLink ? (
                        <a href={trade.chartLink} target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-accent-gold transition-colors" title="Lihat Analisis Chart">
                          <LinkIcon className="w-4 h-4" />
                        </a>
                      ) : (
                        <span className="w-4 h-4 opacity-0" />
                      )}
                      {trade.notes && (
                         <div className="relative cursor-help text-text-muted hover:text-text-primary transition-colors" title={trade.notes}>
                            <PenLine className="w-4 h-4" />
                         </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Form Glassmorphism Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-bg-void/80 backdrop-blur-md flex items-center justify-center z-50 p-4 sm:p-6 overflow-y-auto">
          <div className="relative glass border border-white/10 rounded-2xl max-w-4xl w-full mx-auto shadow-2xl overflow-hidden my-8 animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-5 border-b border-white/5 bg-bg-elevated/50">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-accent-gold/10 flex items-center justify-center">
                  <BarChart2 className="w-4 h-4 text-accent-gold" />
                </div>
                <h2 className="text-xl font-bold text-text-primary tracking-wide">Terminal Pencatatan Manual</h2>
              </div>
              <button onClick={() => { setShowForm(false); resetForm(); }} className="p-2 rounded-lg text-text-muted hover:text-accent-gold hover:bg-accent-gold/10 transition-colors">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              
              {/* Dynamic Warning/Helper Zone */}
              <div className="mb-6 flex items-center justify-between bg-white/[0.02] p-4 rounded-xl border border-white/5">
                <p className="text-xs text-text-secondary leading-relaxed max-w-xl">
                  Kedisiplinan dimulai dari sini. Hitung eksposur risiko, tulis rasionalitas eksekusi Anda sebelum pergerakan pasar menutup jejak analisis teknikal murni buatan Anda.
                </p>
                {/* Realtime RR Badge */}
                <div className="flex flex-col items-end">
                   <p className="text-[10px] uppercase font-bold tracking-widest text-text-muted mb-1">Estimasi Reward/Risk</p>
                   {predictedR !== null ? (
                      <span className={`text-lg font-mono font-bold ${predictedR >= 2 ? "text-accent-gold" : predictedR >= 1 ? "text-data-profit" : "text-data-loss"}`}>
                        {predictedR} R
                      </span>
                   ) : (
                      <span className="text-sm font-mono text-text-muted">Awaiting Data...</span>
                   )}
                </div>
              </div>

              {/* 2-Column Form Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Left Column: Core Technicals */}
                <div className="space-y-5">
                  <h3 className="text-[11px] font-bold text-accent-gold uppercase tracking-[0.2em] border-b border-white/5 pb-2">Eksekusi Pasar</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Instrumen/Pair</label>
                      <input
                        name="pair"
                        type="text"
                        placeholder="XAUUSD"
                        required
                        className="w-full bg-bg-void/50 border border-white/10 rounded-lg px-3 py-2.5 text-text-primary font-mono text-sm focus:border-accent-gold focus:ring-1 focus:ring-accent-gold transition-all outline-none uppercase"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Arah Transaksi</label>
                      <select 
                        required 
                        value={direction}
                        onChange={(e) => setDirection(e.target.value as "LONG" | "SHORT")}
                        className="w-full bg-bg-void/50 border border-white/10 rounded-lg px-3 py-2.5 text-text-primary font-mono text-sm focus:border-accent-gold focus:ring-1 focus:ring-accent-gold transition-all outline-none"
                      >
                        <option value="LONG">Long (Buy)</option>
                        <option value="SHORT">Short (Sell)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Harga Entri</label>
                      <input
                        name="entryPrice"
                        type="number"
                        step="any"
                        placeholder="0.00"
                        required
                        value={entryPrice}
                        onChange={(e) => setEntryPrice(e.target.value ? parseFloat(e.target.value) : "")}
                        className="w-full bg-bg-void/50 border border-white/10 rounded-lg px-3 py-2.5 text-text-primary font-mono text-sm focus:border-accent-gold focus:ring-1 focus:ring-accent-gold transition-all outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Ukuran Lot</label>
                      <input
                        name="lotSize"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        required
                        className="w-full bg-bg-void/50 border border-white/10 rounded-lg px-3 py-2.5 text-text-primary font-mono text-sm focus:border-accent-gold focus:ring-1 focus:ring-accent-gold transition-all outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-data-loss uppercase tracking-wider">Stop Loss</label>
                      <input
                        name="stopLoss"
                        type="number"
                        step="any"
                        placeholder="0.00"
                        required
                        value={stopLoss}
                        onChange={(e) => setStopLoss(e.target.value ? parseFloat(e.target.value) : "")}
                        className="w-full bg-bg-void/50 border border-data-loss/30 rounded-lg px-3 py-2.5 text-text-primary font-mono text-sm focus:border-data-loss focus:ring-1 focus:ring-data-loss transition-all outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-data-profit uppercase tracking-wider">Take Profit <span className="text-text-muted lowercase">(opt)</span></label>
                      <input
                        name="takeProfit"
                        type="number"
                        step="any"
                        placeholder="0.00"
                        value={takeProfit}
                        onChange={(e) => setTakeProfit(e.target.value ? parseFloat(e.target.value) : "")}
                        className="w-full bg-bg-void/50 border border-data-profit/30 rounded-lg px-3 py-2.5 text-text-primary font-mono text-sm focus:border-data-profit focus:ring-1 focus:ring-data-profit transition-all outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2">
                      <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Keuntungan Aktual / PnL Netto ($)</label>
                      <div className="relative">
                        <DollarSign className="w-4 h-4 text-text-muted absolute left-3 top-1/2 transform -translate-y-1/2" />
                        <input
                          name="actualPnl"
                          type="number"
                          step="any"
                          placeholder="Masukkan nilai nett setelah komisi broker"
                          required
                          className="w-full bg-bg-void/50 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-text-primary font-mono text-sm focus:border-accent-gold focus:ring-1 focus:ring-accent-gold transition-all outline-none"
                        />
                      </div>
                  </div>
                </div>

                {/* Right Column: Sentiment & Journalization */}
                <div className="space-y-5">
                  <h3 className="text-[11px] font-bold text-accent-gold uppercase tracking-[0.2em] border-b border-white/5 pb-2">Jurnal Analisis Pribadi</h3>
                  
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider flex justify-between">
                      <span>Chart URL / Tautan Screenshot</span>
                      <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer" className="text-accent-gold hover:underline lowercase tracking-normal">tradingview →</a>
                    </label>
                    <div className="relative">
                      <LinkIcon className="w-4 h-4 text-text-muted absolute left-3 top-1/2 transform -translate-y-1/2" />
                      <input
                        name="chartLink"
                        type="url"
                        placeholder="https://www.tradingview.com/x/..."
                        className="w-full bg-bg-void/50 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-text-primary text-sm focus:border-accent-gold focus:ring-1 focus:ring-accent-gold transition-all outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider flex justify-between items-center">
                      <span>Evaluasi Kedisiplinan & Kondisi Mental</span>
                      <span className="text-[10px] text-text-muted tracking-normal">Skala 1 - 5</span>
                    </label>
                    <select name="emotionalState" required className="w-full bg-bg-void/50 border border-white/10 rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-accent-gold focus:ring-1 focus:ring-accent-gold transition-all outline-none">
                      <option value="5">👑 Level 5 - Presisi, Tanpa Emosi, Setup Tipe-A</option>
                      <option value="4">🎯 Level 4 - Mengikuti Rencana Sangat Disiplin</option>
                      <option value="3" defaultValue="3">⚖️ Level 3 - Netral, Eksekusi Wajar</option>
                      <option value="2">😰 Level 2 - Ragu, Sedikit Fear Of Missing Out (FOMO)</option>
                      <option value="1">💀 Level 1 - Berjudi, Full Emosi, Melanggar SOP</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Ulasan & Catatan Taktikal</label>
                    <textarea
                      name="notes"
                      rows={4}
                      placeholder="Apa yang mendorong Anda menelan risiko di harga ini? Apakah Anda masuk karena news, divergensi RSI, atau blokade institusional?"
                      className="w-full bg-bg-void/50 border border-white/10 rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-accent-gold focus:ring-1 focus:ring-accent-gold transition-all outline-none resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-4 pt-6 mt-6 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); resetForm(); }}
                  className="px-6 py-2.5 text-sm font-bold text-text-secondary hover:text-white transition-colors uppercase tracking-wider"
                >
                  Batal
                </button>
                <button type="submit" className="btn-gold font-bold uppercase tracking-widest text-sm px-8 py-2.5 animate-in">
                  Kunci Jurnal Trade
                </button>
              </div>
            </form>
            
          </div>
        </div>
      )}
    </div>
  );
}
