"use client";

import React from "react";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface NexusNodeProps {
  id: string;
  label: string;
  value: string | React.ReactNode;
  statusLabel?: string;
  icon: LucideIcon;
  statusColor: string;
  glowColor: string;
  x: number;
  y: number;
  pulsate?: boolean;
}

export function NexusNode({
  label,
  value,
  statusLabel = "",
  icon: Icon,
  statusColor,
  glowColor,
  x,
  y,
  pulsate = false,
}: NexusNodeProps) {
return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
      className="absolute flex flex-col items-center justify-center -translate-x-1/2 -translate-y-1/2 z-10"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      {pulsate && (
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          className="absolute w-32 h-32 rounded-full blur-2xl pointer-events-none"
          style={{ backgroundColor: glowColor }}
        />
      )}
      <div
        className="relative flex flex-col items-center justify-center w-32 h-32 rounded-2xl border backdrop-blur-xl transition-all duration-300 cursor-default hover:-translate-y-1"
        style={{
          borderColor: `${statusColor}50`,
          backgroundColor: "rgba(10, 10, 20, 0.9)",
          boxShadow: `0 0 20px ${glowColor}20, inset 0 1px 0 rgba(255,255,255,0.08)`,
        }}
      >
        <Icon className="w-6 h-6 mb-2" style={{ color: statusColor }} />
        <span className="text-[10px] sm:text-xs font-mono font-semibold text-text-secondary text-center leading-tight mb-1 uppercase px-2 tracking-wider">
          {label}
        </span>
        <span className="text-sm sm:text-base font-mono font-bold tabular-nums mb-1" style={{ color: statusColor }}>
          {value}
        </span>
        <span className="text-[9px] sm:text-[10px] font-mono font-medium uppercase tracking-wider" style={{ color: statusColor, opacity: 0.85 }}>
          {statusLabel}
        </span>
      </div>
    </motion.div>
  );
}
