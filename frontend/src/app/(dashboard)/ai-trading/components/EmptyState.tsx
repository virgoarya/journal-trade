"use client";

import { Card } from "./Card";
import { AlertCircle, Search, Database, ChartNoAxesCombined, Brain, Zap } from "lucide-react";

interface EmptyStateProps {
  /** Type of empty state to render */
  type: "data" | "search" | "error" | "llm" | "positions" | "chart";
  /** Custom title (overrides default) */
  title?: string;
  /** Custom description (overrides default) */
  description?: string;
  /** Action button text */
  actionText?: string;
  /** Action button onClick handler */
  onAction?: () => void;
  /** Custom classes for the container */
  className?: string;
}

/**
 * EmptyState - Consistent empty state displays for AI Trading components.
 * Uses HUD panel styling for visual consistency.
 */
export function EmptyState({
  type,
  title,
  description,
  actionText,
  onAction,
  className = "",
}: EmptyStateProps) {
  const defaults = {
    data: {
      title: "No Data Available",
      description: "There's no data to display yet. Start the pipeline to see results.",
      icon: Database,
    },
    search: {
      title: "No Results Found",
      description: "Try adjusting your search terms or filters.",
      icon: Search,
    },
    error: {
      title: "Something Went Wrong",
      description: "We encountered an error while loading this data. Please try again later.",
      icon: AlertCircle,
    },
    llm: {
      title: "LLM Models Unavailable",
      description: "All LLM models are currently offline. Please check back later or try a different provider.",
      icon: Brain,
    },
    positions: {
      title: "No Open Positions",
      description: "You don't have any open positions at the moment. Start the pipeline to create trades.",
      icon: ChartNoAxesCombined,
    },
    chart: {
      title: "No Chart Data",
      description: "There's no chart data available. Start the pipeline to generate visualizations.",
      icon: ChartNoAxesCombined,
    },
  };

  const content = {
    title: title || defaults[type].title,
    description: description || defaults[type].description,
    icon: defaults[type].icon,
  };

  const Icon = content.icon;

  return (
    <div className={`glass p-6 text-center ${className}`}>
      <div className="flex flex-col items-center justify-center space-y-3">
        <div className="w-12 h-12 rounded-full border border-accent-gold/20 bg-black/40 flex items-center justify-center">
          <Icon className="w-6 h-6 text-accent-gold-dim" />
        </div>
        <h3 className="text-sm font-medium text-text-primary font-mono tracking-wider">{content.title}</h3>
        <p className="text-xs text-text-muted max-w-md">{content.description}</p>
        {actionText && onAction && (
          <button
            onClick={onAction}
            className="mt-3 px-4 py-1.5 bg-accent-gold/10 hover:bg-accent-gold/20 text-accent-gold text-xs font-mono font-medium rounded border border-accent-gold/30 hover:border-accent-gold/50 transition-all shadow-[0_0_8px_rgba(212,175,55,0)] hover:shadow-[0_0_8px_rgba(212,175,55,0.2)]"
          >
            {actionText}
          </button>
        )}
      </div>
    </div>
  );
}
