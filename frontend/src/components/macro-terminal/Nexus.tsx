"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useMacroTerminal } from "@/components/macro-terminal/MacroTerminalContext";
import {
  Building2,
  Droplets,
  TrendingUp,
  AlertOctagon,
  LineChart,
  DollarSign,
  Activity,
  BarChart3,
  Zap,
  Terminal,
  Cpu,
  RefreshCw,
  Layers,
  Gem,
  Globe,
  Shield,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface RrpState {
  value: number;
  delta: number;
}

interface TgaState {
  value: number;
  delta: number;
}

interface CrudeOilState {
  value: number;
  delta: number;
}

interface FedPolicyState {
  status: "Transition" | "Tightening" | "Easing";
}

interface InflationProxyState {
  value: number;
  delta: number;
}

interface DxyState {
  value: number;
  delta: number;
}

interface RealYieldsState {
  value: number;
  delta: number;
}

interface VixState {
  value: number;
}

interface YieldCurveState {
  status: string;
  spread: number;
}

interface RiskAssetsState {
  value: number;
  delta: number;
}

interface CommoditiesState {
  value: number;
  delta: number;
}

interface GoldState {
  value: number;
  delta: number;
}

interface EmRiskOnState {
  value: number;
  delta: number;
}

interface RiskOffFxState {
  value: number;
  delta: number;
}

interface MacroState {
  rrp: RrpState;
  tga: TgaState;
  crude_oil: CrudeOilState;
  fed_policy: FedPolicyState;
  inflation_proxy: InflationProxyState;
  dxy: DxyState;
  real_yields: RealYieldsState;
  vix: VixState;
  yield_curve: YieldCurveState;
  risk_assets: RiskAssetsState;
  commodities: CommoditiesState;
  gold: GoldState;
  em_risk_on: EmRiskOnState;
  risk_off_fx: RiskOffFxState;
}

interface NodeConfig {
  key: string;
  label: string;
  x: number;
  y: number;
  icon: React.ElementType;
  zone: 1 | 2 | 3;
}

interface EdgeConfig {
  from: string;
  to: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT / MOCK STATE (fallback seed + placeholder values)
// ─────────────────────────────────────────────────────────────────────────────
const createMockState = (): MacroState => ({
  rrp: { value: 582.3, delta: -12.4 },
  tga: { value: 721.5, delta: 34.2 },
  crude_oil: { value: 78.42, delta: 1.23 },
  fed_policy: { status: "Transition" },
  inflation_proxy: { value: 2.31, delta: -0.08 },
  dxy: { value: 104.18, delta: -0.34 },
  real_yields: { value: 2.14, delta: -0.05 },
  vix: { value: 14.8 },
  yield_curve: { status: "Normal", spread: 28 },
  risk_assets: { value: 528.7, delta: 1.42 },
  commodities: { value: 274.5, delta: 0.45 },
  gold: { value: 2350.4, delta: 0.12 },
  em_risk_on: { value: 0.32, delta: 0.32 },
  risk_off_fx: { value: -0.05, delta: -0.05 },
});

// ─────────────────────────────────────────────────────────────────────────────
// GLOW LOGIC
// ─────────────────────────────────────────────────────────────────────────────
function getNodeColor(state: MacroState, nodeKey: string): string {
  switch (nodeKey) {
    case "liq":
      return state.rrp.delta < 0 ? "#22c55e" : state.rrp.delta > 0 ? "#ef4444" : "#64748b";
    case "tga":
      return state.tga.delta < 0 ? "#22c55e" : state.tga.delta > 0 ? "#ef4444" : "#64748b";
    case "oil":
      return state.crude_oil.delta > 0 ? "#ef4444" : state.crude_oil.delta < 0 ? "#22c55e" : "#64748b";
    case "fed":
      if (state.fed_policy.status === "Tightening") return "#ef4444";
      if (state.fed_policy.status === "Easing") return "#22c55e";
      return "#3b82f6";
    case "inf":
      if (state.inflation_proxy.value > 2.5 || state.inflation_proxy.delta > 0) return "#ef4444";
      if (state.inflation_proxy.delta < 0) return "#22c55e";
      return "#f59e0b";
    case "dxy":
      return state.dxy.delta > 0 ? "#ef4444" : state.dxy.delta < 0 ? "#22c55e" : "#64748b";
    case "ry":
      if (state.real_yields.value > 0 && state.real_yields.delta > 0) return "#a855f7";
      if (state.real_yields.delta < 0) return "#f59e0b";
      return "#64748b";
    case "vix":
      if (state.vix.value < 15) return "#22c55e";
      if (state.vix.value <= 25) return "#f97316";
      return "#ef4444";
    case "yc":
      if (state.yield_curve.status.toLowerCase().includes("bull")) return "#22c55e";
      if (state.yield_curve.status.toLowerCase().includes("bear")) return "#ef4444";
      return "#3b82f6";
    case "eq":
      return state.risk_assets.delta > 0 ? "#22c55e" : state.risk_assets.delta < 0 ? "#ef4444" : "#64748b";
    case "commodities":
      return state.commodities.delta > 0 ? "#ef4444" : state.commodities.delta < 0 ? "#22c55e" : "#f97316";
    case "gold":
      return state.gold.delta > 0 ? "#f59e0b" : state.gold.delta < 0 ? "#ef4444" : "#eab308";
    case "em_risk_on":
      return state.em_risk_on.delta > 0 ? "#22c55e" : state.em_risk_on.delta < 0 ? "#ef4444" : "#64748b";
    case "risk_off_fx":
      return state.risk_off_fx.delta > 0 ? "#3b82f6" : state.risk_off_fx.delta < 0 ? "#a855f7" : "#6366f1";
    default:
      return "#64748b";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NODE CONFIG (14 nodes, 5-row × 3-col grid)
// ─────────────────────────────────────────────────────────────────────────────
const NODES: NodeConfig[] = [
  // ROW 1
  { key: "liq", label: "LIQUIDITY (RRP)", x: 25, y: 8, icon: Droplets, zone: 1 },
  { key: "fed", label: "FEDERAL RESERVE", x: 50, y: 8, icon: Building2, zone: 2 },
  { key: "yc", label: "YIELD CURVE", x: 75, y: 8, icon: TrendingUp, zone: 3 },

  // ROW 2
  { key: "tga", label: "TREASURY DEP", x: 25, y: 16, icon: BarChart3, zone: 1 },
  { key: "inf", label: "INFLATION PROXY", x: 50, y: 16, icon: LineChart, zone: 2 },
  { key: "eq", label: "RISK ASSETS", x: 75, y: 16, icon: TrendingUp, zone: 3 },

  // ROW 3
  { key: "oil", label: "ENERGY / CRUDE OIL", x: 25, y: 24, icon: Zap, zone: 1 },
  { key: "dxy", label: "US DOLLAR", x: 50, y: 24, icon: DollarSign, zone: 2 },
  { key: "em_risk_on", label: "EM CURRENCIES (RISK-ON)", x: 75, y: 24, icon: Globe, zone: 3 },

  // ROW 4
  { key: "commodities", label: "COMMODITIES (CRB)", x: 25, y: 32, icon: Layers, zone: 1 },
  { key: "ry", label: "REAL YIELDS (10Y)", x: 50, y: 32, icon: Activity, zone: 2 },
  { key: "gold", label: "GOLD (XAU)", x: 75, y: 32, icon: Gem, zone: 3 },

  // ROW 5
  { key: "vix", label: "MARKET FEAR (VIX)", x: 50, y: 40, icon: AlertOctagon, zone: 2 },
  { key: "risk_off_fx", label: "RISK-OFF FX (JPY/CHF)", x: 75, y: 40, icon: Globe, zone: 3 },
];

const EDGES: EdgeConfig[] = [
  // ── ZONA 1 → ZONA 2: Market Drivers feed into Policy ──
  ["oil", "inf"],    // Energy/Crude → Inflation Proxy
  ["liq", "fed"],    // RRP/Liquidity → Federal Reserve
  ["tga", "fed"],    // TGA → Federal Reserve
  ["tga", "dxy"],    // TGA issuance → US Dollar strength

  // ── ZONA 2: Internal policy causal flow ──
  ["inf", "fed"],    // Inflation → Fed policy response
  ["inf", "yc"],     // Inflation expectations → Yield Curve shape
  ["fed", "ry"],     // Fed policy → Real Yields (transmission)
  ["fed", "yc"],     // Fed policy → Yield Curve (primary driver)

  // ── ZONA 1 → ZONA 3: Commodities & Gold drivers ──
  ["inf", "commodities"],  // Inflation → Commodities (positive correlation)
  ["dxy", "commodities"],  // USD → Commodities (negative correlation)
  ["ry", "gold"],          // Real Yields → Gold (inverse relationship)
  ["dxy", "gold"],         // USD → Gold (inverse relationship)

  // ── ZONA 2 → ZONA 3: Transmission to Capital Markets ──
  ["ry", "eq"],      // Real Yields → Risk Assets (inverse correlation)
  ["dxy", "eq"],     // US Dollar → Risk Assets (inverse correlation)
  ["vix", "eq"],     // Market Fear → Risk Assets
  ["yc", "eq"],      // Yield Curve → Risk Assets (growth expectations)
  ["eq", "em_risk_on"],   // Risk Assets → EM Currencies (positive correlation)
  ["vix", "risk_off_fx"], // Market Fear → Risk-Off FX (positive correlation)
];

// ─────────────────────────────────────────────────────────────────────────────
// SVG EDGE COMPONENT (Orthogonal / Step-style wiring panel)
// ─────────────────────────────────────────────────────────────────────────────
function CableEdge({
  x1,
  y1,
  x2,
  y2,
  color,
  active,
  sourceOffsetY = 0,
  targetOffsetY = 0,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  active: boolean;
  sourceOffsetY?: number;
  targetOffsetY?: number;
}) {
  const sy1 = y1 + sourceOffsetY;
  const ty2 = y2 + targetOffsetY;
  const midX = x1 + (x2 - x1) / 2;
  const pathD = `M ${x1},${sy1} L ${midX},${sy1} L ${midX},${ty2} L ${x2},${ty2}`;

  return (
    <g>
      {/* faint base line */}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeOpacity="0.07"
        vectorEffect="non-scaling-stroke"
      />
      {/* main visible dashed path */}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeOpacity={active ? "0.5" : "0.15"}
        strokeDasharray="5 9"
        vectorEffect="non-scaling-stroke"
      />
      {/* animated flowing dash */}
      {active && (
        <motion.path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="4 16"
          vectorEffect="non-scaling-stroke"
          initial={{ strokeDashoffset: 40 }}
          animate={{ strokeDashoffset: 0 }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
          style={{ filter: `drop-shadow(0 0 4px ${color}88)` }}
        />
      )}
    </g>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function Nexus() {
  // ── 1. CONTEXT ─────────────────────────────────────────────────────────
  const { assets, liquidity, currentRegime } = useMacroTerminal();

  // ── 2. LOCAL STATE ─────────────────────────────────────────────────────
  const [macroState, setMacroState] = useState<MacroState>(createMockState);
  const [tgaLoaded, setTgaLoaded] = useState(false);
  const [oilLoaded, setOilLoaded] = useState(false);
  const [quantLoaded, setQuantLoaded] = useState(false);
  const [nexusReasoning, setNexusReasoning] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [displayedReasoning, setDisplayedReasoning] = useState<string>("");

  // ── 3a. FETCH: Quant Snapshot (VIX + Yield Curve + Real Yields) ────────
  useEffect(() => {
    let cancelled = false;
    async function fetchQuant() {
      try {
        const res = await fetch("/api/v1/quant/snapshot");
        const json = await res.json();
        if (!cancelled && res.ok && json.success) {
          const d = json.data;
          setMacroState((prev) => {
            const nxt = { ...prev };
            if (d.vix != null) nxt.vix = { value: d.vix };
            if (d.spread10y2y != null) {
              nxt.yield_curve = {
                status: d.inverted ? "Inverted" : "Normal",
                spread: d.spread10y2y,
              };
            }
            if (d.y10 != null) {
              const tip = assets.find((a) => a.ticker === "TIP")?.change ?? 0;
              const gld = assets.find((a) => a.ticker === "GLD")?.change ?? 0;
              const infDelta = (tip + gld) / 2;
              nxt.real_yields = { value: d.y10 - infDelta, delta: prev.real_yields.delta };
            }
            return nxt;
          });
          setQuantLoaded(true);
        }
      } catch {
        if (!cancelled) setQuantLoaded(true);
      }
    }
    fetchQuant();
    return () => {
      cancelled = true;
    };
  }, [assets]);

  // ── Typing animation effect ──────────────────────────────────────────
  useEffect(() => {
    if (!nexusReasoning) {
      setDisplayedReasoning("");
      return;
    }
    let i = 0;
    const speed = 15;
    const timer = setInterval(() => {
      setDisplayedReasoning(nexusReasoning.slice(0, i));
      i++;
      if (i > nexusReasoning.length) clearInterval(timer);
    }, speed);
    return () => clearInterval(timer);
  }, [nexusReasoning]);

  const fetchNexusAnalysis = async () => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    setNexusReasoning(null);
    setDisplayedReasoning("");
    try {
      const res = await fetch("/api/v1/macro-ai/analyze-nexus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodesData: nodeMap }),
      });
      const data = await res.json();
      if (data.success) setNexusReasoning(data.reasoning);
      else setNexusReasoning("Gagal mendapatkan analisis: " + data.error);
    } catch (err: any) {
      setNexusReasoning("Terjadi kesalahan saat memanggil AI: " + err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ── 3b. FETCH: TGA (Treasury General Account) ──────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function fetchTga() {
      try {
        const res = await fetch("/api/v1/market-data/tga");
        const json = await res.json();
        if (!cancelled && res.ok && json.success && json.data) {
          setMacroState((prev) => ({
            ...prev,
            tga: { value: json.data.value, delta: json.data.delta },
          }));
          setTgaLoaded(true);
        }
      } catch {
        if (!cancelled) setTgaLoaded(true);
      }
    }
    fetchTga();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── 3c. FETCH: Crude Oil (CL=F via Finnhub quotes) ─────────────────────
  useEffect(() => {
    let cancelled = false;
    async function fetchOil() {
      try {
        const res = await fetch("/api/v1/market-data/quotes?symbols=CL=F");
        const json = await res.json();
        if (!cancelled) {
          if (res.ok && json.success && json.data?.[0]?.data?.dp != null) {
            const dp = json.data[0].data.dp;
            setMacroState((prev) => ({
              ...prev,
              crude_oil: {
                value: prev.crude_oil.value,
                delta: dp,
              },
            }));
          }
          setOilLoaded(true);
        }
      } catch {
        if (!cancelled) setOilLoaded(true);
      }
    }
    fetchOil();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── 3d. HYBRID: Map Context → MacroState (RRP, Fed, Assets) ────────────
  useEffect(() => {
    if (!liquidity) return;

    const spy = assets.find((a) => a.ticker === "SPY")?.change ?? 0;
    const uup = assets.find((a) => a.ticker === "UUP")?.change ?? 0;
    const tip = assets.find((a) => a.ticker === "TIP")?.change ?? 0;
    const gld = assets.find((a) => a.ticker === "GLD")?.change ?? 0;
    const inflationProxy = (tip + gld) / 2;

    const regimeMap: Record<string, "Transition" | "Tightening" | "Easing"> = {
      Goldilocks: "Transition",
      Reflation: "Easing",
      Stagflation: "Tightening",
      Deflation: "Transition",
      Transition: "Transition",
    };
    const fedStatus = currentRegime ? regimeMap[currentRegime] || "Transition" : "Transition";

    setMacroState((prev) => ({
      ...prev,
      rrp: {
        value: liquidity.value,
        delta: liquidity.change,
      },
      fed_policy: { status: fedStatus },
      inflation_proxy: {
        value: inflationProxy,
        delta: inflationProxy,
      },
      dxy: {
        value: prev.dxy.value,
        delta: uup,
      },
      risk_assets: {
        value: prev.risk_assets.value,
        delta: spy,
      },
    }));
  }, [liquidity, assets, currentRegime]);

  // ── 4. FALLBACK SIMULATION (auto-terminates when API ready) ────────────
  const isApiReady = tgaLoaded && oilLoaded && quantLoaded;

  useEffect(() => {
    console.log("🔍 API Loading Status:", { tgaLoaded, oilLoaded, quantLoaded, isApiReady });
  }, [tgaLoaded, oilLoaded, quantLoaded, isApiReady]);

  useEffect(() => {
    // GUARD UTAMA: Jika semua API sudah ready, matikan interval & jangan jalankan lagi!
    if (isApiReady) {
      return;
    }

    const placeholderInterval = setInterval(() => {
      // DOUBLE CHECK GUARD: Cegah mutasi jika di tengah jalan API mendadak ready
      if (tgaLoaded && oilLoaded && quantLoaded) {
        clearInterval(placeholderInterval);
        return;
      }

      // Jalankan simulasi hanya pada node yang belum loaded
      setMacroState((prev) => ({
        ...prev,
        crude_oil: oilLoaded ? prev.crude_oil : {
          value: prev.crude_oil.value + (Math.random() - 0.5) * 0.2,
          delta: prev.crude_oil.delta,
        },
        tga: tgaLoaded ? prev.tga : {
          value: prev.tga.value + (Math.random() - 0.5) * 5,
          delta: prev.tga.delta,
        },
        vix: quantLoaded ? prev.vix : {
          value: Math.max(9, Math.min(45, prev.vix.value + (Math.random() - 0.5) * 0.8)),
        },
        yield_curve: quantLoaded ? prev.yield_curve : prev.yield_curve,
        real_yields: quantLoaded ? prev.real_yields : {
          value: Math.max(-0.5, Math.min(3.5, prev.real_yields.value + (Math.random() - 0.5) * 0.1)),
          delta: prev.real_yields.delta,
        },
        dxy: { ...prev.dxy, delta: prev.dxy.delta + (Math.random() - 0.5) * 0.2 },
        risk_assets: { ...prev.risk_assets, delta: prev.risk_assets.delta + (Math.random() - 0.5) * 0.3 },
        rrp: {
          value: prev.rrp.value + (Math.random() - 0.58) * 5,
          delta: prev.rrp.delta,
        },
        inflation_proxy: {
          value: Math.max(0.8, Math.min(4.5, prev.inflation_proxy.value + (Math.random() - 0.55) * 0.08)),
          delta: prev.inflation_proxy.delta,
        },
      }));
    }, 1500);

    return () => clearInterval(placeholderInterval);
  }, [tgaLoaded, oilLoaded, quantLoaded, isApiReady]);

  // ── 5. DERIVED DATA ────────────────────────────────────────────────────
  const nodeMap = useMemo(() => {
    const map: Record<string, { x: number; y: number; color: string; icon: React.ElementType; label: string }> = {};
    NODES.forEach((n) => {
      map[n.key] = {
        x: n.x,
        y: n.y,
        color: getNodeColor(macroState, n.key),
        icon: n.icon,
        label: n.label,
      };
    });
    return map;
  }, [macroState]);

  const edges = useMemo(() => {
    const raw: Array<{ from: string; to: string; x1: number; y1: number; x2: number; y2: number; color: string }> = [];
    EDGES.forEach(([from, to]) => {
      const a = nodeMap[from];
      const b = nodeMap[to];
      if (!a || !b) return;
      raw.push({ from, to, x1: a.x, y1: a.y, x2: b.x, y2: b.y, color: a.color });
    });

    const targetFan: Record<string, { count: number; index: number }> = {};
    const sourceFan: Record<string, { count: number; index: number }> = {};

    raw.forEach((e) => {
      targetFan[e.to] = targetFan[e.to] || { count: 0, index: 0 };
      targetFan[e.to].count++;
      sourceFan[e.from] = sourceFan[e.from] || { count: 0, index: 0 };
      sourceFan[e.from].count++;
    });

    return raw.map((e) => {
      const tf = targetFan[e.to];
      const sf = sourceFan[e.from];
      const tIdx = tf.index++;
      const sIdx = sf.index++;

      const spread = 1.2;
      const targetOffsetY = (tIdx - (tf.count - 1) / 2) * spread;
      const sourceOffsetY = (sIdx - (sf.count - 1) / 2) * spread;

      return {
        ...e,
        targetOffsetY,
        sourceOffsetY,
      };
    });
  }, [nodeMap]);

  // ── 6. RENDER ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-2">
      {/* ── DIAGRAM CONTAINER ───────────────────────────────────── */}
      <div className="relative w-full min-h-[320px] glass border border-border-subtle rounded-2xl bg-bg-void overflow-hidden">
        {/* dot grid */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.06]"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(212,175,55,0.4) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        {/* Header */}
        <div className="absolute top-3 left-4 right-4 z-20 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[10px] sm:text-xs font-mono font-bold text-text-primary uppercase tracking-[0.2em] flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-accent-gold" />
              Macro Causal Loop
            </h2>
            <p className="text-[9px] font-mono text-text-muted mt-1 max-w-md leading-relaxed">
              Institutional flow: Liquidity → Policy → Yield → Risk Assets
            </p>
            <span className={`text-[9px] font-mono font-bold ${isApiReady ? "text-emerald-400" : "text-amber-500 animate-pulse"}`}>
              SOURCES: {isApiReady ? "LIVE MACRO TERMINAL API" : "SIMULATED FALLBACK"}
            </span>
          </div>
          <button
            onClick={fetchNexusAnalysis}
            disabled={isAnalyzing}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[9px] font-mono font-bold uppercase tracking-wider rounded-lg border border-accent-gold/40 bg-accent-gold/10 text-accent-gold hover:bg-accent-gold/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_10px_rgba(245,158,11,0.1)] shrink-0"
          >
            {isAnalyzing ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <Cpu className="w-3 h-3" />
            )}
            Analyze Flow
          </button>
        </div>

        {/* Zone Bottom Labels */}
        <div className="absolute bottom-4 left-0 right-0 z-10 flex justify-around pointer-events-none px-8">
          {[
            { label: "ZONA 1 // LIQUIDITY DRIVERS", x: "25%" },
            { label: "ZONA 2 // POLICY TRANSFORMERS", x: "50%" },
            { label: "ZONA 3 // CAPITAL DESTINATION", x: "75%" },
          ].map(({ label, x }) => (
            <div
              key={label}
              className="flex flex-col items-center"
              style={{ position: "absolute", left: x, bottom: "2rem", transform: "translateX(-50%)" }}
            >
              <span className="text-zinc-500 text-[8px] font-mono tracking-[0.25em] uppercase">{label}</span>
              <div className="mt-0.5 flex items-center gap-1">
                <span className="inline-block w-3 h-px bg-zinc-700" />
                <span className="inline-block w-1.5 h-1.5 border border-zinc-600 rotate-45" />
                <span className="inline-block w-3 h-px bg-zinc-700" />
              </div>
            </div>
          ))}
        </div>

        {/* SVG Edges Layer */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none overflow-visible relative z-10"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {edges.map((edge) => (
            <CableEdge
              key={`${edge.from}-${edge.to}`}
              x1={edge.x1}
              y1={edge.y1}
              x2={edge.x2}
              y2={edge.y2}
              color={edge.color}
              active={isApiReady}
            />
          ))}
        </svg>

        {/* Nodes Layer */}
        {NODES.map((node) => {
          const data = nodeMap[node.key];
          if (!data) return null;
          const Icon = data.icon;
          return (
            <motion.div
              key={node.key}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
              className="absolute flex flex-col items-center justify-center -translate-x-1/2 -translate-y-1/2 z-10"
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
            >
              <motion.div
                animate={{
                  scale: [1, 1.25, 1],
                  opacity: [0.25, 0.5, 0.25],
                }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                className="absolute w-28 h-28 rounded-full blur-2xl pointer-events-none"
                style={{ backgroundColor: data.color }}
              />
              <div
                className="relative flex flex-col items-center justify-center w-28 h-28 rounded-2xl border backdrop-blur-xl transition-all duration-500 cursor-default"
                style={{
                  borderColor: `${data.color}35`,
                  backgroundColor: "rgba(8, 8, 14, 0.85)",
                  boxShadow: `0 0 24px ${data.color}18, 0 0 60px ${data.color}08, inset 0 1px 0 rgba(255,255,255,0.05)`,
                }}
              >
                <Icon className="w-6 h-6 mb-2" style={{ color: data.color }} />
                <span className="text-[9px] font-mono font-bold text-text-muted text-center leading-tight mb-1 uppercase px-2 tracking-widest">
                  {node.label}
                </span>
                <span className="text-sm font-mono font-bold tabular-nums mb-1" style={{ color: data.color }}>
                  {node.key === "fed"
                    ? macroState.fed_policy.status.toUpperCase()
                    : node.key === "vix"
                      ? macroState.vix.value.toFixed(1)
                      : node.key === "tga"
                        ? `$${macroState.tga.value.toFixed(0)}B`
                        : node.key === "oil"
                          ? `${macroState.crude_oil.delta > 0 ? "+" : ""}${macroState.crude_oil.delta.toFixed(2)}%`
                          : node.key === "ry"
                            ? `${macroState.real_yields.value.toFixed(2)}%`
                            : node.key === "liq"
                              ? `$${macroState.rrp.value.toFixed(1)}B`
                              : node.key === "inf"
                                ? `${macroState.inflation_proxy.value.toFixed(2)}%`
                                : node.key === "dxy"
                                  ? macroState.dxy.value.toFixed(2)
                                  : node.key === "yc"
                                    ? `${macroState.yield_curve.spread} bps`
                                    : node.key === "eq"
                                      ? `${macroState.risk_assets.delta > 0 ? "+" : ""}${macroState.risk_assets.delta.toFixed(2)}%`
                                      : node.key === "commodities"
                                        ? `${macroState.commodities.value.toFixed(2)}`
                                        : node.key === "gold"
                                          ? `$${macroState.gold.value.toFixed(2)}`
                                          : node.key === "em_risk_on"
                                            ? `${macroState.em_risk_on.delta > 0 ? "+" : ""}${macroState.em_risk_on.delta.toFixed(2)}%`
                                            : node.key === "risk_off_fx"
                                              ? `${macroState.risk_off_fx.delta > 0 ? "+" : ""}${macroState.risk_off_fx.delta.toFixed(2)}%`
                                              : "—"}
                </span>
                <span className="text-[8px] font-mono font-medium uppercase tracking-wider" style={{ color: data.color, opacity: 0.85 }}>
                  {node.key === "liq"
                    ? macroState.rrp.delta < 0 ? "Injecting" : "Draining"
                    : node.key === "tga"
                      ? macroState.tga.delta < 0 ? "Yellen Drain" : "Cash Absorbed"
                    : node.key === "oil"
                      ? macroState.crude_oil.delta > 0 ? "Inflation Risk" : "Disinflation Tailwind"
                    : node.key === "fed"
                      ? macroState.fed_policy.status
                    : node.key === "inf"
                      ? macroState.inflation_proxy.value > 2.5 || macroState.inflation_proxy.delta > 0 ? "Hot" : "Cooling"
                    : node.key === "dxy"
                      ? macroState.dxy.delta > 0 ? "Risk-Off" : "Risk-On"
                    : node.key === "ry"
                      ? macroState.real_yields.value > 0 && macroState.real_yields.delta > 0 ? "Restrictive" : "Accommodative"
                    : node.key === "vix"
                      ? macroState.vix.value < 15 ? "Calm" : macroState.vix.value <= 25 ? "Elevated" : "Panic"
                    : node.key === "yc"
                      ? macroState.yield_curve.status
                    : node.key === "eq"
                      ? macroState.risk_assets.delta > 0 ? "Bull" : "Bear"
                    : node.key === "commodities"
                      ? macroState.commodities.delta > 0 ? "Inflation Risk" : "Disinflation"
                    : node.key === "gold"
                      ? macroState.gold.delta > 0 ? "Safe Haven Up" : "Safe Haven Down"
                    : node.key === "em_risk_on"
                      ? macroState.em_risk_on.delta > 0 ? "Risk-On Flow" : "Risk-Off Flow"
                    : node.key === "risk_off_fx"
                      ? macroState.risk_off_fx.delta > 0 ? "Defensive" : "Weak Hedge"
                    : ""}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ── AI REASONING PANEL ──────────────────────────────────── */}
      <div className="glass border border-border-subtle rounded-2xl bg-bg-void p-5">
        <div className="flex items-center gap-2 mb-3">
          <Terminal className="w-4 h-4 text-accent-gold" />
          <span className="text-xs font-mono font-bold text-text-primary tracking-widest uppercase">
            Institutional Desk AI
          </span>
          {isAnalyzing && (
            <span className="text-[10px] font-mono text-text-muted ml-auto animate-pulse">
              Mapping causal flow...
            </span>
          )}
        </div>
        <div className="text-[11px] sm:text-xs font-mono leading-[1.75] min-h-[56px] text-text-secondary">
          {isAnalyzing ? (
            <span className="text-text-muted animate-pulse">
              Memetakan aliran modal institusional — analyzing node states...
            </span>
          ) : displayedReasoning ? (
            <span className="whitespace-pre-line">
              {displayedReasoning}
              <span className="inline-block ml-1 w-[6px] h-3 bg-accent-gold/80 align-middle animate-pulse" />
            </span>
          ) : (
            <span className="text-text-muted italic">
              Tekan "Analyze Flow" untuk narasi aliran modal berbasis Causal Loop saat ini.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
