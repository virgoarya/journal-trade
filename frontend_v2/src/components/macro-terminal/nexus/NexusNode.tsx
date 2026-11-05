"use client";

import React from "react";
import { motion } from "framer-motion";

interface NexusNodeProps {
  id?: string;
  label: string;
  statusText?: string;
  value: string | React.ReactNode;
  icon: React.ElementType;
  statusColor: string;
  glowColor: string;
  x: number;
  y: number;
  pulsate?: boolean;
  inputs?: number;
  outputs?: number;
  quality?: {
    source: string;
    freshness: "live" | "cache" | "stale" | "error";
    confidence: number;
  };
}

export function NexusNode({
  label,
  statusText,
  value,
  icon: Icon,
  statusColor,
  glowColor,
  x,
  y,
  pulsate = false,
  inputs = 0,
  outputs = 0,
  quality,
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
        <Icon className="w-5 h-5 mb-1.5" style={{ color: statusColor }} />
        <span className="text-[8px] font-mono font-bold text-text-muted text-center leading-tight mb-0.5 uppercase px-2 tracking-widest">
          {label}
        </span>
        {statusText && (
          <span
            className="text-[6.5px] font-mono font-bold text-center leading-tight mb-1 uppercase px-1.5 py-0.5 rounded shadow-sm backdrop-blur-sm"
            style={{
              color: statusColor,
              backgroundColor: `${statusColor}15`,
              border: `1px solid ${statusColor}40`,
            }}
          >
            {statusText}
          </span>
        )}
        {quality && (
          <span className="text-[5.5px] font-mono text-center leading-tight mb-1 text-text-muted">
            {quality.source} · {quality.freshness.toUpperCase()} ·{" "}
            {quality.confidence}%
          </span>
        )}
        <span
          className="text-sm font-mono font-bold tabular-nums"
          style={{ color: statusColor }}
        >
          {value}
        </span>
      </div>

      {inputs > 0 &&
        Array.from({ length: inputs }).map((_, i) => {
          const offsetPx = (i - (inputs - 1) / 2) * 16;
          return (
            <div
              key={`in-${i}`}
              className="absolute left-0 w-1.5 h-1.5 bg-[#ef4444] rounded-sm -translate-x-1.5 -translate-y-1/2 z-20"
              style={{
                top: `calc(50% + ${offsetPx}px)`,
                boxShadow: "0 0 4px #ef4444",
              }}
            />
          );
        })}

      {outputs > 0 &&
        Array.from({ length: outputs }).map((_, i) => {
          const offsetPx = (i - (outputs - 1) / 2) * 16;
          return (
            <div
              key={`out-${i}`}
              className="absolute right-0 w-1.5 h-1.5 bg-[#ef4444] rounded-sm translate-x-1.5 -translate-y-1/2 z-20"
              style={{
                top: `calc(50% + ${offsetPx}px)`,
                boxShadow: "0 0 4px #ef4444",
              }}
            />
          );
        })}
    </motion.div>
  );
}
