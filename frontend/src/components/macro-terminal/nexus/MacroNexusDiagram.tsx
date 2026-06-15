"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { NexusNode } from "./NexusNode";
import { useMacroTerminal } from "../MacroTerminalContext";
import {
  Building2,
  Droplets,
  TrendingUp,
  AlertOctagon,
  LineChart,
  DollarSign,
  Activity,
  Terminal,
  Cpu,
  RefreshCw,
  BarChart3,
  Zap,
} from "lucide-react";

// Edge animation component
function AnimatedEdge({ startX, startY, endX, endY, color, flowDirection }: { startX: number, startY: number, endX: number, endY: number, color: string, flowDirection: 1 | -1 }) {
  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  return (
    <div 
      className="absolute top-0 left-0 origin-top-left pointer-events-none"
      style={{
        transform: `translate(${startX}%, ${startY}%) rotate(${angle}deg)`,
        width: `${length}%`, // this is technically incorrect for % based layout if parent isn't square, but we'll use an SVG overlay instead for proper responsiveness.
      }}
    >
      {/* We will implement SVG lines below to handle responsiveness correctly */}
    </div>
  );
}

// Proper SVG Edge with Bezier Curve (Cable style)
function SvgEdge({ 
  x1, y1, x2, y2, color, active 
}: { 
  x1: number, y1: number, x2: number, y2: number, color: string, active: boolean 
}) {
  // S-curve control points
  const cx1 = (x1 + x2) / 2;
  const cy1 = y1;
  const cx2 = (x1 + x2) / 2;
  const cy2 = y2;
  
  const pathD = `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;

  return (
    <svg 
      className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" 
      viewBox="0 0 100 100" 
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={`grad-${x1}-${y1}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0.8" />
        </linearGradient>
      </defs>
      
      {/* Background Cable */}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeOpacity={0.15}
        vectorEffect="non-scaling-stroke"
      />

      {/* Dashed Overlay */}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeOpacity={0.4}
        strokeDasharray="4 6"
        vectorEffect="non-scaling-stroke"
      />

      {/* Flowing Energy Overlay */}
      {active && (
        <motion.path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeDasharray="4 8"
          vectorEffect="non-scaling-stroke"
          initial={{ strokeDashoffset: 24 }}
          animate={{ strokeDashoffset: 0 }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: "linear"
          }}
          style={{ filter: `drop-shadow(0 0 4px ${color})` }}
        />
      )}
    </svg>
  );
}

function getPort(node: any, side: 'in' | 'out', index: number) {
  const count = node[side];
  const step = 2.5; // 2.5% ~ 16px in 640px height
  const offset = (index - (count - 1) / 2) * step;
  const xOffset = side === 'in' ? -6 : 6;
  return {
    x: node.x + xOffset,
    y: node.y + offset
  };
}

