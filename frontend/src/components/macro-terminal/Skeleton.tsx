"use client";

import React from "react";
import { cn } from "@/lib/utils";

type SkeletonProps = {
  className?: string;
  variant?: "card" | "gauge" | "line" | "rect" | "circle" | "text";
  lines?: number;
};

export function Skeleton({ className, variant = "rect", lines = 1 }: SkeletonProps) {
  const baseClasses = "bg-surface-elevated animate-pulse";

  const getVariantClasses = () => {
    switch (variant) {
      case "card":
        return "rounded-xl p-4";
      case "gauge":
        return "rounded-full w-40 h-40";
      case "line":
        return "h-4 rounded";
      case "rect":
        return "rounded-lg";
      case "circle":
        return "rounded-full";
      case "text":
        return "h-3 rounded";
      default:
        return "rounded";
    }
  };

  if (variant === "text" && lines > 1) {
    return (
      <div className={cn("space-y-2", className)}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(
              baseClasses,
              "h-3 rounded",
              i === lines - 1 ? "w-3/4" : "w-full"
            )}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={cn(baseClasses, getVariantClasses(), className)} />
  );
}

// Pre-built skeleton components for common use cases
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("bg-bg-void border border-border-subtle rounded-xl p-4", className)}>
      <Skeleton variant="line" className="w-3/4 mb-3" />
      <Skeleton variant="rect" className="h-24 mb-3" />
      <Skeleton variant="text" lines={2} />
    </div>
  );
}

export function SkeletonGauge({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <Skeleton variant="gauge" />
    </div>
  );
}

export function SkeletonPanel({ className }: { className?: string }) {
  return (
    <div className={cn("glass border border-border-subtle rounded-xl p-4", className)}>
      <div className="flex items-center gap-2 mb-3">
        <Skeleton variant="circle" className="w-4 h-4" />
        <Skeleton variant="text" className="w-40 h-3" />
      </div>
      <Skeleton variant="rect" className="h-32 mb-3" />
      <Skeleton variant="text" lines={2} />
    </div>
  );
}