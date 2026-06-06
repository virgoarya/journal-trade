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
  RefreshCw
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

  // Typing animation effect
  useEffect(() => {
    if (!nexusReasoning) {
      setDisplayedReasoning("");
      return;
    }
    
    let i = 0;
    const speed = 15; // ms per char
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
      if (data.success) {
        setNexusReasoning(data.reasoning);
      } else {
        setNexusReasoning("Gagal mendapatkan analisis: " + data.error);
      }
    } catch (err: any) {
      setNexusReasoning("Terjadi kesalahan saat memanggil AI: " + err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-full h-[600px] glass border border-border-subtle rounded-xl bg-bg-void overflow-hidden flex items-center justify-center">
      
      {/* Background Grid */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-10 pointer-events-none" />

      {/* Title & Controls */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-start justify-between">
        <div>
          <h2 className="text-sm font-mono font-bold text-text-primary uppercase tracking-widest flex items-center gap-2">
            <Activity className="w-4 h-4 text-accent-gold" /> Macro Causal Loop
          </h2>
          <p className="text-[10px] font-mono text-text-muted mt-1 max-w-xs">
            Visualisasi real-time bagaimana likuiditas, inflasi, dan sentimen saling mempengaruhi aliran modal institusional.
          </p>
        </div>
        <button
          onClick={fetchNexusAnalysis}
          disabled={isAnalyzing}
          className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-mono font-bold uppercase rounded border border-accent-gold/30 bg-accent-gold/10 text-accent-gold hover:bg-accent-gold/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_10px_rgba(245,158,11,0.1)]"
        >
          {isAnalyzing ? (
            <RefreshCw className="w-3 h-3 animate-spin" />
          ) : (
            <Cpu className="w-3 h-3" />
          )}
          Analyze Flow
        </button>
      </div>

      {/* We no longer need the global SVG because SvgEdge wraps its own SVG */}
        
      {/* Fed -> Liquidity */}
      <SvgEdge x1={nodes.fed.x} y1={nodes.fed.y} x2={nodes.liq.x} y2={nodes.liq.y} color={nodes.liq.color} active={!isDraining} />
      {/* Liquidity -> Equities */}
      <SvgEdge x1={nodes.liq.x} y1={nodes.liq.y} x2={nodes.eq.x} y2={nodes.eq.y} color={nodes.liq.color} active={liqStatus !== "UNKNOWN"} />
      
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
