import type { ReactNode } from 'react';

interface DashboardPageContainerProps {
  children: ReactNode;
  maxWidthClassName?: string;
  className?: string;
}

export default function DashboardPageContainer({
  children,
  maxWidthClassName = 'max-w-7xl',
  className = '',
}: DashboardPageContainerProps) {
  const classes = ['w-full', 'pr-6', 'pb-12', maxWidthClassName, className].filter(Boolean).join(' ');
  return <div className={classes}>{children}</div>;
}
