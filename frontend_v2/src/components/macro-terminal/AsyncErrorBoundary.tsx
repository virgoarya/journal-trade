import React, { ReactNode } from "react";
import { AlertCircle } from "lucide-react";

interface AsyncErrorBoundaryProps {
  children: ReactNode;
  name: string;
  status?: string;
  loading?: boolean;
  onRetry?: () => void;
}

export function AsyncErrorBoundary({
  children,
  name,
  status,
  loading,
  onRetry,
}: AsyncErrorBoundaryProps) {
  const isError = status === "error";
  const isStale = status === "stale";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[120px]">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-neutral-700 border-t-accent-gold rounded-full animate-spin mx-auto mb-2" />
          <p className="text-[10px] text-text-muted font-mono uppercase tracking-widest">
            LOADING {name}...
          </p>
        </div>
      </div>
    );
  }

  if (isError || isStale) {
    return (
      <div className="flex items-center justify-center h-full min-h-[120px] glass border border-border-subtle rounded-xl">
        <div className="text-center p-4">
          <AlertCircle className="w-6 h-6 text-data-loss mx-auto mb-2" />
          <p className="text-[10px] text-data-loss font-mono uppercase tracking-widest mb-2">
            {isError ? "ERROR" : "NO DATA"}
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="text-[9px] text-accent-gold font-mono hover:underline"
            >
              RETRY
            </button>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}