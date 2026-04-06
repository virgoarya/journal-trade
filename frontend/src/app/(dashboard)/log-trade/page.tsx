"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { tradeService, type Trade, type CreateTradeDto } from "@/services/trade.service";
import { aiReviewService, type AIReview } from "@/services/ai-review.service";
import { tradingAccountService, type TradingAccount } from "@/services/trading-account.service";
import { playbookService, type Strategy as Playbook } from "@/services/playbook.service";
import { useSession } from "@/lib/auth-client";
import { Zap, Plus, Loader2, TrendingUp, Target, TrendingDown, Clock, DollarSign, LinkIcon, PenLine, BarChart2, Edit2, Trash2, RotateCcw } from "lucide-react";
import { PlaybookAssignmentModal } from "@/components/trade/PlaybookAssignmentModal";

export const dynamic = 'force-dynamic';

// ============ TIMEZONE HELPERS (New York) ============

// Helper to calculate trade duration
function calculateDuration(entryDate: Date | string, exitDate?: Date | string): string {
  if (!exitDate) return "-";
  const entry = new Date(entryDate);
  const exit = new Date(exitDate);
  const diffMs = exit.getTime() - entry.getTime();

  if (diffMs <= 0) return "0m";

  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m`;
  }
  return `${minutes}m`;
}

// Determine if a date (in New York local time) is during DST
function isNewYorkDST(date: Date): boolean {
  const year = date.getFullYear();

  // DST starts: second Sunday in March at 2:00 AM
  const march1 = new Date(year, 2, 1);
  const firstSundayMarch = 1 + (7 - march1.getDay()) % 7;
  const secondSundayMarch = firstSundayMarch + 7;
  const dstStart = new Date(year, 2, secondSundayMarch, 2, 0, 0, 0);

  // DST ends: first Sunday in November at 2:00 AM
  const nov1 = new Date(year, 10, 1);
  const firstSundayNov = 1 + (7 - nov1.getDay()) % 7;
  const dstEnd = new Date(year, 10, firstSundayNov, 2, 0, 0, 0);

  return date >= dstStart && date < dstEnd;
}

// Convert New York local datetime (from datetime-local input) to UTC ISO string
function nyDateTimeToUTC(dateTimeLocal: string): string {
  if (!dateTimeLocal) return "";

  const [datePart, timePart = ""] = dateTimeLocal.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour = 0, minute = 0] = timePart.split(':').map(Number);

  // Build a Date object representing the NY local time
  const dateInNY = new Date(year, month - 1, day, hour, minute, 0, 0);
  const isDST = isNewYorkDST(dateInNY);
  const offsetMinutes = isDST ? -4 * 60 : -5 * 60; // NY = UTC-4 (EDT) or UTC-5 (EST)

  // Compute UTC milliseconds
  const utcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0) - offsetMinutes * 60 * 1000;
  return new Date(utcMs).toISOString();
}

// Format UTC date (or ISO string) to New York local datetime-local string (YYYY-MM-DDTHH:MM)
function formatToNYDateTimeLocal(date: Date | string | undefined): string {
  if (!date) return "";
  const d = new Date(date); // interpret as UTC timestamp

  // Use Intl to format in America/New_York timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(d);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';

  const year = getPart('year');
  const month = getPart('month');
  const day = getPart('day');
  const hour = getPart('hour');
  const minute = getPart('minute');

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function LogTradePageInner() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const dateFilter = searchParams.get("date");
  
  const [showForm, setShowForm] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReview, setSelectedReview] = useState<AIReview | null>(null);
  const [reviewLoading, setReviewLoading] = useState<Record<string, boolean>>({});

  // Playbook assignment state
  const [showPlaybookModal, setShowPlaybookModal] = useState(false);
  const [createdTradeId, setCreatedTradeId] = useState<string | null>(null);

  // Trading account state
  const [activeAccount, setActiveAccount] = useState<TradingAccount | null>(null);
  const [accountLoading, setAccountLoading] = useState(true);

  // Playbooks state for name lookup
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [playbooksLoading, setPlaybooksLoading] = useState(false);

  // Live calculator states
  const [entryPrice, setEntryPrice] = useState<number | "">("");
  const [stopLoss, setStopLoss] = useState<number | "">("");
  const [takeProfit, setTakeProfit] = useState<number | "">("");
  const [lotSize, setLotSize] = useState<number | "">("");
  const [direction, setDirection] = useState<"LONG" | "SHORT">("LONG");
  const [pair, setPair] = useState<string>("");
  const [predictedR, setPredictedR] = useState<number | null>(null);
  const [riskPercent, setRiskPercent] = useState<number | null>(null);

  // Risk tier warning states
  const [riskWarning, setRiskWarning] = useState<string | null>(null);
  const [accountRiskLimit, setAccountRiskLimit] = useState<number>(1.0); // defaultRiskPercent from account
  const [acknowledgeRisk, setAcknowledgeRisk] = useState(false);

  // Edit & Delete states
  const [editingTradeId, setEditingTradeId] = useState<string | null>(null);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [deleteConfirmTrade, setDeleteConfirmTrade] = useState<Trade | null>(null);
  const [deleteReason, setDeleteReason] = useState<string>("MT5 mismatch");

  const fetchTrades = async (includeDeleted: boolean = false) => {
    try {
      setLoading(true);
      setError(null);
      const result = await tradeService.getAll(includeDeleted);
      console.log("FetchTrades result:", { includeDeleted, success: result.success, data: result.data, error: result.error });
      if (result.success && Array.isArray(result.data)) {
        setTrades(result.data);
      } else {
        const errorMsg = result.error || "Failed to fetch trades";
        console.error("FetchTrades failed:", errorMsg);
        setError(errorMsg);
        setTrades([]);
      }
    } catch (err: any) {
      console.error("FetchTrades exception:", err);
      setError(err.message || "Network error");
      setTrades([]);
    } finally {
      setLoading(false);
    }
  };

  // Detect trading session from tradeDate (UTC)
  const detectSession = (date: Date): "Asia" | "London" | "NY" | "Sydney" | "Other" => {
    const hour = date.getUTCHours();
    if (hour >= 21 || hour < 5) return "Sydney";
    if (hour >= 5 && hour < 8) return "Asia";
    if (hour >= 8 && hour < 13) return "London";
    if (hour >= 13 && hour < 21) return "NY";
    return "Other";
  };

  // Fetch trades on mount and when filter changes
  useEffect(() => {
    fetchTrades(selectedFilter === "deleted");
  }, [selectedFilter]);

  // Fetch initial supporting data on mount
  useEffect(() => {
    fetchActiveAccount();
    fetchPlaybooks();
  }, []);

  const fetchActiveAccount = async () => {
    try {
      setAccountLoading(true);
      const result = await tradingAccountService.getActiveAccount();
      if (result.success && result.data) {
        setActiveAccount(result.data);
        // Use the saved defaultRiskPercent as the risk limit threshold
        setAccountRiskLimit(result.data.defaultRiskPercent || 1.0);
      } else {
        setActiveAccount(null);
        setAccountRiskLimit(1.0);
      }
    } catch (error) {
      console.error("Failed to fetch active account:", error);
      setActiveAccount(null);
      setAccountRiskLimit(1.0);
    } finally {
      setAccountLoading(false);
    }
  };

  const fetchPlaybooks = async () => {
    try {
      setPlaybooksLoading(true);
      const result = await playbookService.getAll();
      if (result.success && Array.isArray(result.data)) {
        setPlaybooks(result.data);
      }
    } catch (error) {
      console.error("Failed to fetch playbooks:", error);
    } finally {
      setPlaybooksLoading(false);
    }
  };

  // Real-time R-Multiple & Risk % Calculator Engine
  useEffect(() => {
    if (entryPrice && stopLoss) {
      const entry = Number(entryPrice);
      const stop = Number(stopLoss);
      let riskPoints: number;
      if (direction === "LONG") {
        riskPoints = entry - stop;
      } else {
        riskPoints = stop - entry;
      }

      // Calculate R-Multiple if takeProfit is provided
      if (takeProfit && riskPoints > 0) {
        const tp = Number(takeProfit);
        let rewardPoints: number;
        if (direction === "LONG") {
          rewardPoints = tp - entry;
        } else {
          rewardPoints = entry - tp;
        }
        const rMulti = rewardPoints / riskPoints;
        setPredictedR(parseFloat(rMulti.toFixed(2)));
      } else {
        setPredictedR(null);
      }

      // Calculate Risk %
      if (riskPoints > 0 && activeAccount?.currentEquity && lotSize) {
        const lotSizeVal = parseFloat(lotSize.toString()) || 0;
        if (lotSizeVal > 0) {
          // Determine contract size based on pair (简单实现)
          const currentPair = pair.toUpperCase();
          let contractSize = 100000; // default forex

          if (currentPair.includes("XAU") || currentPair.includes("GOLD")) {
            contractSize = 100; // 1 lot = 100 oz for gold
          } else if (currentPair.includes("BTC") || currentPair.includes("ETH")) {
            contractSize = 1; // crypto通常1 lot = 1 unit
          } else if (currentPair.includes("US30") || currentPair.includes("SPX") || currentPair.includes("NAS") || currentPair.includes("SP500")) {
            contractSize = 1; // indices typically 1 lot = 1 contract
          }

          const riskAmount = Math.abs(riskPoints) * contractSize * lotSizeVal;
          const equity = activeAccount.currentEquity || activeAccount.initialBalance || 0;
          const riskPct = (riskAmount / equity) * 100;
          const calculatedRisk = parseFloat(riskPct.toFixed(2));
          setRiskPercent(calculatedRisk);

          // Check against account risk limit
          if (calculatedRisk > accountRiskLimit) {
            const exceedBy = (calculatedRisk - accountRiskLimit).toFixed(2);
            setRiskWarning(`OVER RISK! Melebihi batas risiko yang ditetapkan (${accountRiskLimit}%) sebanyak ${exceedBy}%`);
            setAcknowledgeRisk(false); // reset acknowledgment
          } else {
            setRiskWarning(null);
            setAcknowledgeRisk(false);
          }
        } else {
          setRiskPercent(null);
          setRiskWarning(null);
        }
      } else {
        setRiskPercent(null);
        setRiskWarning(null);
      }
    } else {
      setPredictedR(null);
      setRiskPercent(null);
      setRiskWarning(null);
    }
  }, [entryPrice, stopLoss, takeProfit, direction, lotSize, activeAccount, accountRiskLimit, pair]);


  // Deprecated: use formatToNYDateTimeLocal instead for New York timezone
  // Kept for reference but not used

  // Edit/Delete handlers
  const startEdit = (trade: Trade) => {
    setEditingTradeId(trade.id);
    setEditingTrade(trade);
    setEntryPrice(trade.entryPrice);
    setStopLoss(trade.stopLoss);
    setTakeProfit(trade.takeProfit || "");
    setLotSize(trade.lotSize);
    setPair(trade.pair);
    // Convert direction to uppercase (backend expects LONG/SHORT)
    setDirection(trade.direction.toUpperCase() as "LONG" | "SHORT");
    setRiskWarning(null);
    setAcknowledgeRisk(false);
    setShowForm(true); // Open the form modal
  };

  const cancelEdit = () => {
    setEditingTradeId(null);
    setEditingTrade(null);
    resetForm();
  };

  const handleDelete = async (tradeId: string, reason: string) => {
    try {
      await tradeService.delete(tradeId, reason);
      // Refetch trades to sync with server
      await fetchTrades(selectedFilter === "deleted");
      setDeleteConfirmTrade(null);
      alert("Trade deleted successfully");
    } catch (error: any) {
      alert("Failed to delete trade: " + error.message);
    }
  };

  const handleRestore = async (tradeId: string) => {
    try {
      await tradeService.restore(tradeId);
      // Refetch trades to sync with server
      await fetchTrades(selectedFilter === "deleted");
      alert("Trade restored successfully");
    } catch (error: any) {
      alert("Failed to restore trade: " + error.message);
    }
  };

  const handleUpdate = async (tradeId: string, formData: any) => {
    if (!activeAccount) {
      alert("No active trading account found");
      return;
    }

    const actualPnl = parseFloat(formData.actualPnl);
    const entry = parseFloat(formData.entryPrice);
    const stop = parseFloat(formData.stopLoss);
    const takeProfit = formData.takeProfit ? parseFloat(formData.takeProfit) : undefined;
    const lot = parseFloat(formData.lotSize);
    const dir = direction;

    // Calculate risk points
    let riskPoints: number;
    if (dir === "LONG") {
      riskPoints = entry - stop;
    } else {
      riskPoints = stop - entry;
    }

    // Calculate risk percent
    let riskPercentCalc: number | undefined;
    if (riskPoints > 0 && activeAccount.currentEquity && lot > 0) {
      const pair = formData.pair.toUpperCase();
      let contractSize = 100000;
      if (pair.includes("XAU") || pair.includes("GOLD")) contractSize = 100;
      else if (pair.includes("BTC") || pair.includes("ETH")) contractSize = 1;
      else if (pair.includes("US30") || pair.includes("SPX") || pair.includes("NAS") || pair.includes("SP500")) contractSize = 1;

      const riskAmount = Math.abs(riskPoints) * contractSize * lot;
      const equity = activeAccount.currentEquity || activeAccount.initialBalance || 0;
      riskPercentCalc = parseFloat(((riskAmount / equity) * 100).toFixed(2));
    }

    // Calculate Actual R multiple
    let rMult: number | undefined;
    if (riskPoints > 0 && lot > 0) {
      const pair = formData.pair.toUpperCase();
      let contractSize = 100000;
      if (pair.includes("XAU") || pair.includes("GOLD")) contractSize = 100;
      else if (pair.includes("BTC") || pair.includes("ETH")) contractSize = 1;
      else if (pair.includes("US30") || pair.includes("SPX") || pair.includes("NAS") || pair.includes("SP500")) contractSize = 1;

      const riskAmount = Math.abs(riskPoints) * contractSize * lot;
      if (riskAmount > 0) {
        rMult = parseFloat((actualPnl / riskAmount).toFixed(2));
      }
    }

    // Determine result based on P&L
    const resultStatus: "WIN" | "LOSS" | "BREAKEVEN" = actualPnl > 0 ? "WIN" : actualPnl < 0 ? "LOSS" : "BREAKEVEN";

    // Convert tradeDate from NY local datetime to UTC ISO for storage
    const tradeDateISO = nyDateTimeToUTC(formData.tradeDate);
    // Create a Date object (UTC) for session detection
    const tradeDateUTC = new Date(tradeDateISO);
    // Gunakan session dari form jika dipilih manual, fallback ke auto-detect
    const autoSession = detectSession(tradeDateUTC);
    const session = formData.session && formData.session !== "AUTO" ? formData.session : autoSession;

    const updateData: Partial<CreateTradeDto> = {
      tradeDate: tradeDateISO,
      pair: formData.pair.toUpperCase(),
      direction: dir as "LONG" | "SHORT",
      entryPrice: entry,
      stopLoss: stop,
      takeProfit: takeProfit,
      lotSize: lot,
      actualPnl: actualPnl,
      result: resultStatus,
      emotionalState: parseInt(formData.emotionalState),
      notes: formData.notes,
      chartLink: formData.chartLink || undefined,
      exitDate: formData.exitDate ? nyDateTimeToUTC(formData.exitDate) : undefined,
      session,
      marketCondition: formData.marketCondition && formData.marketCondition !== "" ? formData.marketCondition : undefined,
      riskPercent: riskPercentCalc,
      rMultiple: rMult,
    };

    try {
      const result = await tradeService.update(tradeId, updateData);
      if (result.success && result.data) {
        const updatedTrade = result.data;
        setTrades(prev => prev.map(t => t.id === tradeId ? updatedTrade : t));

        // Check if trade has no playbook assigned, trigger assignment modal
        if (!updatedTrade.playbookId) {
          setCreatedTradeId(updatedTrade.id);
          setShowPlaybookModal(true);
        }

        setEditingTradeId(null);
        setEditingTrade(null);
        setShowForm(false);
        resetForm();
      } else {
        alert(result.error || "Failed to update trade");
      }
    } catch (err: any) {
      alert("Network error occurred.");
    }
  };

  const handleCreateTrade = async (formData: any) => {
    if (!activeAccount) {
      alert("No active trading account found. Please set up an account in Settings first.");
      return;
    }

    const actualPnl = parseFloat(formData.actualPnl);
    const resultStatus: "WIN" | "LOSS" | "BREAKEVEN" = actualPnl > 0 ? "WIN" : actualPnl < 0 ? "LOSS" : "BREAKEVEN";

    // Calculate Actual R
    let rMult: number | undefined;
    const entry = parseFloat(formData.entryPrice);
    const stop = parseFloat(formData.stopLoss);
    const lot = parseFloat(formData.lotSize);
    const riskPoints = Math.abs(entry - stop);
    if (riskPoints > 0 && lot > 0) {
      const pair = formData.pair.toUpperCase();
      let contractSize = 100000;
      if (pair.includes("XAU") || pair.includes("GOLD")) contractSize = 100;
      else if (pair.includes("BTC") || pair.includes("ETH")) contractSize = 1;
      else if (pair.includes("US30") || pair.includes("SPX") || pair.includes("NAS") || pair.includes("SP500")) contractSize = 1;

      const riskAmount = riskPoints * contractSize * lot;
      if (riskAmount > 0) {
        rMult = parseFloat((actualPnl / riskAmount).toFixed(2));
      }
    }

    // Convert tradeDate from NY local datetime to UTC ISO
    const tradeDateISO = nyDateTimeToUTC(formData.tradeDate);
    const tradeDateObj = new Date(tradeDateISO); // Date object in UTC for session detection

    // Gunakan session dari form jika dipilih manual, fallback ke auto-detect
    const autoSession = detectSession(tradeDateObj);
    const session = formData.session && formData.session !== "AUTO" ? formData.session : autoSession;

    const resultApi = await tradeService.create({
      tradingAccountId: activeAccount.id,
      tradeDate: tradeDateISO,
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
      exitDate: formData.exitDate ? nyDateTimeToUTC(formData.exitDate) : undefined,
      session,
      riskPercent: riskPercent ?? undefined,
      rMultiple: rMult,
      marketCondition: formData.marketCondition && formData.marketCondition !== "" ? formData.marketCondition : undefined,
    });

    if (resultApi.success && resultApi.data) {
      const newTrade = resultApi.data as Trade;
      setTrades(prev => [newTrade, ...prev]);
      setShowForm(false);
      resetForm();

      // Trigger playbook assignment modal
      setCreatedTradeId(newTrade.id);
      setShowPlaybookModal(true);
    } else {
      alert(resultApi.error || "Failed to log trade to database");
    }
  };

  const resetForm = () => {
    setEntryPrice("");
    setStopLoss("");
    setTakeProfit("");
    setPair("");
    setLotSize("");
    setDirection("LONG");
    setPredictedR(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (riskWarning && !acknowledgeRisk) {
      alert("Anda harus menyetujui risiko ini sebelum melanjutkan. Silakan centang kotak persetujuan.");
      return;
    }

    const formData = new FormData(e.currentTarget);
    const data = {
      tradeDate: formData.get('tradeDate') as string,
      exitDate: formData.get('exitDate') as string,
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
      session: formData.get('session') as string,
      marketCondition: formData.get('marketCondition') as string,
    };

    if (editingTradeId) {
      await handleUpdate(editingTradeId, data);
    } else {
      await handleCreateTrade(data);
    }
  };

  const handleReviewAI = async (tradeId: string) => {
    try {
      setReviewLoading(prev => ({ ...prev, [tradeId]: true }));
      const result = await aiReviewService.generate(tradeId);
      if (result.success && result.data) {
        setSelectedReview(result.data);
      } else {
        alert(result.error || "Failed to get AI review");
      }
    } catch (err: any) {
      alert("An error occurred in the AI system");
    } finally {
      setReviewLoading(prev => ({ ...prev, [tradeId]: false }));
    }
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

  const filteredTrades = trades.filter(t => {
    // 1. Safety check
    if (!t) return false;

    // 2. Filter by status (win, loss, deleted, etc)
    const matchesStatus = selectedFilter === "all" 
      ? !t.isDeleted 
      : selectedFilter === "deleted" 
        ? t.isDeleted 
        : t.result.toLowerCase() === selectedFilter.toLowerCase() && !t.isDeleted;
    
    if (!matchesStatus) return false;

    // 3. Filter by date (if parameter exists) - compare based on New York local date
    if (dateFilter) {
      const tradeDateNY = formatToNYDateTimeLocal(t.tradeDate).split('T')[0];
      return tradeDateNY === dateFilter;
    }

    return true;
  });

  const totalPnl = Array.isArray(filteredTrades) ? filteredTrades.reduce((sum, t) => sum + t.pnl, 0) : 0;
  const winningTrades = Array.isArray(trades) ? trades.filter(t => t.result.toLowerCase() === "win" && !t.isDeleted) : [];
  const losingTrades = Array.isArray(trades) ? trades.filter(t => t.result.toLowerCase() === "loss" && !t.isDeleted) : [];
  const avgWin = winningTrades.length > 0
    ? winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length
    : 0;
  const avgLoss = losingTrades.length > 0
    ? losingTrades.reduce((sum, t) => sum + Math.abs(t.pnl), 0) / losingTrades.length
    : 0;

  const unassignedCount = trades.filter(t => !t.playbookId && !t.isDeleted).length;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700 pb-12">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-[0.1em]">Trade Journal</h1>
          <p className="text-sm text-text-secondary mt-1">Cycles of psychology, habits, and your absolute numbers</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn-gold flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add Trade</span>
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
        {["all", "win", "loss", "breakeven", "deleted"].map((filter) => (
          <button
            key={filter}
            onClick={() => setSelectedFilter(filter)}
            className={`px-4 py-2 text-[11px] font-bold uppercase tracking-[0.15em] rounded-lg transition-all ${
              selectedFilter === filter
                ? "bg-accent-gold text-bg-void"
                : "bg-bg-elevated text-text-secondary hover:text-accent-gold"
            }`}
          >
            {filter === "all" ? "All" : filter === "breakeven" ? "Breakeven" : filter === "win" ? "Win" : filter === "loss" ? "Loss" : "Deleted"}
          </button>
        ))}
      </div>

      {/* Date Filter Indicator */}
      {dateFilter && (
        <div className="flex items-center space-x-3 bg-accent-gold/10 border border-accent-gold/20 p-3 rounded-xl animate-in slide-in-from-left-4">
          <div className="flex items-center text-accent-gold">
            <Clock className="w-4 h-4 mr-2" />
            <span className="text-xs font-bold uppercase tracking-widest">Filter Tanggal: {dateFilter}</span>
          </div>
          <button 
            onClick={() => router.push('/log-trade')}
            className="text-[10px] bg-accent-gold text-bg-void px-2 py-0.5 rounded font-bold hover:brightness-110 transition-all uppercase"
          >
            Bersihkan Filter
          </button>
        </div>
      )}

      {/* Unassigned trades reminder */}
      {unassignedCount > 0 && (
        <div className="mb-4 p-3 bg-accent-gold/5 border border-accent-gold/20 rounded-lg">
          <p className="text-sm text-accent-gold font-medium">
            {unassignedCount} trade{unassignedCount > 1 ? 's' : ''} without playbook assignment
          </p>
        </div>
      )}

      {/* Trade Entries Table */}
      <div className="glass overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.01]">
                <th className="text-left p-4 text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em]">Pair</th>
                <th className="text-left p-4 text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em]">Date</th>
                <th className="text-left p-4 text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em]">Entry</th>
                <th className="text-left p-4 text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em]">Exit</th>
                <th className="text-left p-4 text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em]">Dur.</th>
                <th className="text-left p-4 text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em]">Direction</th>
                <th className="text-left p-4 text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em]">Playbook</th>
                <th className="text-right p-4 text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em]">Setup (Entry/SL/TP)</th>
                <th className="text-right p-4 text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em]">Size</th>
                <th className="text-right p-4 text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em]">Risk %</th>
                <th className="text-right p-4 text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em]">R-Ratio</th>
                <th className="text-right p-4 text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em]">Final P&L</th>
                <th className="text-center p-4 text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em]">Psychology</th>
                <th className="text-left p-4 text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em]">Data</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrades.length === 0 ? (
                <tr>
                  <td colSpan={14} className="p-8 text-center text-text-muted text-sm italic">
                    No execution records yet
                  </td>
                </tr>
              ) : filteredTrades.map((trade, idx) => {
                // Format dates in New York timezone
                const tradeDateNY = formatToNYDateTimeLocal(trade.tradeDate);
                const [datePart, entryTimePart] = tradeDateNY.split('T');
                const exitTimePart = trade.exitDate ? formatToNYDateTimeLocal(trade.exitDate).split('T')[1] : "-";
                const duration = calculateDuration(trade.tradeDate, trade.exitDate);

                return (
                  <tr key={idx} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                  {/* Pair */}
                  <td className="p-4">
                    <span className="font-mono font-bold text-text-primary text-sm">{trade.pair}</span>
                  </td>
                  {/* Date */}
                  <td className="p-4 text-xs font-mono text-text-primary">
                    {datePart}
                  </td>
                  {/* Entry Time */}
                  <td className="p-4 text-xs font-mono text-text-primary">
                    {entryTimePart}
                  </td>
                  {/* Exit Time */}
                  <td className="p-4 text-xs font-mono text-text-primary">
                    {exitTimePart}
                  </td>
                  {/* Duration */}
                  <td className="p-4 text-xs font-mono text-text-primary">
                    {duration}
                  </td>
                  {/* Direction */}
                  <td className="p-4">
                    <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded shadow-sm ${
                      trade.direction.toLowerCase() === "long"
                        ? "bg-data-profit/10 text-data-profit border border-data-profit/20"
                        : "bg-data-loss/10 text-data-loss border border-data-loss/20"
                    }`}>
                      {trade.direction}
                    </span>
                  </td>
                  {/* Playbook */}
                  <td className="p-4 text-left">
                    <div className="text-left">
                      {trade.playbookId ? (() => {
                        const pb = playbooks.find(p => p.id === trade.playbookId);
                        const displayName = pb?.name || trade.playbookName;
                        return displayName ? (
                          <span
                            className="text-xs text-accent-gold font-medium truncate block max-w-[120px]"
                            title={pb?.rules?.join('\n') || displayName}
                          >
                            {displayName}
                          </span>
                        ) : (
                          <span className="text-xs text-accent-gold/60 font-medium truncate block max-w-[120px]">
                            Assigned
                          </span>
                        );
                      })() : (
                        <span className="text-xs text-text-muted italic">Unassigned</span>
                      )}
                    </div>
                  </td>
                  {/* Setup */}
                  <td className="p-4 text-right">
                    <div className="flex flex-col text-xs font-mono">
                      <span className="text-text-primary">{trade.entryPrice}</span>
                      <span className={trade.result === "loss" ? "text-data-loss" : "text-text-muted"}>
                        SL: {trade.stopLoss}
                      </span>
                      {trade.takeProfit && (
                        <span className={trade.result === "win" ? "text-data-profit" : "text-text-muted"}>
                          TP: {trade.takeProfit}
                        </span>
                      )}
                    </div>
                  </td>
                  {/* Size */}
                  <td className="p-4 text-right font-mono text-sm text-text-primary">{trade.lotSize}</td>
                  {/* Risk % */}
                  <td className="p-4 text-right font-mono text-xs">
                    {trade.riskPercent ? (
                        <span className={trade.riskPercent > 2 ? "text-data-loss" : trade.riskPercent >= 1 ? "text-accent-gold" : "text-data-profit"}>
                          {trade.riskPercent.toFixed(2)}%
                        </span>
                    ) : (
                        <span className="text-text-muted">-</span>
                    )}
                  </td>
                  {/* R-Ratio */}
                  <td className="p-4 text-right font-mono text-xs">
                    {trade.rMultiple ? (
                        <span className="text-accent-gold">{trade.rMultiple}R</span>
                    ) : (
                        <span className="text-text-muted">-</span>
                    )}
                  </td>
                  {/* Final P&L */}
                  <td className="p-4 text-right font-mono text-sm font-bold">
                    <span className={trade.result.toLowerCase() === "win" ? "text-data-profit" : trade.result.toLowerCase() === "loss" ? "text-data-loss" : "text-text-secondary"}>
                      {trade.pnl > 0 ? "+" : ""}${trade.pnl.toFixed(2)}
                    </span>
                  </td>
                  {/* Psychology */}
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
                      <button
                        onClick={() => handleReviewAI(trade.id)}
                        className="text-text-muted hover:text-accent-gold transition-colors p-1 rounded-lg hover:bg-white/5"
                        title="Review with Gemini AI"
                      >
                        <Zap className={`w-4 h-4 ${reviewLoading[trade.id] ? 'animate-pulse text-accent-gold' : ''}`} />
                      </button>
                      {trade.chartLink ? (
                        <a href={trade.chartLink} target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-accent-gold transition-colors" title="View Chart Analysis">
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
                      {/* Edit button (only for non-deleted trades) */}
                      {!trade.isDeleted && (
                        <button
                          onClick={() => startEdit(trade)}
                          title="Edit trade"
                          className="text-text-muted hover:text-accent-gold transition-colors p-1 rounded-lg hover:bg-white/5"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {/* Delete/Restore button */}
                      {trade.isDeleted ? (
                        <button
                          onClick={() => handleRestore(trade.id)}
                          title="Restore trade"
                          className="text-text-muted hover:text-data-profit transition-colors p-1 rounded-lg hover:bg-white/5"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmTrade(trade)}
                          title="Delete trade"
                          className="text-text-muted hover:text-data-loss transition-colors p-1 rounded-lg hover:bg-white/5"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Review Modal */}
      {selectedReview && (
        <div className="fixed inset-0 bg-bg-void/80 backdrop-blur-md flex items-center justify-center z-[60] p-4">
          <div className="relative glass border border-accent-gold/20 rounded-2xl max-w-2xl w-full mx-auto shadow-[0_0_50px_rgba(212,175,55,0.1)] overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center px-6 py-5 border-b border-white/5 bg-accent-gold/5">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-accent-gold/10 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-accent-gold" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-text-primary tracking-wide">Elite AI Coach Analysis</h2>
                  <p className="text-[10px] text-accent-gold uppercase tracking-[0.2em] font-medium">Hunter Trades Intelligence</p>
                </div>
              </div>
              <button onClick={() => setSelectedReview(null)} className="p-2 rounded-lg text-text-muted hover:text-accent-gold hover:bg-accent-gold/10 transition-colors">
                ✕
              </button>
            </div>

            <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {/* Score & Summary */}
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1 pr-6">
                  <h3 className="text-sm font-bold text-accent-gold uppercase tracking-widest">Executive Summary</h3>
                  <p className="text-sm text-text-primary leading-relaxed italic border-l-2 border-accent-gold/30 pl-4 py-1">
                    "{selectedReview.summary}"
                  </p>
                </div>
                <div className="text-center bg-bg-elevated/50 p-4 rounded-2xl border border-white/5 min-w-[100px] shadow-lg">
                  <p className="text-[9px] text-text-secondary uppercase tracking-widest mb-1 font-bold">Execution Score</p>
                  <p className="text-4xl font-mono font-bold text-accent-gold">
                    {selectedReview.overallScore}<span className="text-xs text-text-muted">/10</span>
                  </p>
                </div>
              </div>

              {/* Strengths & Improvements */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-data-profit uppercase tracking-[0.2em] flex items-center">
                    <TrendingUp className="w-3 h-3 mr-2" /> Strengths
                  </h4>
                  <ul className="space-y-3">
                    {selectedReview.strengths.map((s, i) => (
                      <li key={i} className="text-xs text-text-secondary flex items-start">
                        <span className="text-data-profit mr-2">✦</span> {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-data-loss uppercase tracking-[0.2em] flex items-center">
                    <TrendingDown className="w-3 h-3 mr-2" /> Key Improvements
                  </h4>
                  <ul className="space-y-3">
                    {selectedReview.improvements.map((s, i) => (
                      <li key={i} className="text-xs text-text-secondary flex items-start">
                        <span className="text-data-loss mr-2">⌬</span> {s}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Risk Management Warning from AI */}
              {selectedReview.riskManagement && (
                <div className="bg-data-loss/5 border border-data-loss/20 p-5 rounded-xl animate-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 rounded-full bg-data-loss/20 flex items-center justify-center shrink-0">
                      <span className="text-data-loss text-sm">!</span>
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-data-loss uppercase tracking-wider mb-1">Risk Alert</h5>
                      <p className="text-xs text-text-secondary leading-relaxed">
                        {selectedReview.riskManagement}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Final Recommendation */}
              <div className="bg-bg-elevated/80 p-6 rounded-xl border border-accent-gold/10 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-2 opacity-5">
                   <Target className="w-20 h-20 text-accent-gold" />
                </div>
                <h4 className="text-[10px] font-bold text-accent-gold uppercase tracking-[0.2em] mb-3">Professional Recommendation</h4>
                <div className="space-y-2">
                    {selectedReview.recommendation ? (
                        <p className="text-xs text-text-primary leading-relaxed relative z-10">
                            {selectedReview.recommendation}
                        </p>
                    ) : (
                        <p className="text-xs text-text-muted italic">No specific recommendations provided.</p>
                    )}
                </div>
              </div>
            </div>

            <div className="p-4 bg-bg-void/50 border-t border-white/5 flex justify-end">
               <button
                onClick={() => setSelectedReview(null)}
                className="px-8 py-2 bg-accent-gold text-bg-void rounded-lg font-bold text-[11px] uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all"
               >
                 Close Analysis
               </button>
            </div>
          </div>
        </div>
      )}

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
                <h2 className="text-xl font-bold text-text-primary tracking-wide">
                  {editingTradeId ? "Edit Trade" : "Manual Logging Terminal"}
                </h2>
              </div>
              <div className="flex items-center space-x-2">
                {editingTradeId && (
                  <button type="button" onClick={cancelEdit} className="px-4 py-2 text-sm text-text-secondary hover:text-accent-gold border border-white/10 rounded-lg hover:bg-white/5 transition-colors">
                    Cancel
                  </button>
                )}
                <button onClick={() => { setShowForm(false); resetForm(); setEditingTradeId(null); }} className="p-2 rounded-lg text-text-muted hover:text-accent-gold hover:bg-accent-gold/10 transition-colors">
                  ✕
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-4 sm:p-6">

              {/* Risk Tier Warning Banner */}
              {riskWarning && (
                <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-data-loss/10 border border-data-loss/30 rounded-xl animate-in slide-in-from-top-2 duration-300">
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-data-loss/20 flex items-center justify-center shrink-0">
                      <span className="text-data-loss text-xs sm:text-sm">!</span>
                    </div>
                    <div className="flex-1">
                      <h5 className="text-xs sm:text-sm font-bold text-data-loss uppercase tracking-wider mb-1">Risk Tier Violation</h5>
                      <p className="text-xs sm:text-sm text-text-secondary">{riskWarning}</p>
                      <div className="mt-2 sm:mt-3 flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="acknowledgeRisk"
                          checked={acknowledgeRisk}
                          onChange={(e) => setAcknowledgeRisk(e.target.checked)}
                          className="w-5 h-5 rounded border-white/20 bg-bg-void text-data-loss focus:ring-data-loss/50"
                        />
                        <label htmlFor="acknowledgeRisk" className="text-xs sm:text-sm text-text-secondary">
                          Saya memahami risiko ini melampaui batas tier dan tetap ingin melanjutkan
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Dynamic Warning/Helper Zone */}
              <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center justify-between bg-white/[0.02] p-3 sm:p-4 rounded-xl border border-white/5">
                <p className="text-xs sm:text-sm text-text-secondary leading-relaxed mb-3 sm:mb-0 max-w-xl">
                  Discipline starts here. Calculate risk exposure, write your execution rationale before market movement erases traces of your pure technical analysis.
                </p>
                <div className="flex items-center space-x-4 sm:space-x-8">
                   {/* Risk % Badge */}
                   <div className="flex flex-col items-end">
                     <p className="text-[9px] sm:text-[10px] uppercase font-bold tracking-widest text-text-muted mb-1">Risk Exposure</p>
                     {riskPercent !== null ? (
                        <span className={`text-base sm:text-lg font-mono font-bold ${riskPercent > 2 ? "text-data-loss" : riskPercent >= 1 ? "text-accent-gold" : "text-data-profit"}`}>
                          {riskPercent}%
                        </span>
                     ) : (
                        <span className="text-sm font-mono text-text-muted">-</span>
                     )}
                   </div>
                   {/* Realtime RR Badge */}
                   <div className="flex flex-col items-end">
                      <p className="text-[9px] sm:text-[10px] uppercase font-bold tracking-widest text-text-muted mb-1">Estimated Reward/Risk</p>
                      {predictedR !== null ? (
                         <span className={`text-base sm:text-lg font-mono font-bold ${predictedR >= 2 ? "text-accent-gold" : predictedR >= 1 ? "text-data-profit" : "text-data-loss"}`}>
                           {predictedR} R
                         </span>
                      ) : (
                         <span className="text-sm font-mono text-text-muted">-</span>
                      )}
                   </div>
                </div>
              </div>

              {/* 2-Column Form Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">

                {/* Left Column: Core Technicals */}
                <div className="space-y-4 sm:space-y-5">
                  <h3 className="text-xs sm:text-sm font-bold text-accent-gold uppercase tracking-[0.2em] border-b border-white/5 pb-2">Market Execution</h3>

                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Instrument/Pair</label>
                      <select
                        name="pair"
                        required
                        value={pair}
                        onChange={(e) => setPair(e.target.value)}
                        className="w-full bg-bg-void/50 border border-white/10 rounded-lg px-3 py-2.5 text-text-primary font-mono text-sm focus:border-accent-gold focus:ring-1 focus:ring-accent-gold transition-all outline-none uppercase"
                      >
                         <option value="" disabled>Pilih Pair...</option>
                         {/* Fallback IF pair from DB is not in the list below */}
                         {pair && !["EURUSD","GBPUSD","USDJPY","AUDUSD","USDCAD","USDCHF","NZDUSD","EURJPY","GBPJPY","AUDJPY","EURAUD","GBPAUD","XAUUSD","XAGUSD","USOIL","UKOIL","US30","NAS100","SPX500","GER40","UK100","BTCUSD","BTCUSDT","ETHUSD","ETHUSDT","SOLUSD","SOLUSDT"].includes(pair) && (
                           <option value={pair}>{pair}</option>
                         )}
                         <optgroup label="Commodities">
                            <option value="XAUUSD">XAUUSD (Gold)</option>
                            <option value="XAGUSD">XAGUSD (Silver)</option>
                            <option value="USOIL">USOIL (WTI)</option>
                            <option value="UKOIL">UKOIL (Brent)</option>
                         </optgroup>
                         <optgroup label="Forex Major">
                            <option value="EURUSD">EURUSD</option>
                            <option value="GBPUSD">GBPUSD</option>
                            <option value="USDJPY">USDJPY</option>
                            <option value="AUDUSD">AUDUSD</option>
                            <option value="USDCAD">USDCAD</option>
                            <option value="USDCHF">USDCHF</option>
                            <option value="NZDUSD">NZDUSD</option>
                         </optgroup>
                         <optgroup label="Forex Minor">
                            <option value="EURJPY">EURJPY</option>
                            <option value="GBPJPY">GBPJPY</option>
                            <option value="AUDJPY">AUDJPY</option>
                            <option value="EURAUD">EURAUD</option>
                            <option value="GBPAUD">GBPAUD</option>
                         </optgroup>
                         <optgroup label="Indices">
                            <option value="US30">US30 (Dow Jones)</option>
                            <option value="NAS100">NAS100 (Nasdaq)</option>
                            <option value="SPX500">SPX500 (S&P 500)</option>
                            <option value="GER40">GER40 (DAX)</option>
                            <option value="UK100">UK100 (FTSE)</option>
                         </optgroup>
                         <optgroup label="Crypto">
                            <option value="BTCUSD">BTCUSD</option>
                            <option value="BTCUSDT">BTCUSDT</option>
                            <option value="ETHUSD">ETHUSD</option>
                            <option value="ETHUSDT">ETHUSDT</option>
                            <option value="SOLUSD">SOLUSD</option>
                            <option value="SOLUSDT">SOLUSDT</option>
                         </optgroup>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Transaction Direction</label>
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
                      <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Entry Price</label>
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
                      <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Lot Size</label>
                      <input
                        name="lotSize"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        required
                        value={lotSize}
                        onChange={(e) => setLotSize(e.target.value ? parseFloat(e.target.value) : "")}
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
                      <label className="text-[11px] font-bold text-data-profit uppercase tracking-wider">Take Profit <span className="text-text-muted lowercase">(optional)</span></label>
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
                      <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Actual Profit / Net P&L ($)</label>
                      <div className="relative">
                        <DollarSign className="w-4 h-4 text-text-muted absolute left-3 top-1/2 transform -translate-y-1/2" />
                        <input
                          name="actualPnl"
                          type="number"
                          step="any"
                          placeholder="Enter net value after broker commission"
                          required
                          defaultValue={editingTrade?.actualPnl?.toString() || ""}
                          className="w-full bg-bg-void/50 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-text-primary font-mono text-sm focus:border-accent-gold focus:ring-1 focus:ring-accent-gold transition-all outline-none"
                        />
                      </div>
                  </div>
                </div>

                {/* Right Column: Sentiment & Journalization */}
                <div className="space-y-5">
                  <h3 className="text-[11px] font-bold text-accent-gold uppercase tracking-[0.2em] border-b border-white/5 pb-2">Personal Analysis Journal</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Entry Time</label>
                      <input
                        name="tradeDate"
                        type="datetime-local"
                        required
                        defaultValue={editingTrade ? formatToNYDateTimeLocal(editingTrade.tradeDate) : formatToNYDateTimeLocal(new Date())}
                        className="w-full bg-bg-void/50 border border-white/10 rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-accent-gold transition-all outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider text-accent-gold">Exit Time <span className="text-text-muted lowercase">(for duration)</span></label>
                      <input
                        name="exitDate"
                        type="datetime-local"
                        defaultValue={editingTrade?.exitDate ? formatToNYDateTimeLocal(editingTrade.exitDate) : ""}
                        className="w-full bg-bg-void/50 border border-accent-gold/20 rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-accent-gold transition-all outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider flex justify-between">
                      <span>Chart URL / Screenshot Link</span>
                      <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer" className="text-accent-gold hover:underline lowercase tracking-normal">tradingview →</a>
                    </label>
                    <div className="relative">
                      <LinkIcon className="w-4 h-4 text-text-muted absolute left-3 top-1/2 transform -translate-y-1/2" />
                      <input
                        name="chartLink"
                        type="url"
                        placeholder="https://www.tradingview.com/x/..."
                        defaultValue={editingTrade?.chartLink || ""}
                        className="w-full bg-bg-void/50 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-text-primary text-sm focus:border-accent-gold focus:ring-1 focus:ring-accent-gold transition-all outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider flex justify-between items-center">
                      <span>Discipline & Mental State Evaluation</span>
                      <span className="text-[10px] text-text-muted tracking-normal">Scale 1 - 5</span>
                    </label>
                    <select name="emotionalState" required defaultValue={editingTrade?.emotionalState ? String(editingTrade.emotionalState) : undefined} className="w-full bg-bg-void/50 border border-white/10 rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-accent-gold focus:ring-1 focus:ring-accent-gold transition-all outline-none">
                      <option value="5">👑 Level 5 - Precision, Emotionless, Type-A Setup</option>
                      <option value="4">🎯 Level 4 - Following Plan Extremely Disciplined</option>
                      <option value="3">⚖️ Level 3 - Neutral, Fair Execution</option>
                      <option value="2">😰 Level 2 - Hesitant, Slightly Fear Of Missing Out (FOMO)</option>
                      <option value="1">💀 Level 1 - Gambling, Full Emotion, Violating SOP</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Trading Session</label>
                      <select
                        name="session"
                        defaultValue={editingTrade?.session || "AUTO"}
                        className="w-full bg-bg-void/50 border border-white/10 rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-accent-gold focus:ring-1 focus:ring-accent-gold transition-all outline-none"
                      >
                        <option value="AUTO">🕐 Auto-Detect</option>
                        <option value="Asia">🌏 Asia (05:00–08:00 UTC)</option>
                        <option value="London">🇬🇧 London (08:00–13:00 UTC)</option>
                        <option value="NY">🇺🇸 New York (13:00–21:00 UTC)</option>
                        <option value="Sydney">🇦🇺 Sydney (21:00–05:00 UTC)</option>
                        <option value="Other">🌐 Other / Overlap</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Market Condition</label>
                      <select
                        name="marketCondition"
                        defaultValue={editingTrade?.marketCondition || ""}
                        className="w-full bg-bg-void/50 border border-white/10 rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-accent-gold focus:ring-1 focus:ring-accent-gold transition-all outline-none"
                      >
                        <option value="">— Pilih Kondisi —</option>
                        <option value="TRENDING">📈 Trending</option>
                        <option value="RANGING">↔️ Ranging / Sideways</option>
                        <option value="VOLATILE">⚡ Volatile / News-Driven</option>
                        <option value="LIQUID">💧 Liquid / Low Spread</option>
                        <option value="ALL">🌐 General / ALL</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Review & Tactical Notes</label>
                    <textarea
                      name="notes"
                      rows={4}
                      placeholder="Apa alasan Anda mengambil risiko di harga ini? Apakah masuk karena berita, RSI divergence, atau institutional blockade?"
                      defaultValue={editingTrade?.notes || ""}
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
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || (!!riskWarning && !acknowledgeRisk)}
                  className="btn-gold font-bold uppercase tracking-widest text-sm px-8 py-2.5 animate-in flex items-center space-x-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingTradeId ? <Edit2 className="w-4 h-4" /> : null)}
                  <span>{editingTradeId ? "Update Trade" : "Log Trade"}</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmTrade && (
        <div className="fixed inset-0 bg-bg-void/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="relative glass border border-data-loss/30 rounded-2xl max-w-md w-full mx-auto shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-white/5 bg-data-loss/5">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-data-loss/20 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-data-loss" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-data-loss tracking-wide">Delete Trade</h2>
                  <p className="text-[10px] text-data-loss uppercase tracking-[0.2em] font-medium">Confirm deletion</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <p className="text-sm text-text-secondary">
                Are you sure you want to delete this trade? This action will archive the trade (soft delete) and can be restored later.
              </p>
              <div>
                <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-2">Reason (for audit)</label>
                <select
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  className="w-full bg-bg-void/50 border border-white/10 rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-data-loss focus:ring-1 focus:ring-data-loss transition-all outline-none"
                >
                  <option value="MT5 mismatch">MT5 mismatch</option>
                  <option value="Duplicate entry">Duplicate entry</option>
                  <option value="Test/demo trade">Test/demo trade</option>
                  <option value="Data entry error">Data entry error</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              {deleteReason === "Other" && (
                <div>
                  <label className="block text-[11px] font-bold text-text-secondary uppercase tracking-wider mb-2">Specify reason</label>
                  <input
                    type="text"
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    placeholder="Enter reason..."
                    className="w-full bg-bg-void/50 border border-white/10 rounded-lg px-3 py-2.5 text-text-primary text-sm focus:border-data-loss focus:ring-1 focus:ring-data-loss transition-all outline-none"
                  />
                </div>
              )}
            </div>
            <div className="p-4 bg-data-loss/5 border-t border-data-loss/10 flex justify-end space-x-3">
              <button
                onClick={() => setDeleteConfirmTrade(null)}
                className="px-6 py-2 text-sm font-bold text-text-secondary hover:text-text-primary border border-white/10 rounded-lg hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmTrade.id, deleteReason)}
                className="px-6 py-2 text-sm font-bold text-white bg-data-loss hover:bg-data-loss/80 rounded-lg transition-colors"
              >
                Delete Trade
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Playbook Assignment Modal */}
      <PlaybookAssignmentModal
        isOpen={showPlaybookModal}
        onClose={() => {
          setShowPlaybookModal(false);
          setCreatedTradeId(null);
        }}
        tradeId={createdTradeId || ""}
        onAssigned={(playbook) => {
          // Refresh trades to update any cached stats
          fetchTrades();
          setCreatedTradeId(null);
          setShowPlaybookModal(false);
        }}
        suggestedPlaybookIds={[]} // Could be populated with AI suggestions later
      />
    </div>
  );
}

export default function LogTradePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <LogTradePageInner />
    </Suspense>
  );
}
