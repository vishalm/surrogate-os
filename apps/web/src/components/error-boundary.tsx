'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Card } from '@/components/ui';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleRetry = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center py-16">
          <Card>
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-danger)]/10">
                <span className="text-xl text-[var(--color-danger)]">!</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                  Something went wrong
                </h2>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  {this.state.error?.message ?? 'An unexpected error occurred'}
                </p>
              </div>
              <button
                onClick={this.handleRetry}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-danger)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#dc2626] active:bg-[#b91c1c]"
              >
                Try Again
              </button>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
