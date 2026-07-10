"use client";

import { type ReactNode, type ElementType } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { useState } from "react";

interface CardProps {
  /** Card title (shown in header) */
  title?: string;
  /** Icon component for the header */
  icon?: ElementType;
  /** Icon color class (e.g., "text-accent-gold") */
  iconClassName?: string;
  /** Title color class */
  titleClassName?: string;
  /** Action node rendered on the right side of the header (buttons, badges) */
  action?: ReactNode;
  /** Card body content */
  children: ReactNode;
  /** Extra classes for the root container */
  className?: string;
  /** Collapsible: when true, renders a chevron toggle to expand/collapse body */
  collapsible?: boolean;
  /** Initial collapsed state (only used when collapsible=true) */
  defaultCollapsed?: boolean;
}

/**
 * Card — Shared wrapper component for AI Trading dashboard cards.
 *
 * Standardizes the look of all panels: gray-900 background, gray-800 border,
 * rounded-xl, p-4, with an optional header row (icon + title + action).
 *
 * Replaces the repeated inline pattern:
 *   <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
 *
 * Optional collapsible mode adds an accessible chevron toggle.
 */
export function Card({
  title,
  icon: Icon,
  iconClassName = "text-accent-gold",
  titleClassName = "text-sm font-semibold text-white",
  action,
  children,
  className = "",
  collapsible = false,
  defaultCollapsed = false,
}: CardProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3 ${className}`}>
      {(title || action || collapsible) && (
        <div className="flex items-center justify-between">
          {title && (
            <h3 className={`${titleClassName} flex items-center gap-2`}>
              {Icon && <Icon className="w-4 h-4" />}
              {title}
            </h3>
          )}
          <div className="flex items-center gap-2">
            {action}
            {collapsible && (
              <button
                onClick={() => setCollapsed(!collapsed)}
                className="text-gray-500 hover:text-white transition p-1"
                aria-label={collapsed ? "Expand" : "Collapse"}
              >
                {collapsed ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronUp className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>
        </div>
      )}
      {!collapsed && children}
    </div>
  );
}
