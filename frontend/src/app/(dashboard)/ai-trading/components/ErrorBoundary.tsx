"use client";

import { ReactNode, Component, ErrorInfo } from "react";
import { AlertTriangle, RefreshCw, Wrench } from "lucide-react";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback UI (optional) */
  fallback?: ReactNode;
  /** Called when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Show debug details in fallback */
  showDetails?: boolean;
}

/**
 * ErrorBoundary — Graceful error handling for AI Trading components.
 *
 * Wraps components to prevent a single error from crashing the whole dashboard.
 * Provides a retry button and optional error details.
 *
 * Usage:
 *   <ErrorBoundary onError={logError} fallback={<CustomFallback />}>
 *     <ComponentThatMightCrash />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // If custom fallback provided, use it
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      const { error } = this.state;
      return (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span className="text-sm font-semibold text-red-300">Something went wrong</span>
          </div>

          <p className="text-xs text-gray-400">
            This component failed to render. The error has been logged.
          </p>

          {this.props.showDetails && error && (
            <details className="text-[10px] text-gray-500">
              <summary className="cursor-pointer mb-1">Error Details</summary>
              <pre className="bg-gray-900/50 border border-gray-800 rounded p-2 overflow-x-auto whitespace-pre-wrap">
                {error.message}
                {error.stack && `\n\n${error.stack}`}
              </pre>
            </details>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={this.handleRetry}
              className="flex-1 py-2 px-3 bg-gray-800 hover:bg-gray-700 text-white text-xs font-medium rounded-lg transition flex items-center justify-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-lg transition flex items-center justify-center gap-1"
            >
              <Wrench className="w-3.5 h-3.5" />
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * HOC to wrap a component with ErrorBoundary
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, "children">
) {
  return function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
}