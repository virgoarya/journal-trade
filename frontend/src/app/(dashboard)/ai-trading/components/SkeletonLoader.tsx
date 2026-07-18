"use client";

interface SkeletonLoaderProps {
  /** Type of skeleton to render */
  type: "card" | "table" | "chart" | "list";
  /** Custom classes for the container */
  className?: string;
  /** Number of items to render (for lists) */
  count?: number;
}

/**
 * SkeletonLoader - HUD-themed shimmer loading states for AI Trading components.
 * Uses hud-panel and gold-accent colors for visual consistency.
 */
export function SkeletonLoader({ type, className = "", count = 3 }: SkeletonLoaderProps) {
  const shimmer = "bg-accent-gold/10 animate-pulse rounded";

  if (type === "card") {
    return (
      <div className={`hud-panel p-4 animate-pulse ${className}`}>
        <div className="space-y-3">
          <div className={`h-4 ${shimmer} w-3/4`}></div>
          <div className={`h-3 ${shimmer} w-full`}></div>
          <div className={`h-3 ${shimmer} w-5/6`}></div>
          <div className={`h-3 ${shimmer} w-2/3`}></div>
        </div>
      </div>
    );
  }

  if (type === "table") {
    return (
      <div className={`hud-panel overflow-hidden animate-pulse ${className}`}>
        <div className="px-4 py-3 border-b border-accent-gold/20 bg-black/20">
          <div className={`h-3 ${shimmer} w-32`}></div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-accent-gold/10 bg-black/40">
              {[...Array(4)].map((_, i) => (
                <th key={i} className="px-4 py-2.5 text-left">
                  <div className={`h-3 ${shimmer} w-16`}></div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...Array(count)].map((_, i) => (
              <tr key={i} className="border-b border-accent-gold/5">
                {[...Array(4)].map((_, j) => (
                  <td key={j} className="px-4 py-3">
                    <div className={`h-3 ${shimmer} w-20`}></div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (type === "chart") {
    return (
      <div className={`hud-panel p-4 animate-pulse ${className}`}>
        <div className="space-y-3">
          <div className={`h-4 ${shimmer} w-1/4`}></div>
          <div className="h-48 bg-accent-gold/5 rounded flex items-end justify-around px-4 pb-4 border border-accent-gold/10">
            {[...Array(8)].map((_, i) => (
              <div key={i} className={`${shimmer} w-6`} style={{ height: `${20 + Math.random() * 80}%` }}></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (type === "list") {
    return (
      <div className={`animate-pulse space-y-2 ${className}`}>
        {[...Array(count)].map((_, i) => (
          <div key={i} className="hud-panel p-3 flex items-center gap-3">
            <div className={`w-8 h-8 ${shimmer} rounded-full`}></div>
            <div className="flex-1 space-y-2">
              <div className={`h-3 ${shimmer} w-3/4`}></div>
              <div className={`h-2 ${shimmer} w-1/2`}></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return null;
}
