"use client";

/**
 * Widget Workspace — Shell Component
 *
 * Wrapper component that provides a consistent header with drag handle,
 * title, status indicator, and action menu around any panel content.
 * Panels are NOT modified — they are simply wrapped in this shell.
 */

import React, { useState, useCallback } from "react";
import {
  GripVertical,
  MoreVertical,
  X,
  EyeOff,
  Eye,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import type { WidgetShellProps, WidgetDataStatus } from "./types";
import { useWidgetWorkspace } from "./WidgetWorkspaceProvider";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// STATUS INDICATOR
// ─────────────────────────────────────────────────────────────────────────────

function StatusIndicator({ status }: { status?: WidgetDataStatus }) {
  if (!status) return null;

  const statusConfig: Record<WidgetDataStatus, { dot: string; label: string }> = {
    live: { dot: "bg-data-profit animate-pulse", label: "LIVE" },
    cache: { dot: "bg-data-warning", label: "CACHE" },
    fallback: { dot: "bg-data-warning", label: "FALLBACK" },
    stale: { dot: "bg-text-muted", label: "STALE" },
    error: { dot: "bg-data-loss", label: "ERROR" },
  };

  const config = statusConfig[status];

  return (
    <span
      className="flex items-center gap-1.5 text-[8px] sm:text-[9px] font-mono font-bold uppercase tracking-widest"
      role="status"
      aria-live="polite"
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", config.dot)} />
      <span className="text-text-muted">{config.label}</span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MENU
// ─────────────────────────────────────────────────────────────────────────────

interface MenuAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

function WidgetMenu({
  widgetId,
  hideable,
  removable,
  refreshable,
  isHidden,
}: {
  widgetId: string;
  hideable: boolean;
  removable: boolean;
  refreshable: boolean;
  isHidden: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { toggleHide, removeWidget, resetLayout } = useWidgetWorkspace();

  const handleAction = useCallback(
    (action: () => void) => {
      action();
      setIsOpen(false);
    },
    []
  );

  const actions: MenuAction[] = [
    ...(hideable
      ? [
          {
            label: isHidden ? "Show" : "Hide",
            icon: isHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />,
            onClick: () => handleAction(() => toggleHide(widgetId)),
          },
        ]
      : []),
    ...(removable
      ? [
          {
            label: "Remove",
            icon: <X className="w-3.5 h-3.5" />,
            onClick: () => handleAction(() => removeWidget(widgetId)),
          },
        ]
      : []),
    ...(refreshable
      ? [
          {
            label: "Refresh",
            icon: <RefreshCw className="w-3.5 h-3.5" />,
            onClick: () => handleAction(() => {}),
          },
        ]
      : []),
    {
      label: "Reset Position",
      icon: <RotateCcw className="w-3.5 h-3.5" />,
      onClick: () => handleAction(() => resetLayout()),
    },
  ];

  if (actions.length === 0) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 rounded hover:bg-white/10 transition-colors"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label="Widget menu"
      >
        <MoreVertical className="w-3.5 h-3.5 text-text-muted" />
      </button>

      {isOpen && (
        <>
          {/* Backdrop to close menu */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute right-0 top-full z-50 mt-1 w-36 rounded-lg bg-bg-elevated border border-border-subtle shadow-xl overflow-hidden">
            {actions.map((action, idx) => (
              <button
                key={idx}
                type="button"
                onClick={action.onClick}
                disabled={action.disabled}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-[11px] font-mono text-text-primary hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SHELL
// ─────────────────────────────────────────────────────────────────────────────

export function WidgetShell({
  widgetId,
  title,
  icon: Icon,
  dataStatus,
  headerBadge,
  children,
  className,
  bodyClassName,
  hideable = true,
  removable = true,
  refreshable = false,
}: WidgetShellProps) {
  const { isHidden, toggleHide, removeWidget } = useWidgetWorkspace();
  const hidden = isHidden(widgetId);

  if (hidden) {
    return null;
  }

  return (
    <div
      className={cn(
        "glass overflow-hidden relative flex flex-col w-full h-full",
        className
      )}
      role="region"
      aria-label={title}
    >
      {/* Header — Drag Handle */}
      <div className="widget-drag-handle flex items-center gap-2 px-3 py-2 border-b border-border-subtle bg-white/[0.02] shrink-0 cursor-grab active:cursor-grabbing">
        {/* Drag indicator */}
        <GripVertical className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />

        {/* Icon */}
        {Icon && <Icon className="w-3.5 h-3.5 text-accent-gold flex-shrink-0" />}

        {/* Title */}
        <h3 className="font-mono uppercase tracking-wider text-[11px] sm:text-xs text-text-primary truncate flex-1">
          {title}
        </h3>

        {/* Header badge */}
        {headerBadge && <div className="flex-shrink-0">{headerBadge}</div>}

        {/* Status indicator */}
        <StatusIndicator status={dataStatus} />

        {/* Action buttons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {hideable && (
            <button
              type="button"
              onClick={() => toggleHide(widgetId)}
              className="p-1 rounded hover:bg-white/10 transition-colors"
              aria-label={`Hide ${title}`}
            >
              <EyeOff className="w-3.5 h-3.5 text-text-muted" />
            </button>
          )}
          {removable && (
            <button
              type="button"
              onClick={() => removeWidget(widgetId)}
              className="p-1 rounded hover:bg-white/10 transition-colors"
              aria-label={`Remove ${title}`}
            >
              <X className="w-3.5 h-3.5 text-text-muted" />
            </button>
          )}
          <WidgetMenu
            widgetId={widgetId}
            hideable={hideable}
            removable={removable}
            refreshable={refreshable}
            isHidden={hidden}
          />
        </div>
      </div>

      {/* Body */}
      <div className={cn("flex-1 min-h-0 p-3 overflow-hidden", bodyClassName)}>
        {children}
      </div>
    </div>
  );
}

export default WidgetShell;
