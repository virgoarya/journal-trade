"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useMacroTerminal } from "@/components/macro-terminal/MacroTerminalContext";
import { NexusNode } from "./nexus/NexusNode";
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
  status: string;
  rate?: number;
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
  value: number | null;
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
  walcl: { value: number; delta: number };
  crude_oil: CrudeOilState;
  fed_policy: FedPolicyState;
  inflation_proxy: InflationProxyState;
  dxy: DxyState;
  real_yields: RealYieldsState;
  vix: VixState;
  yield_curve: YieldCurveState;
  risk_assets: RiskAssetsState;
  growth_pmi: { value: number; delta: number };
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

interface NodeQuality {
  source: string;
  freshness: "live" | "cache" | "stale" | "error";
  confidence: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT / MOCK STATE (fallback seed + placeholder values)
// ─────────────────────────────────────────────────────────────────────────────
const createEmptyState = (): MacroState => ({
  rrp: { value: 0, delta: 0 },
  tga: { value: 0, delta: 0 },
  walcl: { value: 0, delta: 0 },
  crude_oil: { value: 0, delta: 0 },
  fed_policy: { status: "UNKNOWN" },
  inflation_proxy: { value: 0, delta: 0 },
  dxy: { value: 0, delta: 0 },
  real_yields: { value: 0, delta: 0 },
  vix: { value: null },
  yield_curve: { status: "UNKNOWN", spread: 0 },
  risk_assets: { value: 0, delta: 0 },
  growth_pmi: { value: 0, delta: 0 },
  commodities: { value: 0, delta: 0 },
  gold: { value: 0, delta: 0 },
  em_risk_on: { value: 0, delta: 0 },
  risk_off_fx: { value: 0, delta: 0 },
});

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

// ─────────────────────────────────────────────────────────────────────────────
// GLOW LOGIC
// ─────────────────────────────────────────────────────────────────────────────
function isNodePulsating(state: MacroState, nodeKey: string): boolean {
  const netLiqDelta = state.walcl.delta - state.tga.delta - state.rrp.delta;
  const spyDelta = state.risk_assets.delta;

  switch (nodeKey) {
    case "crb":
      return Math.abs(state.commodities.delta) > 2.0;
    case "oil":
      return Math.abs(state.crude_oil.delta) > 3.0;
    case "onrrp":
      return Math.abs(state.rrp.delta) > 20;
    case "tga":
      return Math.abs(state.tga.delta) > 50;
    case "liq":
      return Math.abs(netLiqDelta) > 50;
    case "growth":
      return (
        (state.growth_pmi?.value ?? 65) > 75 ||
        (state.growth_pmi?.value ?? 65) < 55
      );
    case "inf":
      return (
        state.inflation_proxy.value > 3.5 || state.inflation_proxy.value < 1.5
      );
    case "fed":
      return (
        state.fed_policy.status === "Tightening" ||
        state.fed_policy.status === "Easing"
      );
    case "dxy":
      return Math.abs(state.dxy.delta) > 0.5;
    case "yc":
      return state.yield_curve.spread > 100 || state.yield_curve.spread < -50;
    case "ry":
      return state.real_yields.value > 2.0 || state.real_yields.value < 0.0;
    case "eq":
      return Math.abs(spyDelta) > 1.5;
    case "gold":
      return Math.abs(state.gold.delta) > 1.5;
    case "vix":
      return (state.vix.value ?? 0) >= 20;
    case "commodities":
      return Math.abs(state.commodities.delta) > 2.0;
    case "em_risk_on":
      return Math.abs(state.em_risk_on.delta) > 1.5;
    case "risk_off_fx":
      return Math.abs(state.risk_off_fx.delta) > 1.0;
    default:
      return false;
  }
}
function getNodeColor(state: MacroState, nodeKey: string): string {
  const netLiqDelta = state.walcl.delta - state.tga.delta - state.rrp.delta;
  const ryDelta = state.real_yields.delta;
  const spyDelta = state.risk_assets.delta;
  const goldDelta = state.gold.delta;

  switch (nodeKey) {
    case "crb":
      return state.commodities.delta > 0
        ? "#ef4444"
        : state.commodities.delta < 0
          ? "#22c55e"
          : "#64748b";
    case "oil":
      return state.crude_oil.delta > 0
        ? "#ef4444"
        : state.crude_oil.delta < 0
          ? "#22c55e"
          : "#64748b";
    case "onrrp":
      return state.rrp.delta < 0
        ? "#22c55e"
        : state.rrp.delta > 0
          ? "#ef4444"
          : "#64748b";
    case "tga":
      return state.tga.delta < 0
        ? "#22c55e"
        : state.tga.delta > 0
          ? "#ef4444"
          : "#64748b";
    case "liq":
      return netLiqDelta > 0
        ? "#22c55e"
        : netLiqDelta < 0
          ? "#ef4444"
          : "#64748b";
    case "growth": {
      const gv = state.growth_pmi?.value ?? 65;
      return gv > 70
        ? "#22c55e"
        : gv > 60
          ? "#f59e0b"
          : gv > 50
            ? "#f97316"
            : "#ef4444";
    }
    case "inf": {
      const cpi = state.inflation_proxy.value;
      return cpi > 3.0 ? "#ef4444" : cpi > 2.0 ? "#f59e0b" : "#22c55e";
    }
    case "fed":
      if (state.fed_policy.status === "Tightening") return "#ef4444";
      if (state.fed_policy.status === "Easing") return "#22c55e";
      if (state.fed_policy.status === "Restrictive Hold") return "#f97316"; // orange - still tight
      if (state.fed_policy.status === "Pause") return "#3b82f6";
      return "#64748b";
    case "dxy":
      return state.dxy.delta > 0
        ? "#ef4444"
        : state.dxy.delta < 0
          ? "#22c55e"
          : "#64748b";
    case "yc":
      if (state.yield_curve.status.toLowerCase().includes("bull"))
        return "#22c55e";
      if (state.yield_curve.status.toLowerCase().includes("bear"))
        return "#ef4444";
      return "#3b82f6";
    case "ry": {
      const rv = state.real_yields.value;
      return rv > 1.5 ? "#ef4444" : rv < 0.5 ? "#22c55e" : "#f59e0b";
    }
    case "eq":
      if (spyDelta > 0 && netLiqDelta > 0) return "#22c55e"; // Liquidity Driven
      if (spyDelta > 0 && ryDelta > 0) return "#f59e0b"; // Defying Gravity
      if (spyDelta < 0 && ryDelta > 0) return "#ef4444"; // Yield Pressured
      if (spyDelta < 0 && netLiqDelta < 0) return "#ef4444"; // Liquidity Drain
      return spyDelta > 0 ? "#22c55e" : "#ef4444";
    case "gold":
      if (goldDelta > 0 && ryDelta < 0) return "#22c55e"; // Yield Supported
      if (goldDelta < 0 && ryDelta > 0) return "#ef4444"; // Yield Pressured
      if (goldDelta > 0 && ryDelta > 0) return "#f59e0b"; // Debasement Fear
      if (goldDelta < 0 && ryDelta < 0) return "#ef4444"; // Liquidation
      return goldDelta > 0 ? "#f97316" : "#ef4444";
    case "vix":
      if ((state.vix.value ?? 0) >= 20 && spyDelta < 0) return "#ef4444";
      if ((state.vix.value ?? 0) < 15 && spyDelta > 0) return "#22c55e";
      if ((state.vix.value ?? 0) >= 15 && spyDelta > 0) return "#f59e0b";
      return (state.vix.value ?? 0) < 15
        ? "#22c55e"
        : (state.vix.value ?? 0) <= 25
          ? "#f97316"
          : "#ef4444";
    case "commodities":
      return state.commodities.delta > 0
        ? "#ef4444"
        : state.commodities.delta < 0
          ? "#22c55e"
          : "#64748b";
    case "em_risk_on":
      return state.em_risk_on.delta > 0
        ? "#22c55e"
        : state.em_risk_on.delta < 0
          ? "#ef4444"
          : "#64748b";
    case "risk_off_fx":
      return state.risk_off_fx.delta > 0
        ? "#3b82f6"
        : state.risk_off_fx.delta < 0
          ? "#a855f7"
          : "#6366f1";
    default:
      return "#64748b";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NODE CONFIG (14 nodes, 5-row × 3-col grid)
// ─────────────────────────────────────────────────────────────────────────────
const NODES: NodeConfig[] = [
  {
    key: "crb",
    x: 12,
    y: 15,
    label: "CRB COMMODITIES INDEX",
    icon: LineChart,
    zone: 1,
  },
  { key: "oil", x: 12, y: 35, label: "ENERGY/OIL", icon: Zap, zone: 1 },
  { key: "onrrp", x: 12, y: 55, label: "ON RRP", icon: Droplets, zone: 1 },
  { key: "tga", x: 12, y: 75, label: "TGA", icon: Building2, zone: 1 },

  {
    key: "growth",
    x: 30,
    y: 20,
    label: "GROWTH SENTIMENT",
    icon: TrendingUp,
    zone: 1,
  },
  { key: "inf", x: 30, y: 40, label: "INFLATION", icon: Activity, zone: 2 },
  { key: "liq", x: 30, y: 65, label: "NET LIQUIDITY", icon: Droplets, zone: 2 },

  {
    key: "fed",
    x: 50,
    y: 45,
    label: "FEDERAL RESERVE",
    icon: Building2,
    zone: 2,
  },
  { key: "dxy", x: 50, y: 70, label: "DXY", icon: DollarSign, zone: 2 },

  { key: "yc", x: 68, y: 35, label: "YIELD CURVE", icon: Activity, zone: 3 },

  { key: "ry", x: 88, y: 20, label: "REAL YIELD", icon: TrendingUp, zone: 3 },
  {
    key: "eq",
    x: 88,
    y: 45,
    label: "RISK ASSETS SP500",
    icon: TrendingUp,
    zone: 3,
  },
  {
    key: "gold",
    x: 88,
    y: 65,
    label: "SAFE HAVEN GOLD",
    icon: DollarSign,
    zone: 3,
  },
  { key: "vix", x: 88, y: 85, label: "VIX", icon: AlertOctagon, zone: 3 },
];

const EDGES: EdgeConfig[] = [
  // Col 1 to Col 2
  { from: "crb", to: "inf" },
  { from: "oil", to: "inf" },
  { from: "onrrp", to: "liq" },
  { from: "tga", to: "liq" },

  // Growth, Inf, Liq to Fed
  { from: "growth", to: "fed" },

  // Inf outputs (SWAPPED: ry first, fed second to prevent crossing)
  { from: "inf", to: "ry" },
  { from: "inf", to: "fed" },

  { from: "liq", to: "fed" },

  // Liq to Dxy
  { from: "liq", to: "dxy" },

  // Fed to Yc
  { from: "fed", to: "yc" },

  // Yc to Ry and Vix
  { from: "yc", to: "ry" },
  { from: "yc", to: "vix" },

  // Dxy outputs (4 ports)
  { from: "dxy", to: "fed" },

  // Ry outputs (SWAPPED: gold first, eq second to prevent crossing)
  // [HOT RELOAD FORCED]
  { from: "ry", to: "gold" },
  { from: "ry", to: "eq" },

  // Remaining Dxy outputs
  { from: "dxy", to: "eq" },
  { from: "dxy", to: "gold" },
  { from: "dxy", to: "crb" },

  // Vix outputs (eq first, gold second)
  { from: "vix", to: "eq" },
  { from: "vix", to: "gold" },
  { from: "vix", to: "fed" },
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
  midXOffset = 0,
  side = "left",
  from,
  to,
  nodeHwPct,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  active: boolean;
  sourceOffsetY?: number;
  targetOffsetY?: number;
  midXOffset?: number;
  side?: "left" | "right";
  from?: string;
  to?: string;
  nodeHwPct: number;
}) {
  const sy1 = y1 + sourceOffsetY;
  const ty2 = y2 + targetOffsetY;
  const isSameColumn = x1 === x2;

  const startX = x1 + nodeHwPct;
  const endX = side === "right" ? x2 + nodeHwPct : x2 - nodeHwPct;

  let pathD = "";

  // ── CUSTOM ROUTES UNTUK MEMINIMALISIR CROSSING ──

  // Col 1 -> Col 2
  if (from === "crb" && to === "inf") {
    pathD = `M ${startX},${sy1} L 22.5,${sy1} L 22.5,${ty2} L ${endX},${ty2}`;
  } else if (from === "oil" && to === "inf") {
    pathD = `M ${startX},${sy1} L 20.5,${sy1} L 20.5,${ty2} L ${endX},${ty2}`;
  } else if (from === "onrrp" && to === "liq") {
    pathD = `M ${startX},${sy1} L 20.5,${sy1} L 20.5,${ty2} L ${endX},${ty2}`;
  } else if (from === "tga" && to === "liq") {
    pathD = `M ${startX},${sy1} L 22.5,${sy1} L 22.5,${ty2} L ${endX},${ty2}`;
  }

  // Col 2 -> Col 3
  else if (from === "inf" && to === "ry") {
    pathD = `M ${startX},${sy1} L 37,${sy1} L 37,12 L 73,12 L 73,${ty2} L ${endX},${ty2}`;
  } else if (from === "inf" && to === "fed") {
    pathD = `M ${startX},${sy1} L 38.5,${sy1} L 38.5,${ty2} L ${endX},${ty2}`;
  } else if (from === "growth" && to === "fed") {
    pathD = `M ${startX},${sy1} L 40,${sy1} L 40,${ty2} L ${endX},${ty2}`;
  } else if (from === "liq" && to === "fed") {
    pathD = `M ${startX},${sy1} L 41.5,${sy1} L 41.5,${ty2} L ${endX},${ty2}`;
  }

  // DXY custom routes
  else if (from === "dxy" && to === "fed") {
    pathD = `M ${startX},${sy1} L 58,${sy1} L 58,57 L 43,57 L 43,${ty2} L ${endX},${ty2}`;
  } else if (from === "dxy" && to === "crb") {
    pathD = `M ${startX},${sy1} L 58,${sy1} L 58,96 L 3,96 L 3,${ty2} L ${endX},${ty2}`;
  } else if (from === "dxy" && to === "eq") {
    pathD = `M ${startX},${sy1} L 76,${sy1} L 76,${ty2} L ${endX},${ty2}`;
  } else if (from === "dxy" && to === "gold") {
    pathD = `M ${startX},${sy1} L 77,${sy1} L 77,${ty2} L ${endX},${ty2}`;
  }

  // YC custom routes
  else if (from === "yc" && to === "ry") {
    pathD = `M ${startX},${sy1} L 74,${sy1} L 74,${ty2} L ${endX},${ty2}`;
  } else if (from === "yc" && to === "vix") {
    pathD = `M ${startX},${sy1} L 75,${sy1} L 75,${ty2} L ${endX},${ty2}`;
  }

  // RY custom routes (Loop around left side)
  else if (from === "ry" && to === "eq") {
    pathD = `M ${startX},${sy1} L 95,${sy1} L 95,32 L 78,32 L 78,${ty2} L ${endX},${ty2}`;
  } else if (from === "ry" && to === "gold") {
    pathD = `M ${startX},${sy1} L 97,${sy1} L 97,55 L 80,55 L 80,${ty2} L ${endX},${ty2}`;
  }

  // VIX custom routes (Loop around left side)
  else if (from === "vix" && to === "fed") {
    pathD = `M ${startX},${sy1} L 94,${sy1} L 94,98 L 24,98 L 24,${ty2} L ${endX},${ty2}`;
  } else if (from === "vix" && to === "eq") {
    pathD = `M ${startX},${sy1} L 95,${sy1} L 95,74 L 79,74 L 79,${ty2} L ${endX},${ty2}`;
  } else if (from === "vix" && to === "gold") {
    pathD = `M ${startX},${sy1} L 97,${sy1} L 97,72 L 81,72 L 81,${ty2} L ${endX},${ty2}`;
  } else {
    // ── DEFAULT ROUTES ──
    let midX = x1 + (x2 - x1) / 2;
    if (x1 === 12 && x2 === 30) midX = 21;
    else if (x1 === 30 && x2 === 50) midX = 43;
    else if (x1 === 50 && x2 === 68) midX = 59;
    else if (x1 === 68 && x2 === 88) midX = 82;
    midX += midXOffset * 1.5;
    pathD = `M ${startX},${sy1} L ${midX},${sy1} L ${midX},${ty2} L ${endX},${ty2}`;
  }

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
  const {
    assets,
    liquidity,
    currentRegime,
    vix,
    yieldCurve,
    geoRisk,
    nextEvent,
    dataStatus,
  } = useMacroTerminal();

  const [macroState, setMacroState] = useState<MacroState>(createEmptyState);
  const [nodeQuality, setNodeQuality] = useState<Record<string, NodeQuality>>(
    {},
  );
  const [nexusLoaded, setNexusLoaded] = useState(false);
  const [nexusReasoning, setNexusReasoning] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [displayedReasoning, setDisplayedReasoning] = useState<string>("");

  const [dim, setDim] = useState({ w: 1200, h: 800 });
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      setDim({
        w: entries[0].contentRect.width || 1200,
        h: entries[0].contentRect.height || 800,
      });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

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
            if (d.spread10y3m != null) {
              nxt.yield_curve = {
                status:
                  d.curveRegime && d.curveRegime !== "UNKNOWN"
                    ? d.curveRegime
                    : d.inverted
                      ? "Inverted"
                      : "Normal",
                spread: d.spread10y3m,
              };
            }
            if (d.spread10y2y != null && nxt.yield_curve.status === "Normal") {
              nxt.yield_curve.status = d.inverted
                ? "Inverted"
                : nxt.yield_curve.status;
            }
            return nxt;
          });
          setNodeQuality((prev) => ({
            ...prev,
            vix: {
              source: d.vixSource ?? "quant",
              freshness: json.fromCache ? "cache" : "live",
              confidence: 82,
            },
            yc: {
              source: d.vixSource ? "quant+yield" : "quant",
              freshness: json.fromCache ? "cache" : "live",
              confidence: 82,
            },
            ry: {
              source: "fred:DFII10",
              freshness: json.fromCache ? "cache" : "live",
              confidence: 78,
            },
          }));
        }
      } catch {
        if (!cancelled) {
          setNodeQuality((prev) => ({
            ...prev,
            vix: { source: "unavailable", freshness: "error", confidence: 0 },
            yc: { source: "unavailable", freshness: "error", confidence: 0 },
            ry: { source: "unavailable", freshness: "error", confidence: 0 },
          }));
        }
      }
    }

    fetchQuant();
    const interval = setInterval(fetchQuant, 3 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

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
        body: JSON.stringify({
          nodesData: nodeMap,
          context: {
            currentRegime,
            liquidityStatus: liquidity?.status,
            vixRegime: vix.regime,
            yieldCurveRegime: yieldCurve.curveRegime,
            geoRiskTopDriver: geoRisk.topDriver,
            nextHighImpactEvent: nextEvent,
          },
        }),
      });
      const data = await res.json();
      if (data.success) setNexusReasoning(data.reasoning);
      else setNexusReasoning("Gagal mendapatkan analisis: " + data.error);
    } catch (err: unknown) {
      setNexusReasoning(
        "Terjadi kesalahan saat memanggil AI: " + getErrorMessage(err),
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const exportDeskBrief = () => {
    const brief = {
      generatedAt: new Date().toISOString(),
      regime: currentRegime,
      liquidity: liquidity?.status,
      vix,
      yieldCurve,
      geoRiskTopDriver: geoRisk.topDriver,
      nextEvent,
      reasoning: nexusReasoning,
      nodes: nodeMap,
    };
    const blob = new Blob([JSON.stringify(brief, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `macro-nexus-desk-brief-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const cancelled = false;
    async function fetchTga() {
      try {
        const res = await fetch("/api/v1/market-data/tga");
        const json = await res.json();
        if (!cancelled && res.ok && json.success && json.data) {
          const rawValueStr = json.data.displayValue?.replace(/[^0-9.]/g, "") || "0";
          const parsedValue = parseFloat(rawValueStr);
          
          setMacroState((prev) => ({
            ...prev,
            tga: { value: json.data.value ?? parsedValue, delta: json.data.delta },
          }));
          setNodeQuality((prev) => ({
            ...prev,
            tga: {
              source: "treasury.gov",
              freshness: "live",
              confidence: 86,
            },
          }));
        }
      } catch {
        setNodeQuality((prev) => ({
          ...prev,
          tga: { source: "unavailable", freshness: "error", confidence: 0 },
        }));
      }
    }
    fetchTga();
  }, []);

  useEffect(() => {
    const cancelled = false;
    async function fetchOil() {
      try {
        const res = await fetch("/api/v1/market-data/quotes?symbols=CL=F");
        const json = await res.json();
        
        // Cek struktur response (bisa data[0].data atau langsung data[0])
        const quoteObj = json.data?.[0]?.data || json.data?.[0];
        
        if (!cancelled && res.ok && quoteObj) {
          // Dukung format finnhub (c, dp) atau format internal (price, changePercent)
          const value = quoteObj.c ?? quoteObj.price;
          const delta = quoteObj.dp ?? quoteObj.changePercent;
          
          if (value != null && delta != null) {
            setMacroState((prev) => ({
              ...prev,
              crude_oil: {
                value: value,
                delta: delta,
              },
            }));
            setNodeQuality((prev) => ({
              ...prev,
              oil: {
                source: "finnhub:CL=F",
                freshness: "live",
                confidence: 74,
              },
            }));
          }
        }
      } catch {
        setNodeQuality((prev) => ({
          ...prev,
          oil: { source: "unavailable", freshness: "error", confidence: 0 },
        }));
      }
    }
    fetchOil();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function fetchNexusSnapshot() {
      try {
        const res = await fetch("/api/v1/nexus/snapshot");
        const json = await res.json();
        if (!cancelled && res.ok && json.success && json.data) {
          const d = json.data;
          setMacroState((prev) => {
            const nxt = { ...prev };
            if (d.dxy) nxt.dxy = { value: d.dxy.value, delta: d.dxy.delta };
            if (d.crb)
              nxt.commodities = { value: d.crb.value, delta: d.crb.delta };
            if (d.gold) nxt.gold = { value: d.gold.value, delta: d.gold.delta };
            if (d.cpiYoY != null)
              nxt.inflation_proxy = {
                value: d.cpiYoY,
                delta: prev.inflation_proxy.delta,
              };
            if (d.growthSentiment != null)
              nxt.growth_pmi = {
                value: d.growthSentiment,
                delta: prev.growth_pmi?.delta || 0,
              };
            if (d.walcl)
              nxt.walcl = { value: d.walcl.value, delta: d.walcl.delta };
            if (d.realYields)
              nxt.real_yields = {
                value: d.realYields.value,
                delta: d.realYields.delta,
              };
            if (d.fedFundsRate) {
              const rate = d.fedFundsRate.value;
              const delta = d.fedFundsRate.delta;
              let fedStatus: string;
              if (Math.abs(delta) < 0.01)
                fedStatus =
                  rate >= 3.0
                    ? "Restrictive Hold"
                    : rate <= 1.0
                      ? "Accommodative"
                      : "Pause";
              else fedStatus = delta > 0 ? "Tightening" : "Easing";
              nxt.fed_policy = { status: fedStatus, rate: rate };
            }
            return nxt;
          });
          setNodeQuality((prev) => ({
            ...prev,
            dxy: {
              source: "yahoo:DX-Y.NYB",
              freshness: json.data.fromCache ? "cache" : "live",
              confidence: 76,
            },
            crb: {
              source: "finnhub:DBC",
              freshness: json.data.fromCache ? "cache" : "live",
              confidence: 72,
            },
            gold: {
              source: "yahoo:GC=F",
              freshness: json.data.fromCache ? "cache" : "live",
              confidence: 78,
            },
            fed: {
              source: "fred:DFEDTARU",
              freshness: json.data.fromCache ? "cache" : "live",
              confidence: 90,
            },
            inf: {
              source: "fred:CPIAUCSL",
              freshness: json.data.fromCache ? "cache" : "live",
              confidence: 82,
            },
            growth: {
              source: "fred:UMCSENT",
              freshness: json.data.fromCache ? "cache" : "live",
              confidence: 76,
            },
            walcl: {
              source: "fred:WALCL",
              freshness: json.data.fromCache ? "cache" : "live",
              confidence: 84,
            },
            ry: {
              source: "fred:DFII10",
              freshness: json.data.fromCache ? "cache" : "live",
              confidence: 78,
            },
          }));
          setNexusLoaded(true);
        }
      } catch {
        setNodeQuality((prev) => ({
          ...prev,
          dxy: { source: "unavailable", freshness: "error", confidence: 0 },
          crb: { source: "unavailable", freshness: "error", confidence: 0 },
          gold: { source: "unavailable", freshness: "error", confidence: 0 },
          fed: { source: "unavailable", freshness: "error", confidence: 0 },
          inf: { source: "unavailable", freshness: "error", confidence: 0 },
          growth: { source: "unavailable", freshness: "error", confidence: 0 },
          walcl: { source: "unavailable", freshness: "error", confidence: 0 },
        }));
      }
    }
    fetchNexusSnapshot();
    const interval = setInterval(fetchNexusSnapshot, 3 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
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

    const regimeMap: Record<
      string,
      "Restrictive Hold" | "Pause" | "Accommodative"
    > = {
      Goldilocks: "Pause",
      Reflation: "Restrictive Hold",
      Stagflation: "Restrictive Hold",
      Deflation: "Accommodative",
      Transition: "Pause",
    };
    const impliedFedStatus = currentRegime
      ? regimeMap[currentRegime] || "Pause"
      : "Pause";
    setMacroState((prev) => ({
      ...prev,
      fed_policy:
        prev.fed_policy.status === "UNKNOWN"
          ? { status: impliedFedStatus, rate: prev.fed_policy.rate }
          : prev.fed_policy,
      rrp: {
        value: liquidity.value,
        delta: liquidity.change,
      },
      // Only use ETF proxy if CPI data hasn't been loaded from Nexus yet
      ...(prev.inflation_proxy.value < 1
        ? {
            inflation_proxy: {
              value: inflationProxy,
              delta: inflationProxy,
            },
          }
        : {}),
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

  const isApiReady = nexusLoaded;
  const hasAnyError = Object.values(nodeQuality).some(
    (q) => q.freshness === "error",
  );

  // ── 5. DERIVED DATA ────────────────────────────────────────────────────
  const tf: Record<string, number> = {};
  const sf: Record<string, number> = {};
  EDGES.forEach(({ from, to }) => {
    tf[to] = (tf[to] || 0) + 1;
    sf[from] = (sf[from] || 0) + 1;
  });

  const nodeMap = useMemo(() => {
    const map: Record<
      string,
      {
        x: number;
        y: number;
        color: string;
        icon: React.ElementType;
        label: string;
        inPorts: number;
        outPorts: number;
        value: string;
        status: string;
        quality: NodeQuality;
      }
    > = {};
    NODES.forEach((n) => {
      const netLiqValue =
        (macroState.walcl?.value || 0) - (macroState.tga?.value || 0) - (macroState.rrp?.value || 0);
      const netLiqDelta =
        (macroState.walcl?.delta || 0) - (macroState.tga?.delta || 0) - (macroState.rrp?.delta || 0);

      const ryDelta = macroState.real_yields?.delta || 0;
      const spyDelta = macroState.risk_assets?.delta || 0;
      const goldDelta = macroState.gold?.delta || 0;
      const quality = nodeQuality[n.key] ?? {
        source: "computed",
        freshness: hasAnyError ? "stale" : "live",
        confidence: hasAnyError ? 40 : 70,
      };

      let statusLabel = "";
      switch (n.key) {
        case "crb":
        case "commodities":
          statusLabel =
            (macroState.commodities?.delta || 0) > 0
              ? "Inflationary"
              : "Disinflationary";
          break;
        case "oil":
        case "crude_oil":
          statusLabel =
            (macroState.crude_oil?.delta || 0) > 0 ? "Energy Risk" : "Benign";
          break;
        case "onrrp":
          statusLabel =
            (macroState.rrp?.delta || 0) < 0
              ? "Releasing Liquidity"
              : "Absorbing Liquidity";
          break;
        case "tga":
          statusLabel = (macroState.tga?.delta || 0) < 0 ? "Yellen Put" : "Tax Drain";
          break;
        case "liq":
          statusLabel =
            netLiqDelta > 0 ? "Liquidity Expansion" : "Liquidity Contraction";
          break;
        case "growth":
          if (quality.freshness === "error") {
            statusLabel = "Data Unavailable";
            break;
          }
          const sent = macroState.growth_pmi?.value || 65;
          statusLabel =
            sent > 70
              ? "Optimistic"
              : sent > 60
                ? "Cautious"
                : sent > 50
                  ? "Pessimistic"
                  : "Recession Alert";
          break;
        case "inf": {
          const cpiVal = macroState.inflation_proxy?.value || 0;
          statusLabel =
            cpiVal > 3.0
              ? "Sticky / Hot"
              : cpiVal > 2.0
                ? "Moderate"
                : "Cooling";
          break;
        }
        case "fed":
          statusLabel = macroState.fed_policy?.status || "UNKNOWN";
          break;
        case "dxy":
          statusLabel =
            (macroState.dxy?.delta || 0) > 0 ? "Wrecking Ball" : "Depreciating";
          break;
        case "yc":
          statusLabel = macroState.yield_curve?.status || "UNKNOWN";
          break;
        case "ry":
          const ryVal = macroState.real_yields?.value || 0;
          statusLabel =
            ryVal > 1.5
              ? "Restrictive"
              : ryVal < 0.5
                ? "Accommodative"
                : "Neutral";
          break;
        case "eq":
          if (spyDelta > 0 && netLiqDelta > 0)
            statusLabel = "Liquidity Driven Rally";
          else if (spyDelta > 0 && ryDelta > 0) statusLabel = "Defying Gravity";
          else if (spyDelta < 0 && ryDelta > 0) statusLabel = "Yield Pressured";
          else if (spyDelta < 0 && netLiqDelta < 0)
            statusLabel = "Liquidity Drain";
          else statusLabel = spyDelta > 0 ? "Bullish" : "Bearish";
          break;
        case "gold":
          if (goldDelta > 0 && ryDelta < 0) statusLabel = "Yield Supported";
          else if (goldDelta < 0 && ryDelta > 0)
            statusLabel = "Yield Pressured";
          else if (goldDelta > 0 && ryDelta > 0)
            statusLabel = "Debasement Fear";
          else if (goldDelta < 0 && ryDelta < 0) statusLabel = "Liquidation";
          else
            statusLabel = goldDelta > 0 ? "Safe Haven Up" : "Safe Haven Down";
          break;
        case "vix":
          if (quality.freshness === "error") statusLabel = "DATA UNAVAILABLE";
          else if ((macroState.vix?.value ?? 0) >= 20 && spyDelta < 0)
            statusLabel = "Panic / Hedging";
          else if ((macroState.vix?.value ?? 0) < 15 && spyDelta > 0)
            statusLabel = "Complacency";
          else if ((macroState.vix?.value ?? 0) >= 15 && spyDelta > 0)
            statusLabel = "Nervous Bull";
          else
            statusLabel =
              (macroState.vix?.value ?? 0) < 15
                ? "Calm"
                : (macroState.vix?.value ?? 0) <= 25
                  ? "Elevated"
                  : "Panic";
          break;
        case "em_risk_on":
          statusLabel =
            (macroState.em_risk_on?.delta || 0) > 0 ? "Risk-On Flow" : "Risk-Off Flow";
          break;
        case "risk_off_fx":
          statusLabel =
            (macroState.risk_off_fx?.delta || 0) > 0 ? "Defensive" : "Weak Hedge";
          break;
        default:
          statusLabel = "";
          break;
      }

      const displayValue =
        n.key === "vix"
          ? macroState.vix?.value == null
            ? "DATA UNAVAILABLE"
            : (macroState.vix.value || 0).toFixed(1)
          : n.key === "tga"
            ? `$${(macroState.tga?.value || 0).toFixed(0)}B`
            : n.key === "oil" || n.key === "crude_oil"
              ? `${(macroState.crude_oil?.delta || 0) > 0 ? "+" : ""}${(macroState.crude_oil?.delta || 0).toFixed(2)}%`
              : n.key === "ry"
                ? `${(macroState.real_yields?.value || 0).toFixed(2)}%`
                : n.key === "liq"
                  ? `$${(netLiqValue || 0).toFixed(1)}B`
                  : n.key === "onrrp"
                    ? `$${(macroState.rrp?.value || 0).toFixed(1)}B`
                    : n.key === "fed"
                      ? `${(macroState.fed_policy?.rate || 0).toFixed(2)}%`
                      : n.key === "inf"
                        ? `${(macroState.inflation_proxy?.value || 0).toFixed(2)}%`
                        : n.key === "dxy"
                          ? (macroState.dxy?.value || 0).toFixed(2)
                          : n.key === "yc"
                            ? `${macroState.yield_curve?.spread || 0} bps`
                            : n.key === "eq"
                              ? `${(macroState.risk_assets?.delta || 0) > 0 ? "+" : ""}${(macroState.risk_assets?.delta || 0).toFixed(2)}%`
                              : n.key === "growth"
                                ? quality.freshness === "error"
                                  ? "DATA UNAVAILABLE"
                                  : `${(macroState.growth_pmi?.value || 0).toFixed(1)}`
                                : n.key === "commodities" || n.key === "crb"
                                  ? `${(macroState.commodities?.value || 0).toFixed(2)}`
                                  : n.key === "gold"
                                    ? `${(macroState.gold?.delta || 0) > 0 ? "+" : ""}${(macroState.gold?.delta || 0).toFixed(2)}%`
                                    : n.key === "em_risk_on"
                                      ? `${(macroState.em_risk_on?.delta || 0) > 0 ? "+" : ""}${(macroState.em_risk_on?.delta || 0).toFixed(2)}%`
                                      : n.key === "risk_off_fx"
                                        ? `${(macroState.risk_off_fx?.delta || 0) > 0 ? "+" : ""}${(macroState.risk_off_fx?.delta || 0).toFixed(2)}%`
                                        : "—";

      map[n.key] = {
        x: n.x,
        y: n.y,
        color: getNodeColor(macroState, n.key),
        icon: n.icon,
        label: n.label,
        inPorts: tf[n.key] || 0,
        outPorts: sf[n.key] || 0,
        value: displayValue,
        status: statusLabel,
        quality,
      };
    });
    return map;
  }, [macroState]);

  const edges = useMemo(() => {
    const raw: Array<{
      id: string;
      from: string;
      to: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      color: string;
      side: "left" | "right";
    }> = [];
    EDGES.forEach(({ from, to }, i) => {
      const a = nodeMap[from];
      const b = nodeMap[to];
      if (!a || !b) return;
      raw.push({
        id: `${from}-${to}-${i}`,
        from,
        to,
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
        color: a.color,
        side: from === "yc" && to === "eq" ? "right" : "left",
      });
    });

    const targetFan: Record<string, { count: number; index: number }> = {};
    const sourceFan: Record<string, { count: number; index: number }> = {};
    const midXGroups: Record<string, { count: number; index: number }> = {};

    raw.forEach((e) => {
      targetFan[e.to] = targetFan[e.to] || { count: 0, index: 0 };
      targetFan[e.to].count++;
      sourceFan[e.from] = sourceFan[e.from] || { count: 0, index: 0 };
      sourceFan[e.from].count++;
      const groupKey = `${e.x1}-${e.x2}`;
      midXGroups[groupKey] = midXGroups[groupKey] || { count: 0, index: 0 };
      midXGroups[groupKey].count++;
    });

    return raw.map((e) => {
      const tf = targetFan[e.to];
      const sf = sourceFan[e.from];
      const tIdx = tf.index++;
      const sIdx = sf.index++;
      const sourceCount = sf.count;

      // Hitung offset persentase yang presisi secara matematis berdasarkan dimensi piksel
      const spreadYPct = (16 / dim.h) * 100;
      const targetOffsetY = (tIdx - (tf.count - 1) / 2) * spreadYPct;
      const sourceOffsetY = (sIdx - (sourceCount - 1) / 2) * spreadYPct;

      const groupKey = `${e.x1}-${e.x2}`;
      const mg = midXGroups[groupKey];
      const mIdx = mg.index++;
      const midXSpread = 1.2;
      const midXOffset = (mIdx - (mg.count - 1) / 2) * midXSpread;

      return {
        ...e,
        targetOffsetY,
        sourceOffsetY,
        midXOffset,
      };
    });
  }, [nodeMap]);

  // ── 6. RENDER ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3">
      <div
        ref={containerRef}
        className="relative w-full aspect-[16/10] min-h-[500px] max-h-[850px] glass-panel overflow-hidden"
      >
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.06]"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(212,175,55,0.4) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        <div className="absolute top-3 left-4 right-4 z-20 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-bold text-text-primary uppercase tracking-wider text-[11px] sm:text-xs flex items-center gap-2 min-w-0">
              <Activity size={14} className="text-accent-gold flex-shrink-0" />
              Macro Causal Loop
            </h2>
            <p className="text-[9px] font-mono text-text-muted mt-1 max-w-md leading-relaxed">
              Institutional flow: Liquidity → Policy → Yield → Risk Assets
            </p>
            <span
              className={`text-[9px] font-mono font-bold ${hasAnyError ? "text-amber-500" : isApiReady ? "text-emerald-400" : "text-text-muted animate-pulse"}`}
            >
              SOURCES:{" "}
              {hasAnyError
                ? "STALE / PARTIAL DATA"
                : isApiReady
                  ? "LIVE MACRO TERMINAL API"
                  : "LOADING SNAPSHOT"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportDeskBrief}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[9px] font-mono font-bold uppercase tracking-wider rounded-lg border border-border-subtle bg-surface-elevated/40 text-text-muted hover:text-accent-gold hover:border-accent-gold/40 transition-all shrink-0"
            >
              <Layers className="w-3 h-3" />
              Export Desk Brief
            </button>
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
        </div>

        <div className="absolute top-0 left-0 right-0 z-10 flex justify-around pointer-events-none px-8">
          {[
            "ZONA 1 // LIQUIDITY DRIVERS",
            "ZONA 2 // POLICY TRANSFORMERS",
            "ZONA 3 // CAPITAL DESTINATION",
          ].map((label, index) => (
            <div
              key={label}
              className="flex flex-col items-center"
              style={{
                position: "absolute",
                left: 25 + index * 25 + "%",
                top: "3.5rem",
                transform: "translateX(-50%)",
              }}
            >
              <div className="mb-1 flex items-center gap-1">
                <span className="inline-block w-3 h-px bg-zinc-700" />
                <span className="inline-block w-1.5 h-1.5 border border-zinc-600 rotate-45" />
                <span className="inline-block w-3 h-px bg-zinc-700" />
              </div>
              <span className="text-zinc-500 text-[8px] font-mono tracking-[0.25em] uppercase">
                {label}
              </span>
            </div>
          ))}
        </div>

        <div className="absolute left-4 bottom-4 z-20 flex flex-wrap items-center gap-2 text-[8px] font-mono text-text-muted">
          <span className="flex items-center gap-1">
            <span className="w-4 h-0.5 bg-emerald-500/70" />
            LIQ EXPANSION
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-0.5 bg-red-500/70" />
            LIQ DRAIN
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-0.5 bg-amber-500/70" />
            STICKY / WARNING
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-0.5 bg-blue-500/70" />
            POLICY / FX
          </span>
        </div>

        <svg
          className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-10"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {edges.map((edge) => (
            <CableEdge
              key={edge.id}
              x1={edge.x1}
              y1={edge.y1}
              x2={edge.x2}
              y2={edge.y2}
              color={edge.color}
              active={isApiReady}
              sourceOffsetY={edge.sourceOffsetY}
              targetOffsetY={edge.targetOffsetY}
              midXOffset={edge.midXOffset}
              side={edge.side}
              from={edge.from}
              to={edge.to}
              nodeHwPct={(62 / dim.w) * 100}
            />
          ))}
        </svg>

        {NODES.map((node) => {
          const data = nodeMap[node.key];
          if (!data) return null;
          const Icon = data.icon;

          return (
            <NexusNode
              key={node.key}
              id={node.key}
              label={node.label}
              statusText={data.status || undefined}
              value={data.value}
              icon={Icon}
              statusColor={data.color}
              glowColor={data.color}
              x={node.x}
              y={node.y}
              inputs={data.inPorts}
              outputs={data.outPorts}
              pulsate={isNodePulsating(macroState, node.key)}
              quality={data.quality}
            />
          );
        })}
      </div>

      <div className="w-full glass-panel overflow-hidden relative p-5">
        <div className="flex items-center gap-2 mb-3 min-w-0">
          <Terminal size={14} className="text-accent-gold flex-shrink-0" />
          <h2 className="font-bold text-text-primary uppercase tracking-wider text-[11px] sm:text-xs whitespace-nowrap">
            Institutional Desk AI
          </h2>
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
              Tekan &quot;Analyze Flow&quot; untuk narasi aliran modal berbasis
              Causal Loop saat ini.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
