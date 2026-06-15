'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: Array<{
    label: string;
    href?: string;
  }>;
  actions?: ReactNode;
}

export default function PageHeader({ title, subtitle, breadcrumbs, actions }: PageHeaderProps) {
  const items = breadcrumbs?.length
    ? breadcrumbs
    : [
        { label: 'Dashboard', href: '/dashboard' },
        { label: title },
      ];

  return (
    <div className="sticky -top-10 z-40 -mx-4 -mt-4 mb-4 bg-[var(--shell-bg)] px-4 pb-3 pt-14 sm:-mx-6 sm:-mt-6 sm:px-6 sm:pt-16 lg:-mx-8 lg:-mt-8 lg:px-8 lg:pt-[4.5rem]">
      <header className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold tracking-tight text-[var(--shell-text)] md:text-2xl">{title}</h1>
            {subtitle ? <p className="mt-1 max-w-4xl text-sm leading-5 text-[var(--shell-muted)]">{subtitle}</p> : null}
          </div>
          <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
            <nav
              aria-label="Breadcrumb"
              className="flex flex-wrap items-center gap-1 text-xs font-semibold text-[var(--shell-muted)] lg:justify-end lg:pt-1"
            >
              {items.map((item, index) => {
                const isLast = index === items.length - 1;
                return (
                  <span key={`${item.label}-${index}`} className="inline-flex items-center gap-1">
                    {item.href && !isLast ? (
                      <Link href={item.href} className="hover:text-[var(--shell-text)]">
                        {item.label}
                      </Link>
                    ) : (
                      <span className={isLast ? 'text-[var(--shell-text)]' : undefined}>{item.label}</span>
                    )}
                    {!isLast ? <span className="text-[var(--shell-muted)]">/</span> : null}
                  </span>
                );
              })}
            </nav>
            {actions ? <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div> : null}
          </div>
        </div>
      </header>
    </div>
  );
}
