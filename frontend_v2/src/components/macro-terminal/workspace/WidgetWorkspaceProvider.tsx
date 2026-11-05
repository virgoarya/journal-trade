"use client";

/**
 * Widget Workspace — Provider & Context
 *
 * Zustand-based state management for widget workspace.
 * Handles layout state, persistence, and validation.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  WidgetWorkspaceState,
  TabLayout,
  WidgetLayoutItem,
} from "./types";
import {
  STORAGE_KEY_PREFIX,
  SCHEMA_VERSION,
  GRID_CONFIG,
} from "./types";
import { getDefaultLayout } from "./DEFAULT_LAYOUTS";

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate a layout item.
 * Returns true if the item has valid structure and values.
 */
function isValidLayoutItem(item: unknown): item is WidgetLayoutItem {
  if (!item || typeof item !== "object") return false;
  const it = item as Record<string, unknown>;
  if (typeof it.i !== "string" || it.i.length === 0) return false;
  if (typeof it.x !== "number" || it.x < 0) return false;
  if (typeof it.y !== "number" || it.y < 0) return false;
  if (typeof it.w !== "number" || it.w < 1) return false;
  if (typeof it.h !== "number" || it.h < 1) return false;
  // Clamp to reasonable bounds
  if (it.w > GRID_CONFIG.COLS || it.h > 50) return false;
  return true;
}

/**
 * Validate a complete tab layout.
 * Returns the layout if valid, null otherwise.
 */
function validateTabLayout(raw: unknown): TabLayout | null {
  if (!raw || typeof raw !== "object") return null;
  const layout = raw as Record<string, unknown>;
  if (!Array.isArray(layout.items)) return null;
  if (!Array.isArray(layout.hidden)) return null;
  // Validate each item
  for (const item of layout.items) {
    if (!isValidLayoutItem(item)) return null;
  }
  return layout as unknown as TabLayout;
}

// ─────────────────────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────────────────────

