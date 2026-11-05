"use client";

import { useEffect, useState } from "react";
import {
  Brain,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Lightbulb,
  BarChart3,
  Clock,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  aiCoachService,
  EMOTION_COLORS,
  type EmotionTag,
  type EmotionDistribution,
  type TimeOfDayHeatmap,
  type AIAnalysisResult,
  type SessionDistribution,
} from "@/services/ai-coach.service";
import { toast } from "sonner";

type Period = "week" | "month";

export function AIAnalysisSection() {
  const [period, setPeriod] = useState<Period>("week");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [emotionDistribution, setEmotionDistribution] = useState<EmotionDistribution[]>([]);
  const [heatmap, setHeatmap] = useState<TimeOfDayHeatmap[]>([]);
  const [sessionDist, setSessionDist] = useState<SessionDistribution>({});
  const [showAllActions, setShowAllActions] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [analysisRes, emotionRes, heatmapRes, sessionRes] = await Promise.all([
        aiCoachService.analyze(period),
        aiCoachService.getEmotionDistribution(period),
        aiCoachService.getTimeOfDayHeatmap(period),
        aiCoachService.getSessionDistribution(period),
      ]);

      if (analysisRes.success && analysisRes.data) {
        setAnalysis(analysisRes.data);
      }
      if (emotionRes.success && emotionRes.data) {
        setEmotionDistribution(emotionRes.data);
      }
      if (heatmapRes.success && heatmapRes.data) {
        setHeatmap(heatmapRes.data);
      }
      if (sessionRes.success && sessionRes.data) {
        setSessionDist(sessionRes.data);
      }
    } catch (err: any) {
      toast.error("Gagal memuat data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [period]);

  // Prepare pie chart data
  const pieData = emotionDistribution.map((ed) => ({
    name: ed.tag,
    value: ed.count,
    pnl: ed.totalPnL,
    winRate: ed.winRate,
  }));

  // Prepare bar chart data: PnL by emotion
  const barData = emotionDistribution.map((ed) => ({
    tag: ed.tag,
    pnl: ed.totalPnL,
    avgR: ed.avgRMultiple,
  }));

  // Prepare heatmap data for bar chart
  const heatmapBarData = Array.from({ length: 24 }, (_, hour) => {
    const hourData = heatmap.filter((h) => h.hour === hour);
    return {
      hour: `${hour.toString().padStart(2, "0")}:00`,
      total: hourData.reduce((sum, h) => sum + h.count, 0),
    };
  });

  // Session bar data
  const sessionBarData = Object.entries(sessionDist).map(([session, count]) => ({
    session,
    count,
  }));

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "text-data-loss bg-data-loss/10 border-data-loss/30";
      case "medium":
        return "text-data-warning bg-data-warning/10 border-data-warning/30";
      case "low":
        return "text-data-profit bg-data-profit/10 border-data-profit/30";
      default:
        return "text-text-muted bg-white/5 border-border-subtle";
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "high":
        return "🔴";
      case "medium":
        return "🟡";
      case "low":
        return "🟢";
      default:
        return "⚪";
    }
  };

  const displayedActions = showAllActions
    ? analysis?.actionItems || []
    : (analysis?.actionItems || []).slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Header + Period Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-accent-gold/10 rounded-lg">
            <Brain className="w-5 h-5 text-accent-gold" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-text-primary">Analisis Psikologi Trading</h2>
            <p className="text-[11px] text-text-muted">AI-powered insight berdasarkan emosi & data trade</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex bg-bg-void/50 border border-border-subtle rounded-lg overflow-hidden">
            <button
              onClick={() => setPeriod("week")}
              className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                period === "week"
                  ? "bg-accent-gold text-bg-void"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              Minggu
            </button>
            <button
              onClick={() => setPeriod("month")}
              className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                period === "month"
                  ? "bg-accent-gold text-bg-void"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              Bulan
            </button>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 text-text-muted hover:text-accent-gold transition-colors disabled:opacity-40"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {loading && !analysis ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-accent-gold animate-spin" />
          <span className="ml-3 text-text-muted">AI sedang menganalisis data emosi...</span>
        </div>
      ) : (
        <>
          {/* AI Summary Card */}
          {analysis && (
            <div className="glass p-6 border-l-4 border-accent-gold">
              <h3 className="text-sm font-bold text-accent-gold mb-2 uppercase tracking-wider">
                Ringkasan AI
              </h3>
              <p className="text-sm text-text-primary leading-relaxed">{analysis.summary}</p>
            </div>
          )}

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Emotion Distribution Pie */}
            <div className="glass p-5">
              <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-4 flex items-center">
                <BarChart3 className="w-4 h-4 mr-2 text-accent-gold" />
                Distribusi Emosi
              </h3>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={40}
                      paddingAngle={3}
                    >
                      {pieData.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={EMOTION_COLORS[entry.name as EmotionTag] || "#666"}
                          stroke="transparent"
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1a1a2e",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                        fontSize: "12px",
                        color: "#fff",
                      }}
                      formatter={(value: any, name: any) => [`${value}x`, name]}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(value: string) => (
                        <span style={{ color: "#95A5A6", fontSize: "10px" }}>{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[220px] text-text-muted text-sm">
                  Belum ada data emosi
                </div>
              )}
            </div>

            {/* PnL by Emotion Bar */}
            <div className="glass p-5">
              <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-4 flex items-center">
                <TrendingUp className="w-4 h-4 mr-2 text-accent-gold" />
                PnL per Emosi
              </h3>
              {barData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis
                      dataKey="tag"
                      tick={{ fill: "#95A5A6", fontSize: 10 }}
                      axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                    />
                    <YAxis
                      tick={{ fill: "#95A5A6", fontSize: 10 }}
                      axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1a1a2e",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                        fontSize: "12px",
                        color: "#fff",
                      }}
                      formatter={(value: any) => [`$${value.toFixed(2)}`, "PnL"]}
                    />
                    <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                      {barData.map((entry) => (
                        <Cell
                          key={entry.tag}
                          fill={
                            entry.pnl >= 0
                              ? EMOTION_COLORS[entry.tag as EmotionTag] || "#2ECC71"
                              : "#FF3333"
                          }
                          fillOpacity={0.8}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[220px] text-text-muted text-sm">
                  Belum ada data
                </div>
              )}
            </div>

            {/* Time of Day Heatmap */}
            <div className="glass p-5">
              <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-4 flex items-center">
                <Clock className="w-4 h-4 mr-2 text-accent-gold" />
                Aktivitas per Jam
              </h3>
              {heatmapBarData.some((h) => h.total > 0) ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={heatmapBarData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis
                      dataKey="hour"
                      tick={{ fill: "#95A5A6", fontSize: 9 }}
                      axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                      interval={2}
                    />
                    <YAxis
                      tick={{ fill: "#95A5A6", fontSize: 10 }}
                      axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1a1a2e",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                        fontSize: "12px",
                        color: "#fff",
                      }}
                    />
                    <Bar dataKey="total" fill="#D4AF37" radius={[4, 4, 0, 0]} fillOpacity={0.7} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[220px] text-text-muted text-sm">
                  Belum ada data
                </div>
              )}
            </div>
          </div>

          {/* Strengths & Weaknesses */}
          {analysis && (analysis.strengths.length > 0 || analysis.weaknesses.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {analysis.strengths.length > 0 && (
                <div className="glass p-5 border border-data-profit/20">
                  <h3 className="text-sm font-bold text-data-profit mb-4 flex items-center">
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Kekuatan
                  </h3>
                  <ul className="space-y-2">
                    {analysis.strengths.map((s, i) => (
                      <li key={i} className="flex items-start text-sm text-text-secondary">
                        <span className="text-data-profit mr-2 mt-0.5">✓</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {analysis.weaknesses.length > 0 && (
                <div className="glass p-5 border border-data-loss/20">
                  <h3 className="text-sm font-bold text-data-loss mb-4 flex items-center">
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Perlu Diperbaiki
                  </h3>
                  <ul className="space-y-2">
                    {analysis.weaknesses.map((w, i) => (
                      <li key={i} className="flex items-start text-sm text-text-secondary">
                        <span className="text-data-loss mr-2 mt-0.5">!</span>
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Action Items */}
          {analysis && analysis.actionItems.length > 0 && (
            <div className="glass p-5 border border-accent-gold/20">
              <h3 className="text-sm font-bold text-accent-gold mb-4 flex items-center">
                <Lightbulb className="w-4 h-4 mr-2" />
                Aksi Konkret yang Harus Dilakukan
              </h3>
              <div className="space-y-3">
                {displayedActions.map((item, i) => (
                  <div
                    key={i}
                    className={`p-4 rounded-lg border ${getPriorityColor(item.priority)}`}
                  >
                    <div className="flex items-start space-x-3">
                      <span className="text-lg mt-0.5">{getPriorityIcon(item.priority)}</span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-text-primary">{item.action}</p>
                        <p className="text-xs text-text-muted mt-1">{item.reason}</p>
                      </div>
                      <span
                        className={`text-[9px] font-bold uppercase px-2 py-1 rounded ${getPriorityColor(
                          item.priority
                        )}`}
                      >
                        {item.priority}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {analysis.actionItems.length > 3 && (
                <button
                  onClick={() => setShowAllActions(!showAllActions)}
                  className="mt-3 text-xs text-accent-gold hover:text-accent-gold/80 flex items-center space-x-1 mx-auto"
                >
                  {showAllActions ? (
                    <>
                      <ChevronUp className="w-3 h-3" />
                      <span>Tampilkan lebih sedikit</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3 h-3" />
                      <span>Lihat semua {analysis.actionItems.length} aksi</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}