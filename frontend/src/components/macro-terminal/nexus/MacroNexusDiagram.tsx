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
  Activity
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

// Proper SVG Edge
function SvgEdge({ 
  x1, y1, x2, y2, color, active 
}: { 
  x1: number, y1: number, x2: number, y2: number, color: string, active: boolean 
}) {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
      <defs>
        <linearGradient id={`grad-${x1}-${y1}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0.8" />
        </linearGradient>
      </defs>
      <path
        d={`M ${x1} ${y1} L ${x2} ${y2}`}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeOpacity={0.3}
        strokeDasharray="4 4"
      />
      {active && (
        <motion.circle
          r="3"
          fill={color}
          style={{ filter: `drop-shadow(0 0 4px ${color})` }}
          animate={{
            cx: [`${x1}%`, `${x2}%`],
            cy: [`${y1}%`, `${y2}%`],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "linear"
          }}
        />
      )}
    </svg>
  );
}

export function MacroNexusDiagram() {
  const { assets, liquidity, currentRegime } = useMacroTerminal();
  const [quantData, setQuantData] = useState<any>(null);

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

  // Calculate Node States based on context data

  // 1. LIQUIDITY
  const liqStatus = liquidity?.status || "UNKNOWN";
  const isDraining = liqStatus === "DRAINING";
  const liqColor = isDraining ? "#ef4444" : (liqStatus === "INJECTING" ? "#22c55e" : "#64748b");
  const liqValue = liquidity ? `$${liquidity.value.toFixed(2)}B` : "—";

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
  const infColor = infProxy > 0 ? "#ef4444" : "#22c55e"; // Inflation up is "red/hot", down is "green/cool"
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

  // Node Positions (x, y percentages)
  const nodes = {
    fed: { x: 50, y: 50, color: "#3b82f6", label: "Federal Reserve", icon: Building2, value: currentRegime || "MONITORING" },
    liq: { x: 20, y: 25, color: liqColor, label: "Liquidity (RRP)", icon: Droplets, value: liqValue },
    yc:  { x: 80, y: 25, color: ycColor, label: "Yield Curve", icon: Activity, value: ycValue },
    vix: { x: 20, y: 75, color: vixColor, label: "Market Fear", icon: AlertOctagon, value: vixValue },
    eq:  { x: 80, y: 75, color: eqColor, label: "Risk Assets", icon: TrendingUp, value: eqValue },
    dxy: { x: 50, y: 15, color: dxyColor, label: "US Dollar", icon: DollarSign, value: dxyValue },
    inf: { x: 50, y: 85, color: infColor, label: "Inflation Proxy", icon: LineChart, value: infValue },
  };

  return (
    <div className="relative w-full h-[600px] glass border border-border-subtle rounded-xl bg-bg-void overflow-hidden flex items-center justify-center">
      
      {/* Background Grid */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-10 pointer-events-none" />

      {/* Title */}
      <div className="absolute top-4 left-4 z-20">
        <h2 className="text-sm font-mono font-bold text-text-primary uppercase tracking-widest flex items-center gap-2">
          <Activity className="w-4 h-4 text-accent-gold" /> Macro Causal Loop
        </h2>
        <p className="text-[10px] font-mono text-text-muted mt-1 max-w-xs">
          Visualisasi real-time bagaimana likuiditas, inflasi, dan sentimen saling mempengaruhi aliran modal institusional.
        </p>
      </div>

      {/* SVG Edges Layer */}
      {/* 
        To make SVG lines responsive to percentages, we draw them from % to %.
        React doesn't natively support % in SVG x1/y1 without wrapping in a full-size SVG. 
      */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        
        {/* Fed -> Liquidity */}
        <SvgEdge x1={nodes.fed.x} y1={nodes.fed.y} x2={nodes.liq.x} y2={nodes.liq.y} color={nodes.liq.color} active={!isDraining} />
        {/* Liquidity -> Equities */}
        <SvgEdge x1={nodes.liq.x} y1={nodes.liq.y} x2={nodes.eq.x} y2={nodes.eq.y} color={nodes.eq.color} active={!isDraining} />
        
        {/* DXY -> Liquidity (Inverse) */}
        <SvgEdge x1={nodes.dxy.x} y1={nodes.dxy.y} x2={nodes.liq.x} y2={nodes.liq.y} color={nodes.dxy.color} active={uup > 0} />
        
        {/* Fed -> Yield Curve */}
        <SvgEdge x1={nodes.fed.x} y1={nodes.fed.y} x2={nodes.yc.x} y2={nodes.yc.y} color={nodes.yc.color} active={true} />
        
        {/* Yield Curve -> Equities */}
        <SvgEdge x1={nodes.yc.x} y1={nodes.yc.y} x2={nodes.eq.x} y2={nodes.eq.y} color={nodes.yc.color} active={!isInverted} />
        
        {/* VIX -> Equities */}
        <SvgEdge x1={nodes.vix.x} y1={nodes.vix.y} x2={nodes.eq.x} y2={nodes.eq.y} color={nodes.vix.color} active={vix >= 20} />
        
        {/* Inflation -> Fed */}
        <SvgEdge x1={nodes.inf.x} y1={nodes.inf.y} x2={nodes.fed.x} y2={nodes.fed.y} color={nodes.inf.color} active={infProxy > 0} />

      </svg>

      {/* Nodes Layer */}
      {Object.entries(nodes).map(([key, n]) => (
        <NexusNode
          key={key}
          id={key}
          label={n.label}
          value={n.value}
          icon={n.icon}
          statusColor={n.color}
          glowColor={n.color}
          x={n.x}
          y={n.y}
          pulsate={key === "fed" || (key === "liq" && !isDraining) || (key === "vix" && vix >= 20)}
        />
      ))}
      
    </div>
  );
}
