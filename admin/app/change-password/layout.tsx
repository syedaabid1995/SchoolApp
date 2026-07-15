import type { CSSProperties, ReactNode } from 'react';

const shellStyle = {
  '--shell-bg': '#f5f7fb',
  '--shell-card': '#ffffff',
  '--shell-subtle': '#f8fafc',
  '--shell-hover': '#f1f5f9',
  '--shell-border': '#e2e8f0',
  '--shell-text': '#0f172a',
  '--shell-muted': '#64748b',
} as CSSProperties;

export default async function ChangePasswordLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[var(--shell-bg)] px-4 py-8 text-[var(--shell-text)] sm:px-6" style={shellStyle}>
      {children}
    </main>
  );
}
