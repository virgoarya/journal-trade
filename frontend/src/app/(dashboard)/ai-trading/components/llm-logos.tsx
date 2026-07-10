"use client";

/**
 * Inline SVG logos for each LLM provider — proper brand marks, not letter abbreviations.
 * Each is a React component sized to `size` (default 40×40).
 */

import React from "react";

function cls(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(" ");
}

interface LogoProps {
  size?: number;
  className?: string;
}

/** DeepSeek — two nested downward V-shapes suggesting depth / data layers */
function DeepSeekLogo({ size = 40, className }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="18" fill="#1e1b4b" />
      {/* Outer V */}
      <path d="M10 12L20 30L30 12" stroke="#818cf8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Inner V */}
      <path d="M14 17L20 26L26 17" stroke="#4F46E5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

/** Qwen — stylized "Q" with ring and small tail */
function QwenLogo({ size = 40, className }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="18" fill="#172554" stroke="#3B82F6" strokeWidth="2" />
      {/* Ring node with 5 small connection dots (neural motif) */}
      <circle cx="16" cy="16" r="7" stroke="#60a5fa" strokeWidth="2" fill="none" />
      <circle cx="12" cy="14" r="1.5" fill="#3B82F6" />
      <circle cx="18" cy="10" r="1.5" fill="#3B82F6" />
      <circle cx="20" cy="18" r="1.5" fill="#3B82F6" />
      <circle cx="15" cy="21" r="1.5" fill="#3B82F6" />
      <circle cx="11" cy="18" r="1.5" fill="#3B82F6" />
      {/* Dot in center */}
      <circle cx="16" cy="16" r="2" fill="#3B82F6" />
    </svg>
  );
}

/** Gemini — 4-point sparkle star */
function GeminiLogo({ size = 40, className }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="18" fill="#052e16" stroke="#10B981" strokeWidth="2" />
      {/* 4-point star (Gemini) */}
      <path d="M20 6 L23 17 L34 20 L23 23 L20 34 L17 23 L6 20 L17 17 Z"
        fill="#34d399" stroke="#10B981" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

/** Mistral — 3 horizontal wind bars fanning right */
function MistralLogo({ size = 40, className }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="18" fill="#1c1917" stroke="#F59E0B" strokeWidth="2" />
      {/* 3 wind bars, shortest at top, longest at bottom */}
      <path d="M10 12L26 12" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M10 20L30 20" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M10 28L22 28" stroke="#fcd34d" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** Nemotron — stylized processor chip with center dot */
function NemotronLogo({ size = 40, className }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="18" fill="#1f1111" stroke="#EF4444" strokeWidth="2" />
      {/* Processor chip shape */}
      <rect x="11" y="11" width="18" height="18" rx="3" stroke="#f87171" strokeWidth="2" fill="none" />
      {/* Center dot */}
      <circle cx="20" cy="20" r="4" fill="#EF4444" />
      {/* 4 corner pins */}
      <circle cx="11" cy="11" r="1.5" fill="#fca5a5" />
      <circle cx="29" cy="11" r="1.5" fill="#fca5a5" />
      <circle cx="11" cy="29" r="1.5" fill="#fca5a5" />
      <circle cx="29" cy="29" r="1.5" fill="#fca5a5" />
    </svg>
  );
}

/** Claude — sunburst / radiating lines */
function ClaudeLogo({ size = 40, className }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="18" fill="#1a1206" stroke="#D4AF37" strokeWidth="2" />
      {/* Radiating sunburst */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
        <line
          key={angle}
          x1={20}
          y1={20}
          x2={20 + 12 * Math.cos((angle * Math.PI) / 180)}
          y2={20 + 12 * Math.sin((angle * Math.PI) / 180)}
          stroke="#D4AF37"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity={0.6}
        />
      ))}
      {/* Center circle */}
      <circle cx="20" cy="20" r="4" fill="#D4AF37" />
    </svg>
  );
}

/** Generic AI / fallback logo for unknown providers */
function GenericAILogo({ size = 40, className }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="18" fill="#1f2937" stroke="#6B7280" strokeWidth="2" />
      {/* Brain/nodes motif */}
      <circle cx="15" cy="15" r="3" stroke="#9CA3AF" strokeWidth="1.5" fill="none" />
      <circle cx="25" cy="15" r="3" stroke="#9CA3AF" strokeWidth="1.5" fill="none" />
      <circle cx="20" cy="25" r="3" stroke="#9CA3AF" strokeWidth="1.5" fill="none" />
      <line x1="18" y1="15" x2="22" y2="25" stroke="#6B7280" strokeWidth="1" />
      <line x1="22" y1="15" x2="18" y2="25" stroke="#6B7280" strokeWidth="1" />
      <line x1="15" y1="15" x2="20" y2="25" stroke="#6B7280" strokeWidth="1" />
      <line x1="25" y1="15" x2="20" y2="25" stroke="#6B7280" strokeWidth="1" />
      <line x1="15" y1="15" x2="25" y2="15" stroke="#6B7280" strokeWidth="1" />
    </svg>
  );
}

const LOGO_MAP: Record<string, React.FC<LogoProps>> = {
  deepseek: DeepSeekLogo,
  qwen: QwenLogo,
  gemini: GeminiLogo,
  mistral: MistralLogo,
  nemotron: NemotronLogo,
  "claude-opus": ClaudeLogo,
};

export function LLMProviderLogo({ provider, size = 40, className }: LogoProps & { provider: string }) {
  const Component = LOGO_MAP[provider];
  if (!Component) return <GenericAILogo size={size} className={className} />;
  return <Component size={size} className={className} />;
}

export { DeepSeekLogo, QwenLogo, GeminiLogo, MistralLogo, NemotronLogo, ClaudeLogo, GenericAILogo };
export type { LogoProps };