"use client";

import { ReactNode } from "react";
import { ChevronRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { clsx } from "clsx";

export interface DashboardCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    label?: string;
    trend?: "up" | "down" | "neutral";
  };
  subtitle?: string;
  icon?: ReactNode;
  href?: string;
  variant?: "default" | "profit" | "loss" | "warning";
  className?: string;
}

export function DashboardCard({
  title,
  value,
  change,
  subtitle,
  icon,
  href,
  variant = "default",
  className,
}: DashboardCardProps) {
  const variantClasses = {
    default: "border-white/5 hover:border-accent-gold/20",
    profit: "border-neon-green/20 hover:border-neon-green/30",
    loss: "border-neon-red/20 hover:border-neon-red/30",
    warning: "border-neon-orange/20 hover:border-neon-orange/30",
  };

  const trendIcon = change?.trend === "up" ? (
    <TrendingUp className="w-3 h-3 text-neon-green" />
  ) : change?.trend === "down" ? (
    <TrendingDown className="w-3 h-3 text-neon-red" />
  ) : (
    <Minus className="w-3 h-3 text-text-muted" />
  );

  const trendColor = change?.trend === "up" ? "text-neon-green" :
    change?.trend === "down" ? "text-neon-red" : "text-text-muted";

  const Content = href ? "a" : "div";

  return (
    <Content
      href={href}
      className={clsx(
        "glass p-4 sm:p-5 h-full flex flex-col justify-between",
        "border transition-all duration-300 shadow-2xl relative overflow-hidden group",
        "focus:outline-none focus:ring-2 focus:ring-accent-gold/40 focus:ring-offset-2 focus:ring-offset-bg-void",
        variantClasses[variant],
        className
      )}
      style={href ? { textDecoration: "none" } : undefined}
    >
      <div className="absolute -right-8 -top-8 w-24 h-24 bg-accent-gold/5 rounded-full blur-3xl group-hover:bg-accent-gold/10 transition-all duration-500" />

      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className="flex items-center gap-2.5">
          {icon && (
            <div className="p-1.5 bg-accent-gold/10 rounded-lg border border-accent-gold/20">
              {icon}
            </div>
          )}
          <h4 className="font-semibold text-xs sm:text-sm text-text-primary uppercase tracking-[0.2em] drop-shadow-sm">
            {title}
          </h4>
        </div>
        {href && (
          <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-accent-gold transition-colors duration-300 opacity-0 group-hover:opacity-100 transform translate-x-1 group-hover:translate-x-0" />
        )}
      </div>

      <div className="relative z-10">
        <div className="font-mono text-2xl sm:text-3xl font-black text-text-primary tracking-tight tabular-nums mb-2">
          {value}
        </div>
        {subtitle && (
          <p className="text-[10px] text-text-muted font-mono uppercase tracking-wider mb-3">
            {subtitle}
          </p>
        )}
        {change && (
          <div className={clsx("flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider", trendColor)}>
            {trendIcon}
            <span className="font-bold">{change.value >= 0 ? "+" : ""}{change.value.toFixed(1)}%</span>
            {change.label && <span className="text-text-muted">{change.label}</span>}
          </div>
        )}
      </div>
    </Content>
  );
}