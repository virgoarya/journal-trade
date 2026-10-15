"use client";

/**
 * Widget Workspace — Grid Component
 *
 * Wrapper around react-grid-layout v2 GridLayout.
 * Renders children in a draggable, responsive grid.
 */

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { GridLayout, useContainerWidth, verticalCompactor } from "react-grid-layout";
import type { Layout, LayoutItem } from "react-grid-layout";
import { GRID_CONFIG } from "./types";
import { useWidgetWorkspace } from "./WidgetWorkspaceProvider";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface WidgetGridProps {
  /** Tab identifier for this grid */
  tab: string;
  /** Child widgets to render in the grid */
  children: React.ReactNode;
  /** Additional CSS class for the grid container */
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function WidgetGrid({ tab, children, className }: WidgetGridProps) {
  const { layout, setLayout, isActive } = useWidgetWorkspace();
  const { width, containerRef, mounted } = useContainerWidth();
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < GRID_CONFIG.MOBILE_BREAKPOINT);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Filter out hidden widgets
  const visibleItems = useMemo(() => {
    return layout.items.filter((item) => !layout.hidden.includes(item.i));
  }, [layout.items, layout.hidden]);

  // Convert LayoutItem[] to react-grid-layout Layout format
  const gridLayout: Layout = useMemo(() => {
    return visibleItems.map((item) => ({
      i: item.i,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
      minW: item.minW,
      minH: item.minH,
      maxW: item.maxW,
      maxH: item.maxH,
    }));
  }, [visibleItems]);

  // Handle layout change from react-grid-layout
  const handleLayoutChange = useCallback(
    (newLayout: Layout) => {
      if (!isActive) return;
      // Convert back to our format
      const items: LayoutItem[] = newLayout.map((item) => ({
        i: item.i,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        minW: item.minW,
        minH: item.minH,
        maxW: item.maxW,
        maxH: item.maxH,
      }));
      setLayout({ ...layout, items });
    },
    [isActive, layout, setLayout]
  );

  // Mobile: render stacked layout without drag
  if (isMobile) {
    return (
      <div ref={containerRef} className={`w-full flex flex-col gap-4 ${className ?? ""}`}>
        {children}
      </div>
    );
  }

  // Desktop: render react-grid-layout
  if (!mounted) {
    return (
      <div ref={containerRef} className={`w-full ${className ?? ""}`}>
        {/* Skeleton while measuring */}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`w-full ${className ?? ""}`}>
      <GridLayout
        width={width}
        layout={gridLayout}
        gridConfig={{
          cols: GRID_CONFIG.COLS,
          rowHeight: GRID_CONFIG.ROW_HEIGHT,
          margin: GRID_CONFIG.MARGIN,
          containerPadding: GRID_CONFIG.CONTAINER_PADDING,
        }}
        dragConfig={{
          enabled: isActive,
          handle: ".widget-drag-handle",
        }}
        resizeConfig={{
          enabled: isActive,
        }}
        onLayoutChange={handleLayoutChange}
        compactor={verticalCompactor}
      >
        {children}
      </GridLayout>
    </div>
  );
}
