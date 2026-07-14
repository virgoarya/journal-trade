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
    <div 
      className={cls("rounded-md overflow-hidden flex-shrink-0 bg-[#4d6bfe] shadow-[0_0_15px_rgba(77,107,254,0.5)] border border-[#4d6bfe]/50", className)} 
      style={{ width: size, height: size }}
    >
      <img 
        src="/deepseek.png" 
        alt="DeepSeek" 
        className="w-full h-full object-cover p-1.5"
        onError={(e) => {
          // Fallback to official deepseek logo if the user hasn't saved the file yet
          (e.target as HTMLImageElement).src = "https://chat.deepseek.com/favicon.svg";
        }}
      />
    </div>
  );
}

/** Qwen — stylized "Q" with ring and small tail */
function QwenLogo({ size = 40, className }: LogoProps) {
  return (
    <div 
      className={cls("rounded-md overflow-hidden flex-shrink-0 bg-[#6366f1] shadow-[0_0_15px_rgba(99,102,241,0.5)] border border-[#6366f1]/50", className)} 
      style={{ width: size, height: size }}
    >
      <img 
        src="/qwen.png" 
        alt="Qwen" 
        className="w-full h-full object-cover p-1"
        onError={(e) => {
          // Fallback to official Qwen avatar if the user hasn't saved the file yet
          (e.target as HTMLImageElement).src = "https://avatars.githubusercontent.com/u/148330874?v=4";
        }}
      />
    </div>
  );
}

/** Gemini — 4-point sparkle star */
function GeminiLogo({ size = 40, className }: LogoProps) {
  return (
    <div 
      className={cls("rounded-md overflow-hidden flex-shrink-0 bg-white shadow-[0_0_15px_rgba(255,255,255,0.3)] border border-white/50", className)} 
      style={{ width: size, height: size }}
    >
      <img 
        src="/gemini.png" 
        alt="Gemini" 
        className="w-full h-full object-cover p-1"
        onError={(e) => {
          // Fallback to official Gemini sparkle if the user hasn't saved the file yet
          (e.target as HTMLImageElement).src = "https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg";
        }}
      />
    </div>
  );
}

/** Mistral — 3 horizontal wind bars fanning right */
function MistralLogo({ size = 40, className }: LogoProps) {
  return (
    <div 
      className={cls("rounded-md overflow-hidden flex-shrink-0 bg-[#fbbf24] shadow-[0_0_15px_rgba(251,191,36,0.5)] border border-[#fbbf24]/50", className)} 
      style={{ width: size, height: size }}
    >
      <img 
        src="/mistral.png" 
        alt="Mistral" 
        className="w-full h-full object-cover p-1"
        onError={(e) => {
          // Fallback to official Mistral avatar if the user hasn't saved the file yet
          (e.target as HTMLImageElement).src = "https://avatars.githubusercontent.com/u/132470725?v=4";
        }}
      />
    </div>
  );
}

/** Nemotron — stylized processor chip with center dot */
function NemotronLogo({ size = 40, className }: LogoProps) {
  return (
    <div 
      className={cls("rounded-md overflow-hidden flex-shrink-0 bg-[#76b900] shadow-[0_0_15px_rgba(118,185,0,0.5)] border border-[#76b900]/50", className)} 
      style={{ width: size, height: size }}
    >
      <img 
        src="/nemotron.png" 
        alt="Nemotron" 
        className="w-full h-full object-cover p-1"
        onError={(e) => {
          // Fallback to official NVIDIA avatar if the user hasn't saved the file yet
          (e.target as HTMLImageElement).src = "https://avatars.githubusercontent.com/u/1728152?v=4";
        }}
      />
    </div>
  );
}

/** Claude — sunburst / radiating lines */
function ClaudeLogo({ size = 40, className }: LogoProps) {
  return (
    <div 
      className={cls("rounded-md overflow-hidden flex-shrink-0 bg-[#d4af37] shadow-[0_0_15px_rgba(212,175,55,0.5)] border border-[#d4af37]/50", className)} 
      style={{ width: size, height: size }}
    >
      <img 
        src="/claude.png" 
        alt="Claude" 
        className="w-full h-full object-cover p-1"
        onError={(e) => {
          // Fallback to official Anthropic avatar if the user hasn't saved the file yet
          (e.target as HTMLImageElement).src = "https://avatars.githubusercontent.com/u/84511046?v=4";
        }}
      />
    </div>
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