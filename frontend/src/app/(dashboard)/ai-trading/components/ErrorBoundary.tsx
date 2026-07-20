"use client";

import React, { type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * ErrorBoundary — catches render errors in child components (especially R3F / Three.js)
 * and displays a graceful fallback instead of crashing the entire page.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="glass p-6 flex flex-col items-center justify-center gap-3 min-h-[200px]">
          <div className="w-12 h-12 rounded-full border-2 border-neon-red/50 flex items-center justify-center bg-neon-red/10">
            <span className="text-neon-red text-lg">⚠</span>
          </div>
          <p className="text-sm text-text-muted font-mono">
            3D Visualization failed to load
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-3 py-1.5 text-xs font-mono text-accent-gold border border-accent-gold/30 rounded hover:bg-accent-gold/10 transition"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}