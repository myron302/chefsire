import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, RefreshCw, Home } from "lucide-react";

type Props = {
  children: React.ReactNode;
  fallbackComponent?: React.ComponentType<{ error: Error; resetError: () => void }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
};
type State = { hasError: boolean; error?: Error };

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: any): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, info: any) {
    console.error("ErrorBoundary caught:", error, info);

    // Call custom error handler if provided
    this.props.onError?.(error, info);

    // TODO: Send to error tracking service (Sentry, etc.)
    // sendToErrorTracking(error, info);
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallbackComponent) {
        const FallbackComponent = this.props.fallbackComponent;
        return <FallbackComponent error={this.state.error} resetError={this.resetError} />;
      }

      // Default fallback UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <Card className="max-w-lg w-full">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-full">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
                <CardTitle className="text-xl">Something went wrong</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-600">
                We encountered an unexpected error. Don't worry, your data is safe.
              </p>

              <div className="bg-gray-100 p-3 rounded text-sm text-gray-700 break-words">
                <strong>Error:</strong> {this.state.error.message || "Unknown error"}
              </div>

              {process.env.NODE_ENV === 'development' && this.state.error.stack && (
                <details className="text-xs text-gray-600">
                  <summary className="cursor-pointer font-medium mb-2">
                    Stack trace (dev only)
                  </summary>
                  <pre className="bg-gray-100 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                    {this.state.error.stack}
                  </pre>
                </details>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={this.resetError}
                  className="flex-1 gap-2"
                  variant="default"
                >
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </Button>
                <Button
                  onClick={() => window.location.href = '/'}
                  className="flex-1 gap-2"
                  variant="outline"
                >
                  <Home className="h-4 w-4" />
                  Go Home
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}

// Lightweight error boundary for specific sections
export class SectionErrorBoundary extends React.Component<
  { children: React.ReactNode; sectionName?: string },
  State
> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: any): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, info: any) {
    console.error(`SectionErrorBoundary (${this.props.sectionName || 'Unknown'}) caught:`, error, info);
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div className="p-4 border border-red-200 rounded-lg bg-red-50">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-red-900 mb-1">
                {this.props.sectionName ? `${this.props.sectionName} Error` : 'Section Error'}
              </h3>
              <p className="text-sm text-red-700 mb-3">
                {this.state.error.message || 'This section failed to load'}
              </p>
              <Button
                onClick={this.resetError}
                size="sm"
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-100"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