export function MacroNexusDiagram() {
  const { assets, liquidity, currentRegime } = useMacroTerminal();
  const [quantData, setQuantData] = useState<any>(null);
  
  const [nexusReasoning, setNexusReasoning] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [displayedReasoning, setDisplayedReasoning] = useState<string>("");

  useEffect(() => {
    async function fetchQuant() {
      try {
        const res = await fetch("/api/v1/quant/snapshot");
        if (res.ok) {
          const json = await res.json();
          if (json.success) setQuantData(json.data);
        }
      } catch (err) {
        console.error("Failed to fetch quant snapshot for Nexus", err);
      }
    }
    fetchQuant();
    const interval = setInterval(fetchQuant, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!nexusReasoning) { setDisplayedReasoning(""); return; }
    let i = 0;
    const speed = 15;
    const timer = setInterval(() => {
      setDisplayedReasoning(nexusReasoning.slice(0, i));
      i++;
      if (i > nexusReasoning.length) clearInterval(timer);
    }, speed);
    return () => clearInterval(timer);
  }, [nexusReasoning]);

  // Calculate Node States based on context data

    // 1. LIQUIDITY
  const liqStatus = liquidity?.status || "UNKNOWN";
  const isDraining = liqStatus === "DRAINING";
  const liqColor = isDraining ? "#ef4444" : (liqStatus === "INJECTING" ? "#22c55e" : "#64748b");
  const liqValue = liquidity ? `${liquidity.value.toFixed(2)}B` : "—";

  // 2. EQUITIES (Risk Assets)
  const spy = assets.find(a => a.ticker === "SPY")?.change ?? 0;
  const eqColor = spy > 0 ? "#22c55e" : (spy < 0 ? "#ef4444" : "#64748b");
  const eqValue = spy !== 0 ? `${spy > 0 ? '+' : ''}${spy.toFixed(2)}%` : "—";

  // 3. DOLLAR (DXY proxy via UUP)
  const uup = assets.find(a => a.ticker === "UUP")?.change ?? 0;
  const dxyColor = uup > 0 ? "#22c55e" : (uup < 0 ? "#ef4444" : "#64748b");
  const dxyValue = uup !== 0 ? `${uup > 0 ? '+' : ''}${uup.toFixed(2)}%` : "—";

  // 4. INFLATION (Proxy via TIP+GLD avg)
  const tip = assets.find(a => a.ticker === "TIP")?.change ?? 0;
  const gld = assets.find(a => a.ticker === "GLD")?.change ?? 0;
  const infProxy = (tip + gld) / 2;
  const infColor = infProxy > 0 ? "#ef4444" : "#22c55e"; 
  const infValue = infProxy !== 0 ? `${infProxy > 0 ? '+' : ''}${infProxy.toFixed(2)}%` : "—";

  // 5. YIELD CURVE (Quant)
  const spread = quantData?.spread2y10y ?? null;
  const isInverted = quantData?.inverted ?? false;
  const ycColor = isInverted ? "#ef4444" : "#22c55e";
  const ycValue = spread !== null ? `${spread > 0 ? '+' : ''}${spread} bps` : "—";

  // 6. VIX (Quant)
  const vix = quantData?.vix ?? 0;
  let vixColor = "#22c55e";
  if (vix >= 30) vixColor = "#ef4444";
  else if (vix >= 20) vixColor = "#f97316";
  else if (vix >= 15) vixColor = "#f59e0b";
  const vixValue = vix ? vix.toFixed(1) : "—";

  const tgaValue = quantData?.tgaValue ?? "—";
  const tgaColor = quantData?.tgaColor ?? "#64748b";

  const oilChange = quantData?.oilChange ?? null;
  const oilColor = oilChange != null ? (oilChange > 0 ? "#f59e0b" : "#3b82f6") : "#64748b";
  const oilValue = oilChange != null ? `${oilChange > 0 ? '+' : ''}${oilChange.toFixed(2)}%` : "—";

  const nominalYield10Y = quantData?.y10 ?? null;
  const realYield = nominalYield10Y != null ? nominalYield10Y - infProxy : null;
  const realYieldColor = realYield != null ? (realYield > 2 ? "#8b5cf6" : realYield > 0 ? "#a855f7" : "#c084fc") : "#64748b";
  const realYieldValue = realYield != null ? `${realYield.toFixed(2)}%` : "—";

  // New Nodes
  const ief = assets.find(a => a.ticker === "IEF")?.change ?? 0;
  const growthVal = spy - ief;
  const growthColor = growthVal > 0 ? "#22c55e" : "#ef4444";
  const growthValue = `${growthVal > 0 ? '+' : ''}${growthVal.toFixed(2)}%`;

  const goldColor = gld > 0 ? "#22c55e" : (gld < 0 ? "#ef4444" : "#64748b");
  const goldValue = gld !== 0 ? `${gld > 0 ? '+' : ''}${gld.toFixed(2)}%` : "—";

  // Node Positions (x, y percentages) — 14 NODES
  const nodes: Record<string, { x: number; y: number; color: string; label: string; icon: React.ElementType; value: string; in: number; out: number }> = {
    crb:    { x: 12, y: 15, color: "#f59e0b", label: "CRB COMMODITIES INDEX", icon: LineChart, value: "—", in: 1, out: 1 },
    oil:    { x: 12, y: 35, color: oilColor, label: "ENERGY/OIL", icon: Zap, value: oilValue, in: 0, out: 1 },
    onrrp:  { x: 12, y: 55, color: "#64748b", label: "ON RRP", icon: Droplets, value: liqValue, in: 0, out: 1 },
    tga:    { x: 12, y: 75, color: tgaColor, label: "TGA", icon: Building2, value: tgaValue, in: 0, out: 1 },

    growth: { x: 30, y: 20, color: growthColor, label: "GROWTH", icon: TrendingUp, value: growthValue, in: 0, out: 1 },
    inf:    { x: 30, y: 40, color: infColor, label: "INFLATION", icon: Activity, value: infValue, in: 2, out: 2 },
    liq:    { x: 30, y: 65, color: liqColor, label: "NET LIQUIDITY", icon: Droplets, value: liqValue, in: 2, out: 2 },

    fed:    { x: 50, y: 45, color: "#3b82f6", label: "FEDERAL RESERVE", icon: Building2, value: currentRegime || "MONITORING", in: 5, out: 1 },
    dxy:    { x: 50, y: 70, color: dxyColor, label: "DXY", icon: DollarSign, value: dxyValue, in: 1, out: 4 },

    yc:     { x: 68, y: 35, color: ycColor, label: "YIELD CURVE", icon: Activity, value: ycValue, in: 1, out: 2 },

    ry:     { x: 88, y: 20, color: realYieldColor, label: "REAL YIELD", icon: TrendingUp, value: realYieldValue, in: 2, out: 2 },
    eq:     { x: 88, y: 45, color: eqColor, label: "RISK ASSETS SP500", icon: TrendingUp, value: eqValue, in: 3, out: 0 },
    gold:   { x: 88, y: 65, color: goldColor, label: "SAFE HAVEN GOLD", icon: DollarSign, value: goldValue, in: 3, out: 0 },
    vix:    { x: 88, y: 85, color: vixColor, label: "VIX", icon: AlertOctagon, value: vixValue, in: 1, out: 3 },
  };

  const edgesData = [
    { from: 'crb', fromPort: 0, to: 'inf', toPort: 0 },
    { from: 'oil', fromPort: 0, to: 'inf', toPort: 1 },
    { from: 'onrrp', fromPort: 0, to: 'liq', toPort: 0 },
    { from: 'tga', fromPort: 0, to: 'liq', toPort: 1 },
    
    { from: 'growth', fromPort: 0, to: 'fed', toPort: 0 },
    { from: 'inf', fromPort: 1, to: 'fed', toPort: 1, route: 'inf-fed' },
    { from: 'liq', fromPort: 0, to: 'fed', toPort: 2 },
    { from: 'vix', fromPort: 0, to: 'fed', toPort: 3, route: 'vix-fed' },
    { from: 'dxy', fromPort: 0, to: 'fed', toPort: 4, route: 'dxy-fed' },

    { from: 'inf', fromPort: 0, to: 'ry', toPort: 0 },
    { from: 'liq', fromPort: 1, to: 'dxy', toPort: 0 },
    { from: 'fed', fromPort: 0, to: 'yc', toPort: 0 },

    { from: 'dxy', fromPort: 3, to: 'crb', toPort: 0, route: 'dxy-crb' },
    { from: 'dxy', fromPort: 1, to: 'eq', toPort: 1 },
    { from: 'dxy', fromPort: 2, to: 'gold', toPort: 1 },

    { from: 'yc', fromPort: 0, to: 'ry', toPort: 1 },
    { from: 'yc', fromPort: 1, to: 'vix', toPort: 0 },

    { from: 'ry', fromPort: 0, to: 'eq', toPort: 0 },
    { from: 'ry', fromPort: 1, to: 'gold', toPort: 0 },

    { from: 'vix', fromPort: 1, to: 'eq', toPort: 2 },
    { from: 'vix', fromPort: 2, to: 'gold', toPort: 2 },
  ];


  const fetchNexusAnalysis = async () => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    setNexusReasoning(null);
    setDisplayedReasoning("");
    try {
      const res = await fetch("/api/v1/macro-ai/analyze-nexus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodesData: nodes }),
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

  return (
    <div className="flex flex-col gap-4 overflow-hidden">
      <div className="relative w-full min-h-[640px] glass border border-border-subtle rounded-xl bg-bg-void overflow-hidden flex items-center justify-center">

        {/* Background Grid */}
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-10 pointer-events-none" />

        {/* Title & Controls */}
        <div className="absolute top-4 left-4 right-4 z-20 flex items-start justify-between">
          <div>
            <h2 className="text-[10px] sm:text-xs font-mono font-bold text-text-primary uppercase tracking-widest flex items-center gap-2">
              <Activity className="w-4 h-4 text-accent-gold" /> Macro Causal Loop
            </h2>
            <p className="text-[9px] font-mono text-text-muted mt-1 max-w-xs">
              Visualisasi real-time bagaimana likuiditas, inflasi, dan sentimen saling mempengaruhi aliran modal institusional.
            </p>
          </div>
          <button
            onClick={fetchNexusAnalysis}
            disabled={isAnalyzing}
            className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono font-bold uppercase rounded border border-accent-gold/30 bg-accent-gold/10 text-accent-gold hover:bg-accent-gold/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_10px_rgba(245,158,11,0.1)]"
          >
            {isAnalyzing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Cpu className="w-3 h-3" />}
            Analyze Flow
          </button>
        </div>

                {/* Causal Flow Edges */}
        {edgesData.map(({ from, fromPort, to, toPort, route }) => {
          const a = nodes[from];
          const b = nodes[to];
          if (!a || !b) return null;
          
          const start = getPort(a, 'out', fromPort);
          const end = getPort(b, 'in', toPort);
          
          return (
            <SvgEdge
              key={`${from}-${to}`}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              color={a.color}
              active={true}
            />
          );
        })}

        {/* Zone Labels */}
        <div className="absolute bottom-4 left-0 right-0 z-10 flex justify-around pointer-events-none px-8">
          <div className="flex flex-col items-center" style={{ position: "absolute", left: "12%", bottom: "2rem", transform: "translateX(-50%)" }}>
            <span className="text-zinc-500 text-[8px] font-mono tracking-[0.25em] uppercase">Zona 1 // Liquidity Drivers</span>
            <div className="mt-1 flex items-center gap-1">
              <span className="inline-block w-3 h-px bg-zinc-700" />
              <span className="inline-block w-1.5 h-1.5 border border-zinc-600 rotate-45" />
              <span className="inline-block w-3 h-px bg-zinc-700" />
            </div>
          </div>
          <div className="flex flex-col items-center" style={{ position: "absolute", left: "50%", bottom: "2rem", transform: "translateX(-50%)" }}>
            <span className="text-zinc-500 text-[8px] font-mono tracking-[0.25em] uppercase">Zona 2 // Policy Transformers</span>
            <div className="mt-1 flex items-center gap-1">
              <span className="inline-block w-3 h-px bg-zinc-700" />
              <span className="inline-block w-1.5 h-1.5 border border-zinc-600 rotate-45" />
              <span className="inline-block w-3 h-px bg-zinc-700" />
            </div>
          </div>
          <div className="flex flex-col items-center" style={{ position: "absolute", left: "84%", bottom: "2rem", transform: "translateX(-50%)" }}>
            <span className="text-zinc-500 text-[8px] font-mono tracking-[0.25em] uppercase">Zona 3 // Capital Destination</span>
            <div className="mt-1 flex items-center gap-1">
              <span className="inline-block w-3 h-px bg-zinc-700" />
              <span className="inline-block w-1.5 h-1.5 border border-zinc-600 rotate-45" />
              <span className="inline-block w-3 h-px bg-zinc-700" />
            </div>
          </div>
        </div>

        {Object.entries(nodes).map(([key, n]) => (
          <NexusNode
            key={key}
            id={key}
            label={n.label}
            value={n.value}
            icon={n.icon as any}
            statusColor={n.color}
            glowColor={n.color}
            x={n.x}
            y={n.y}
            pulsate={key === "fed" || (key === "liq" && !isDraining) || (key === "vix" && vix >= 20)}
            inputs={n.in}
            outputs={n.out}
          />
        ))}
      </div>

      {/* AI Reasoning Bottom Panel */}
      <div className="glass border border-border-subtle rounded-xl bg-bg-void p-4">
        <div className="flex items-center gap-2 mb-3">
          <Terminal className="w-4 h-4 text-accent-gold" />
          <span className="text-xs font-mono font-bold text-text-primary tracking-widest uppercase">
            Institutional Desk AI
          </span>
          {isAnalyzing && (
            <span className="text-[10px] font-mono text-text-muted ml-auto animate-pulse">
              Analyzing causal flow...
            </span>
          )}
        </div>
        <div className="text-[11px] font-mono leading-relaxed min-h-[60px]">
          {isAnalyzing ? (
            <div className="flex items-center gap-2 text-text-muted">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Memproses data node secara real-time...
            </div>
          ) : displayedReasoning ? (
            <p className="text-text-secondary whitespace-pre-line">
              {displayedReasoning}
              <span className="animate-pulse inline-block ml-1 w-1.5 h-3 bg-accent-gold align-middle"></span>
            </p>
          ) : (
            <p className="text-text-muted italic">
              Klik "Analyze Flow" untuk mendapatkan interpretasi arah aliran modal berdasarkan Causal Loop saat ini.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
