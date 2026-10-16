"use client";

/**
 * CommandPalette — overlay ⌘K (cmdk).
 * Spec: docs/design/macro-charting-and-palette-spec.md §4.5
 *
 * Render kondisional: hanya tampil saat isOpen. Provider menempatkan state;
 * overlay ini murni presentasional + fokus/keyboard via cmdk.
 */
import React, { useEffect, useRef } from "react";
import { Command } from "cmdk";
import { Search } from "lucide-react";
import { useCommandPalette } from "@/hooks/useCommandPalette";

export function CommandPaletteOverlay() {
  const {
    isOpen,
    close,
    query,
    setQuery,
    filteredCommands,
    groupedCommands,
    executeCommand,
  } = useCommandPalette();

  const inputRef = useRef<HTMLInputElement>(null);

  // Fokus input setelah overlay terbuka (cmdk mount)
  useEffect(() => {
    if (!isOpen) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [isOpen]);

  // Lock scroll body saat terbuka
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <Command
      label="Command palette"
      shouldFilter={false}
      filter={() => 1}
    >
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={close}
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="fixed inset-0 z-[70] flex items-start justify-center mt-[16vh] px-4 pointer-events-none"
      >
        <div className="pointer-events-auto w-full max-w-lg rounded-xl border border-border-subtle bg-[#0d0d12]/95 shadow-2xl shadow-black/60 backdrop-blur-xl overflow-hidden animate-in slide-in-from-top-2 fade-in duration-200">

          {/* Input */}
          <div className="flex items-center gap-2 border-b border-border-subtle px-3">
            <Search size={14} className="text-text-muted shrink-0" />
            <Command.Input
              ref={inputRef}
              value={query}
              onValueChange={setQuery}
              placeholder="Search commands..."
              aria-label="Search commands"
              className="w-full bg-transparent border-none outline-none py-3 font-mono text-[12px] text-text-primary placeholder:text-text-muted/60"
            />
            <kbd className="shrink-0 text-[9px] font-mono text-text-muted border border-border-subtle rounded px-1.5 py-0.5">
              ESC
            </kbd>
          </div>

          {/* List */}
          <Command.List className="max-h-[46vh] overflow-y-auto p-1.5">
            {groupedCommands.length === 0 ? (
              <Command.Empty className="py-8 text-center font-mono text-[11px] text-text-muted">
                No commands found
              </Command.Empty>
            ) : (
              groupedCommands.map((group) => (
                <Command.Group
                  key={group.category}
                  heading={group.category}
                  className="mb-1"
                >
                  <div className="px-2.5 pt-2 pb-1 text-[9px] font-mono uppercase tracking-widest text-text-muted">
                    {group.category}
                  </div>
                  {group.items.map((cmd) => (
                    <Command.Item
                      key={cmd.id}
                      value={cmd.id}
                      onSelect={() => executeCommand(cmd)}
                      keywords={cmd.keywords}
                      className="flex items-center gap-2.5 rounded-md px-2.5 py-2 font-mono text-[11px] text-text-primary data-[selected=true]:bg-white/5 data-[selected=true]:text-text-primary cursor-pointer"
                    >
                      <cmd.icon size={13} className="text-accent-gold shrink-0" />
                      <span className="truncate">{cmd.title}</span>
                      <span className="ml-auto truncate text-[9px] text-text-muted">
                        {cmd.description}
                      </span>
                      {cmd.shortcut && (
                        <kbd className="shrink-0 text-[9px] text-text-muted border border-border-subtle rounded px-1 py-px">
                          {cmd.shortcut.join(" ")}
                        </kbd>
                      )}
                    </Command.Item>
                  ))}
                </Command.Group>
              ))
            )}
          </Command.List>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-border-subtle px-3 py-1.5 text-[8px] font-mono text-text-muted uppercase tracking-wider">
            <span>↑↓ navigate · ↵ select · esc close</span>
            <span>{filteredCommands.length} COMMANDS</span>
          </div>
        </div>
      </div>
    </Command>
  );
}

export default CommandPaletteOverlay;