interface WidgetWorkspaceStore {
  layouts: Record<string, TabLayout>;
  activeTab: string;
  version: number;

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

const useWidgetWorkspaceStore = create<WidgetWorkspaceStore>()(
  persist(
    (set, get) => ({
      layouts: {},
      activeTab: "overview",
      version: SCHEMA_VERSION,

      setLayout: (tab, layout) =>
        set((state) => ({
          layouts: { ...state.layouts, [tab]: layout },
        })),

      updateWidget: (tab, widgetId, updates) =>
        set((state) => {
          const tabLayout = state.layouts[tab];
          if (!tabLayout) return state;
          const items = tabLayout.items.map((item) =>
            item.i === widgetId ? { ...item, ...updates } : item
          );
          return {
            layouts: {
              ...state.layouts,
              [tab]: { ...tabLayout, items },
            },
          };
        }),

      addWidget: (tab, widgetId, position) =>
        set((state) => {
          const tabLayout = state.layouts[tab] ?? getDefaultLayout(tab);
          // Check if already exists
          if (tabLayout.items.some((item) => item.i === widgetId)) return state;
          // Check max widgets limit
          if (tabLayout.items.length >= GRID_CONFIG.MAX_WIDGETS_PER_TAB) return state;

          const newItem: WidgetLayoutItem = {
            i: widgetId,
            x: position?.x ?? 0,
            y: position?.y ?? 0,
            w: 6,
            h: 6,
          };
          return {
            layouts: {
              ...state.layouts,
              [tab]: { ...tabLayout, items: [...tabLayout.items, newItem] },
            },
          };
        }),

      removeWidget: (tab, widgetId) =>
        set((state) => {
          const tabLayout = state.layouts[tab];
          if (!tabLayout) return state;
          return {
            layouts: {
              ...state.layouts,
              [tab]: {
                ...tabLayout,
                items: tabLayout.items.filter((item) => item.i !== widgetId),
                hidden: tabLayout.hidden.filter((id) => id !== widgetId),
              },
            },
          };
        }),

      toggleHide: (tab, widgetId) =>
        set((state) => {
          const tabLayout = state.layouts[tab];
          if (!tabLayout) return state;
          const isHidden = tabLayout.hidden.includes(widgetId);
          return {
            layouts: {
              ...state.layouts,
              [tab]: {
                ...tabLayout,
                hidden: isHidden
                  ? tabLayout.hidden.filter((id) => id !== widgetId)
                  : [...tabLayout.hidden, widgetId],
              },
            },
          };
        }),

      resetLayout: (tab) =>
        set((state) => ({
          layouts: {
            ...state.layouts,
            [tab]: getDefaultLayout(tab),
          },
        })),

      resetAll: () =>
        set({
          layouts: {},
        }),

      importLayout: (tab, layout) =>
        set((state) => ({
          layouts: { ...state.layouts, [tab]: layout },
        })),

      setActiveTab: (tab) => set({ activeTab: tab }),
    }),
    {
      name: "macro-terminal-workspace",
      version: SCHEMA_VERSION,
      partialize: (state) => ({
        layouts: state.layouts,
        version: state.version,
      }),
      migrate: (persistedState: unknown, version: number) => {
        // Simple migration: if version mismatch, discard persisted state
        if (version !== SCHEMA_VERSION) {
          return { layouts: {}, version: SCHEMA_VERSION };
        }
        // Validate persisted layouts
        const state = persistedState as { layouts: Record<string, TabLayout> };
        if (!state.layouts || typeof state.layouts !== "object") {
          return { layouts: {}, version: SCHEMA_VERSION };
        }
        // Validate each tab layout
        const validLayouts: Record<string, TabLayout> = {};
        for (const [tab, layout] of Object.entries(state.layouts)) {
          const validated = validateTabLayout(layout);
          if (validated) {
            validLayouts[tab] = validated;
          }
        }
        return { layouts: validLayouts, version: SCHEMA_VERSION };
      },
    }
  )
);

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT
// ─────────────────────────────────────────────────────────────────────────────

interface WidgetWorkspaceContextValue {
  layout: TabLayout;
  isActive: boolean;
  setLayout: (layout: TabLayout) => void;
  updateWidget: (widgetId: string, updates: Partial<WidgetLayoutItem>) => void;
  addWidget: (widgetId: string, position?: { x: number; y: number }) => void;
  removeWidget: (widgetId: string) => void;
  toggleHide: (widgetId: string) => void;
  resetLayout: () => void;
  resetAll: () => void;
  isHidden: (widgetId: string) => boolean;
}

const WidgetWorkspaceContext = createContext<WidgetWorkspaceContextValue | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

interface WidgetWorkspaceProviderProps {
  children: React.ReactNode;
  tab: string;
  enabled?: boolean;
}

export function WidgetWorkspaceProvider({
  children,
  tab,
  enabled = true,
}: WidgetWorkspaceProviderProps) {
  const store = useWidgetWorkspaceStore();
  const [isHydrated, setIsHydrated] = useState(false);
  const prevTabRef = useRef(tab);

  // Handle hydration and tab changes
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Update active tab when tab prop changes
  useEffect(() => {
    if (tab !== prevTabRef.current) {
      store.setActiveTab(tab);
      prevTabRef.current = tab;
    }
  }, [tab, store]);

  // Listen event dari Command Palette (layout tidak punya akses ke context ini)
  useEffect(() => {
    const handleToggleWidget = (e: Event) => {
      const { widgetId } = (e as CustomEvent<{ widgetId: string }>).detail;
      store.toggleHide(tab, widgetId);
    };

    const handleResetLayout = () => {
      store.resetLayout(tab);
    };

    window.addEventListener("macro:toggle-widget", handleToggleWidget);
    window.addEventListener("macro:reset-layout", handleResetLayout);

    return () => {
      window.removeEventListener("macro:toggle-widget", handleToggleWidget);
      window.removeEventListener("macro:reset-layout", handleResetLayout);
    };
  }, [tab, store]);

  const value = useMemo<WidgetWorkspaceContextValue>(() => {
    const layout = store.layouts[tab] ?? getDefaultLayout(tab);
    const isHidden = (widgetId: string) => layout.hidden.includes(widgetId);

    return {
      layout,
      isActive: enabled && isHydrated,
      setLayout: (newLayout) => store.setLayout(tab, newLayout),
      updateWidget: (widgetId, updates) => store.updateWidget(tab, widgetId, updates),
      addWidget: (widgetId, position) => store.addWidget(tab, widgetId, position),
      removeWidget: (widgetId) => store.removeWidget(tab, widgetId),
      toggleHide: (widgetId) => store.toggleHide(tab, widgetId),
      resetLayout: () => store.resetLayout(tab),
      resetAll: () => store.resetAll(),
      isHidden,
    };
  }, [store, tab, enabled, isHydrated]);

  return (
    <WidgetWorkspaceContext.Provider value={value}>
      {children}
    </WidgetWorkspaceContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOKS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook to access widget workspace context.
 * Must be used within a WidgetWorkspaceProvider.
 */
export function useWidgetWorkspace(): WidgetWorkspaceContextValue {
  const context = useContext(WidgetWorkspaceContext);
  if (!context) {
    throw new Error("useWidgetWorkspace must be used within a WidgetWorkspaceProvider");
  }
  return context;
}

/**
 * Hook to check if widget workspace is enabled.
 * Checks the feature flag environment variable.
 */
export function useWidgetWorkspaceEnabled(): boolean {
  return process.env.NEXT_PUBLIC_WIDGET_WORKSPACE_ENABLED === "true";
}
