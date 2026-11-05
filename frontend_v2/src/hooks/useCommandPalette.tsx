/**
 * Hook untuk mengelola state dan logika Command Palette (⌘K).
 * Spec: docs/design/macro-charting-and-palette-spec.md §7.2, §7.3
 */
import React, { useState, useCallback, useMemo, useContext, useEffect } from "react";
import {
  COMMAND_DEFINITIONS,
  filterCommands,
  groupCommands,
  type Command,
  type CommandDefinition,
  type CommandPaletteContextValue,
  CommandPaletteContext,
} from "@/lib/commands";
import { useRouter } from "next/navigation";

export interface CommandPaletteProviderProps {
  children: React.ReactNode;
  initialCommands?: CommandDefinition[];
  /** Aksi kustom saat instrumen dipilih (mis. ganti simbol di chart). */
  onSelectInstrument?: (symbol: string) => void;
  /** Aksi kustom saat widget di-toggle. */
  onToggleWidget?: (widgetId: string) => void;
  /** Aksi kustom untuk force refresh data. */
  onRefreshAll?: () => void;
  /** Aksi kustom untuk reset layout. */
  onResetLayout?: () => void;
}

export function CommandPaletteProvider({
  children,
  initialCommands = COMMAND_DEFINITIONS,
  onSelectInstrument,
  onToggleWidget,
  onRefreshAll,
  onResetLayout,
}: CommandPaletteProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
  }, []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const executeCommand = useCallback((cmd: Command) => {
    // 1. Navigasi tab
    if (cmd.type === "navigation") {
      router.push(cmd.id.replace("tab-", "/macro-terminal/"));
      close();
      return;
    }

    // 2. Instrumen (ganti chart)
    if (cmd.type === "instrument") {
      const symbol = cmd.id.replace("instrument-", "");
      onSelectInstrument?.(symbol);
      close();
      return;
    }

    // 3. Widget toggle
    if (cmd.type === "widget") {
      const widgetId = cmd.id.replace("widget-toggle-", "");
      onToggleWidget?.(widgetId);
      close();
      return;
    }

    // 4. Aksi cepat
    if (cmd.type === "action") {
      if (cmd.id === "action-refresh") onRefreshAll?.();
      if (cmd.id === "action-reset-layout") onResetLayout?.();
      close();
      return;
    }
  }, [router, close, onSelectInstrument, onToggleWidget, onRefreshAll, onResetLayout]);

  const commands = useMemo(() => {
    return initialCommands.map((cmdDef) => ({
      ...cmdDef,
      action: () => {
        // action default (tidak ada) — aksi ditangani oleh executeCommand
      },
    })) as Command[];
  }, [initialCommands]);

  const filteredCommands = useMemo(() => {
    return filterCommands(commands, query);
  }, [commands, query]);

  const groupedCommands = useMemo(() => {
    return groupCommands(filteredCommands);
  }, [filteredCommands]);

  // Keyboard shortcut ⌘K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggle]);

  // Keyboard shortcut Alt+1..Alt+5 — navigasi ke tab Macro Terminal.
  // Tidak berlaku saat palette terbuka atau saat user mengetik di input.
  const tabRoutes = useMemo(
    () => ["/macro-terminal/overview", "/macro-terminal/cot", "/macro-terminal/quant-lab", "/macro-terminal/nexus", "/macro-terminal/intelligence"],
    []
  );
  useEffect(() => {
    const handleAltTab = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      if (isOpen) return;
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      const idx = ["1", "2", "3", "4", "5"].indexOf(e.key);
      if (idx === -1) return;
      e.preventDefault();
      router.push(tabRoutes[idx]);
    };
    window.addEventListener("keydown", handleAltTab);
    return () => window.removeEventListener("keydown", handleAltTab);
  }, [isOpen, router, tabRoutes]);

  const value: CommandPaletteContextValue = {
    isOpen,
    open,
    close,
    toggle,
    query,
    setQuery,
    commands,
    filteredCommands,
    groupedCommands,
    executeCommand,
  };

  return (
    <CommandPaletteContext.Provider value={value}>{children}</CommandPaletteContext.Provider>
  );
}

export const useCommandPalette = (): CommandPaletteContextValue => {
  const context = useContext(CommandPaletteContext);
  if (!context) {
    throw new Error("useCommandPalette must be used within a CommandPaletteProvider");
  }
  return context;
};