"use client";

import React, { Component, ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch() {
    return null;
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-4">
          <p className="text-xs font-mono text-red-400">
            Gagal memuat halaman Macro Terminal.
          </p>
          <p className="mt-2 text-[10px] font-mono text-text-muted break-all">
            {this.state.error?.message}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-3 rounded-md border border-border-subtle bg-white/5 px-3 py-1.5 text-[10px] font-mono text-accent-gold transition-colors hover:border-accent-gold hover:bg-accent-gold/10"
          >
            Coba lagi
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
