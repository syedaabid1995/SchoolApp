'use client';

import React from 'react';

type State = { hasError: boolean };

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('UI error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-sand">
          <div className="rounded-2xl border border-slate/10 bg-white p-6 text-center">
            <h1 className="text-lg font-semibold text-ink">Something went wrong</h1>
            <p className="mt-2 text-sm text-slate">Please refresh the page or sign in again.</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
