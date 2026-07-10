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
 *
 * Provides clear, actionable empty states with:
 * - Appropriate icons
 * - Helpful messages
 * - Optional action buttons
 *
 * Uses Card component for consistent styling.
 */
export function EmptyState({
  type,
  title,
  description,
  actionText,
  onAction,
  className = "",
}: EmptyStateProps) {
  // Default content for each type
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
    <Card className={`text-center ${className}`}>
      <div className="flex flex-col items-center justify-center space-y-3">
        <Icon className="w-10 h-10 text-gray-500" />
        <h3 className="text-sm font-medium text-gray-200">{content.title}</h3>
        <p className="text-xs text-gray-500 max-w-md">{content.description}</p>
        {actionText && onAction && (
          <button
            onClick={onAction}
            className="mt-3 px-3 py-1.5 bg-accent-gold/10 hover:bg-accent-gold/20 text-accent-gold text-xs font-medium rounded transition"
          >
            {actionText}
          </button>
        )}
      </div>
    </Card>
  );
}
