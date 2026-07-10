"use client";

import { Card } from "./Card";

interface SkeletonLoaderProps {
  /** Type of skeleton to render */
  type: "card" | "table" | "chart" | "list";
  /** Custom classes for the container */
  className?: string;
  /** Number of items to render (for lists) */
  count?: number;
}

/**
 * SkeletonLoader - Shimmer effect loading states for AI Trading components.
 *
 * Provides consistent loading visuals across the dashboard:
 * - Card skeletons (for panels)
 * - Table skeletons (for data tables)
 * - Chart skeletons (for visualizations)
 * - List skeletons (for item lists)
 *
 * Uses Card component for consistent styling.
 */
export function SkeletonLoader({ type, className = "", count = 3 }: SkeletonLoaderProps) {
  if (type === "card") {
    return (
      <Card className={`animate-pulse ${className}`}>
        <div className="space-y-3">
          <div className="h-4 bg-gray-700 rounded w-3/4"></div>
          <div className="h-3 bg-gray-700 rounded w-full"></div>
          <div className="h-3 bg-gray-700 rounded w-5/6"></div>
          <div className="h-3 bg-gray-700 rounded w-2/3"></div>
        </div>
      </Card>
    );
  }

  if (type === "table") {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="overflow-hidden border border-gray-800 rounded-xl">
          <table className="min-w-full divide-y divide-gray-800">
            <thead className="bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  <div className="h-4 bg-gray-700 rounded w-24"></div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  <div className="h-4 bg-gray-700 rounded w-24"></div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  <div className="h-4 bg-gray-700 rounded w-24"></div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-gray-900 divide-y divide-gray-800">
              {[...Array(count)].map((_, i) => (
                <tr key={i}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="h-3 bg-gray-700 rounded w-24"></div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="h-3 bg-gray-700 rounded w-24"></div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="h-3 bg-gray-700 rounded w-24"></div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (type === "chart") {
    return (
      <Card className={`animate-pulse ${className}`}>
        <div className="space-y-3">
          <div className="h-4 bg-gray-700 rounded w-1/4"></div>
          <div className="h-64 bg-gray-800 rounded flex items-center justify-center">
            <div className="w-full h-48 bg-gray-700 rounded"></div>
          </div>
          <div className="flex justify-between">
            <div className="h-3 bg-gray-700 rounded w-1/6"></div>
            <div className="h-3 bg-gray-700 rounded w-1/6"></div>
            <div className="h-3 bg-gray-700 rounded w-1/6"></div>
          </div>
        </div>
      </Card>
    );
  }

  if (type === "list") {
    return (
      <div className={`animate-pulse space-y-2 ${className}`}>
        {[...Array(count)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 bg-gray-900 border border-gray-800 rounded-lg">
            <div className="w-8 h-8 bg-gray-700 rounded-full"></div>
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-gray-700 rounded w-3/4"></div>
              <div className="h-2 bg-gray-700 rounded w-1/2"></div>
            </div>
            <div className="h-6 w-6 bg-gray-700 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  return null;
}
