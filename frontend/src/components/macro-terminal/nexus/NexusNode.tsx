"use client";

import React from "react";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface NexusNodeProps {
  id: string;
  label: string;
  value: string | React.ReactNode;
  icon: LucideIcon;
  statusColor: string; // Tailwind color or hex
  glowColor: string;
  x: number;
  y: number;
  pulsate?: boolean;
}

export function NexusNode({ label, value, icon: Icon, statusColor, glowColor, x, y, pulsate }: NexusNodeProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="absolute flex flex-col items-center justify-center -translate-x-1/2 -translate-y-1/2 z-10"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      {/* Glow Backdrop */}
      <motion.div
        animate={{ scale: pulsate ? [1, 1.2, 1] : 1, opacity: pulsate ? [0.3, 0.6, 0.3] : 0.3 }}
        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        className="absolute w-24 h-24 rounded-full blur-xl pointer-events-none"
        style={{ backgroundColor: glowColor }}
      />
      
      {/* Node Container */}
      <div 
        className="relative flex flex-col items-center justify-center w-24 h-24 rounded-2xl glass border-2 shadow-lg hover:scale-105 transition-transform duration-300 cursor-default"
        style={{ borderColor: `${statusColor}40`, backgroundColor: "rgba(10,10,15,0.8)" }}
      >
        <Icon className="w-6 h-6 mb-2" style={{ color: statusColor }} />
        <span className="text-[9px] font-mono font-bold text-text-muted text-center leading-tight mb-1 uppercase px-1">
          {label}
        </span>
        <span className="text-xs font-mono font-bold" style={{ color: statusColor }}>
          {value}
        </span>
      </div>
    </motion.div>
  );
}
