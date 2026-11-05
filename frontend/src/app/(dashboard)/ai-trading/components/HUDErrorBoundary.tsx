import React from 'react';
import { ErrorBoundary as ReactErrorBoundary, FallbackProps } from 'react-error-boundary';
import { ShieldAlert } from 'lucide-react';

const ErrorFallback = ({ error, resetErrorBoundary }: FallbackProps) => {
  const err = error instanceof Error ? error : new Error(String(error));
  return (
  <div className="p-4 border border-red-500/30 bg-red-950/20 rounded-xl text-center">
    <ShieldAlert className="w-8 h-8 text-red-400 mx-auto mb-2" />
    <h2 className="text-red-400 font-bold mb-1">HUD Module Error</h2>
    <p className="text-xs text-text-muted mb-4">{err.message}</p>
    <button onClick={resetErrorBoundary} className="text-[10px] bg-red-900/40 px-3 py-1 rounded border border-red-500/30 text-red-200 uppercase tracking-widest">Retry</button>
  </div>
);
};

export const HUDErrorBoundary = ({ children }: { children: React.ReactNode }) => (
  <ReactErrorBoundary FallbackComponent={ErrorFallback}>{children}</ReactErrorBoundary>
);
