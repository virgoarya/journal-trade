/**
 * Widget Workspace — Shared Types
 *
 * Core type definitions for the widget workspace system.
 * These types are used across the provider, grid, shell, and registry.
 */

import type { ComponentType, ReactNode } from "react";

/** Data status indicator for widget headers */
export type WidgetDataStatus = "live" | "cache" | "fallback" | "stale" | "error";

/** A single item in the tab layout */
export interface WidgetLayoutItem {
  /** Unique widget identifier (must match registry) */
  i: string;
  /** X position in grid columns (0-indexed) */
  x: number;
  /** Y position in grid rows (0-indexed) */
  y: number;
  /** Width in grid units */
  w: number;
  /** Height in grid units */
  h: number;
  /** Minimum width in grid units */
  minW?: number;
  /** Minimum height in grid units */
  minH?: number;
  /** Maximum width in grid units */
  maxW?: number;
  /** Maximum height in grid units */
  maxH?: number;
}

/** Complete layout for a single tab */
export interface TabLayout {
  /** Layout items in the grid */
  items: WidgetLayoutItem[];
  /** Widget IDs that are hidden (still in items, not rendered) */
  hidden: string[];
}

/** Workspace state shape */
export interface WidgetWorkspaceState {
  /** Layout per tab (key = tab identifier) */
  layouts: Record<string, TabLayout>;
  /** Currently active tab */
  activeTab: string;
  /** Schema version for migrations */
  version: number;

  // Actions
  setLayout: (tab: string, layout: TabLayout) => void;
  updateWidget: (tab: string, widgetId: string, updates: Partial<WidgetLayoutItem>) => void;
  addWidget: (tab: string, widgetId: string, position?: { x: number; y: number }) => void;
  removeWidget: (tab: string, widgetId: string) => void;
  toggleHide: (tab: string, widgetId: string) => void;
  resetLayout: (tab: string) => void;
  resetAll: () => void;
  importLayout: (tab: string, layout: TabLayout) => void;
  setActiveTab: (tab: string) => void;
}

/** Widget definition in the registry */
export interface WidgetDefinition {
  /** Unique widget ID */
  id: string;
  /** Display title */
  title: string;
  /** Lucide icon component */
  icon?: ComponentType<{ className?: string }>;
  /** Default size in grid units */
  defaultSize: { w: number; h: number };
  /** Minimum size in grid units */
  minSize: { w: number; h: number };
  /** Whether the widget can be hidden */
  hideable?: boolean;
  /** Whether the widget can be removed */
  removable?: boolean;
  /** Whether the widget can be refreshed */
  refreshable?: boolean;
  /** Status field key from MacroTerminalContext */
  statusKey?: string;
}

/** WidgetShell component props */
export interface WidgetShellProps {
  /** Unique widget ID (must match layout key) */
  widgetId: string;
  /** Panel title displayed in header */
  title: string;
  /** Lucide icon component for header */
  icon?: ComponentType<{ className?: string }>;
  /** Data status indicator */
  dataStatus?: WidgetDataStatus;
  /** Optional badge on the right side of header */
  headerBadge?: ReactNode;
  /** Panel body content */
  children: ReactNode;
  /** Additional CSS classes for the shell wrapper */
  className?: string;
  /** Additional CSS classes for the body area */
  bodyClassName?: string;
  /** Whether the widget can be hidden (default: true) */
  hideable?: boolean;
  /** Whether the widget can be removed (default: true) */
  removable?: boolean;
  /** Whether the widget can be refreshed (default: false) */
  refreshable?: boolean;
}

/** Grid configuration constants */
export const GRID_CONFIG = {
  COLS: 12,
  ROW_HEIGHT: 60,
  MARGIN: [12, 12] as [number, number],
  CONTAINER_PADDING: [0, 0] as [number, number],
  COMPACT_TYPE: "vertical" as const,
  MOBILE_BREAKPOINT: 768,
  MAX_WIDGETS_PER_TAB: 20,
} as const;

/** Storage key prefix for localStorage persistence */
export const STORAGE_KEY_PREFIX = "macro-terminal:layout:";

/** Current schema version for migration handling */
export const SCHEMA_VERSION = 4;

/** Feature flag environment variable name */
export const FEATURE_FLAG_NAME = "NEXT_PUBLIC_WIDGET_WORKSPACE_ENABLED";
