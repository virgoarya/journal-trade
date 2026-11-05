/**
 * Widget Workspace — Widget Registry
 *
 * Registry of available widgets that can be added to the workspace.
 * Maps widget IDs to their component definitions.
 */

import type { WidgetDefinition } from "./types";
import {
  Activity,
  BarChart3,
  Brain,
  Calendar,
  Droplets,
  Grid3X3,
  LineChart,
  Newspaper,
  Radar,
  Scale,
  TrendingUp,
} from "lucide-react";

/**
 * Widget registry — defines all available widgets.
 * Task 0.2: Only Overview widgets are registered.
 * Task 0.4: Will add widgets for other tabs.
 */
export const WIDGET_REGISTRY: Record<string, WidgetDefinition> = {
  "macro-regime": {
    id: "macro-regime",
    title: "Macro Regime",
    icon: Activity,
    defaultSize: { w: 6, h: 8 },
    minSize: { w: 4, h: 6 },
    hideable: true,
    removable: true,
    statusKey: "regime",
  },
  heatmap: {
    id: "heatmap",
    title: "ETF Heatmap",
    icon: Grid3X3,
    defaultSize: { w: 6, h: 6 },
    minSize: { w: 4, h: 4 },
    hideable: true,
    removable: true,
    statusKey: "quotes",
  },
  "ai-reasoning": {
    id: "ai-reasoning",
    title: "AI Reasoning",
    icon: Brain,
    defaultSize: { w: 6, h: 6 },
    minSize: { w: 4, h: 4 },
    hideable: true,
    removable: true,
    statusKey: "regime",
  },
  "liquidity-gauge": {
    id: "liquidity-gauge",
    title: "Liquidity Flow",
    icon: Droplets,
    defaultSize: { w: 6, h: 6 },
    minSize: { w: 4, h: 4 },
    hideable: true,
    removable: true,
    statusKey: "liquidity",
  },
  "economic-calendar": {
    id: "economic-calendar",
    title: "Economic Calendar",
    icon: Calendar,
    defaultSize: { w: 6, h: 5 },
    minSize: { w: 3, h: 4 },
    hideable: true,
    removable: true,
    statusKey: "calendar",
  },
  "news-feed": {
    id: "news-feed",
    title: "News Feed",
    icon: Newspaper,
    defaultSize: { w: 6, h: 5 },
    minSize: { w: 3, h: 4 },
    hideable: true,
    removable: true,
    statusKey: "news",
  },
  // Placeholder entries for other tabs (Task 0.4)
  "vix-regime": {
    id: "vix-regime",
    title: "VIX Regime",
    icon: TrendingUp,
    defaultSize: { w: 6, h: 6 },
    minSize: { w: 4, h: 4 },
    hideable: true,
    removable: true,
    statusKey: "quant",
  },
  "yield-curve": {
    id: "yield-curve",
    title: "Yield Curve",
    icon: LineChart,
    defaultSize: { w: 6, h: 7 },
    minSize: { w: 4, h: 5 },
    hideable: true,
    removable: true,
  },
  "cot-panel": {
    id: "cot-panel",
    title: "COT Panel",
    icon: BarChart3,
    defaultSize: { w: 6, h: 8 },
    minSize: { w: 4, h: 6 },
    hideable: true,
    removable: true,
    statusKey: "cot",
  },
  "cot-divergence": {
    id: "cot-divergence",
    title: "COT Divergence",
    icon: Scale,
    defaultSize: { w: 6, h: 6 },
    minSize: { w: 4, h: 4 },
    hideable: true,
    removable: true,
  },
  "geo-risk": {
    id: "geo-risk",
    title: "Geo Risk",
    icon: Radar,
    defaultSize: { w: 6, h: 6 },
    minSize: { w: 4, h: 4 },
    hideable: true,
    removable: true,
    statusKey: "geoRisk",
  },
  nexus: {
    id: "nexus",
    title: "Nexus",
    icon: Activity,
    defaultSize: { w: 12, h: 10 },
    minSize: { w: 6, h: 8 },
    hideable: false,
    removable: false,
    statusKey: "nexus",
  },
  "curve-explainer": {
    id: "curve-explainer",
    title: "AI Yield Analysis",
    icon: Brain,
    defaultSize: { w: 7, h: 16 },
    minSize: { w: 4, h: 6 },
    hideable: true,
    removable: true,
    statusKey: "regime",
  },
  "central-bank-differentials": {
    id: "central-bank-differentials",
    title: "Central Bank Differentials",
    icon: Scale,
    defaultSize: { w: 5, h: 6 },
    minSize: { w: 4, h: 4 },
    hideable: true,
    removable: true,
    statusKey: "quotes",
  },
  "agent-intelligence": {
    id: "agent-intelligence",
    title: "AI Command & Intelligence",
    icon: Brain,
    defaultSize: { w: 7, h: 12 },
    minSize: { w: 4, h: 6 },
    hideable: true,
    removable: true,
    statusKey: "regime",
  },
};

/**
 * Get a widget definition by ID.
 * Returns undefined if widget is not found.
 */
export function getWidgetDefinition(widgetId: string): WidgetDefinition | undefined {
  return WIDGET_REGISTRY[widgetId];
}

/**
 * Get all registered widget IDs.
 */
export function getRegisteredWidgetIds(): string[] {
  return Object.keys(WIDGET_REGISTRY);
}

/**
 * Check if a widget ID is registered.
 */
export function isWidgetRegistered(widgetId: string): boolean {
  return widgetId in WIDGET_REGISTRY;
}
