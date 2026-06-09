"use client";

import React from "react";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface NexusNodeProps {
  id: string;
  label: string;
  value: string | React.ReactNode;
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
          animate={{ scale: [1, 1.25, 1], opacity: [0.25, 0.5, 0.25] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          className="absolute w-28 h-28 rounded-full blur-2xl pointer-events-none"
          style={{ backgroundColor: glowColor }}
        />
      )}
      <div
        className="relative flex flex-col items-center justify-center w-28 h-28 rounded-2xl border backdrop-blur-xl transition-all duration-500 cursor-default"
        style={{
          borderColor: `${statusColor}35`,
          backgroundColor: "rgba(8, 8, 14, 0.85)",
          boxShadow: `0 0 24px ${glowColor}18, 0 0 60px ${glowColor}08, inset 0 1px 0 rgba(255,255,255,0.05)`,
        }}
      >
        <Icon className="w-5 h-5 mb-2" style={{ color: statusColor }} />
        <span className="text-[8px] font-mono font-bold text-text-muted text-center leading-tight mb-1 uppercase px-2 tracking-widest">
          {label}
        </span>
        <span className="text-sm font-mono font-bold tabular-nums" style={{ color: statusColor }}>
          {value}
        </span>
      </div>
    </motion.div>
  );
}
