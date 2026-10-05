"use client";

import React, { Component, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { logger } from "@/lib/logger";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional custom fallback; if omitted a themed default is shown. */
  fallback?: ReactNode;
  /** Short label used in the default fallback copy (e.g. "Dashboard"). */
  label?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * App-level error boundary.
 *
 * Previously each surface handled failures ad hoc (toast / console / nothing),
 * so a render error in one panel could blank the whole dashboard. Wrapping the
 * dashboard content here keeps a single failure contained and, crucially,
 * routes it through the shared logger instead of leaking to the console.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    logger.error(
      `[ErrorBoundary${this.props.label ? `:${this.props.label}` : ""}] render error`,
      error,
      info.componentStack,
    );
  }

  private reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="min-h-[400px] flex items-center justify-center p-4">
        <div className="text-center p-8 glass rounded-2xl max-w-md">
          <AlertCircle className="w-12 h-12 text-data-loss mx-auto mb-4" />
          <p className="text-data-loss font-bold text-lg mb-2">Terjadi Kesalahan</p>
          <p className="text-sm text-text-secondary mb-6">
            {this.props.label
              ? `Bagian "${this.props.label}" gagal dimuat.`
              : "Terjadi kesalahan saat memuat halaman ini."}
          </p>
          <button
            type="button"
            onClick={this.reset}
            className="px-6 py-2 bg-accent-gold text-bg-void rounded-xl font-bold hover:brightness-110 transition-all uppercase text-xs tracking-widest"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }
}
