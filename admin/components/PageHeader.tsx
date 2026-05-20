'use client';

import Link from 'next/link';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: Array<{
    label: string;
    href?: string;
  }>;
}

export default function PageHeader({ title, subtitle, breadcrumbs }: PageHeaderProps) {
  const items = breadcrumbs?.length
    ? breadcrumbs
    : [
        { label: 'Dashboard', href: '/dashboard' },
        { label: title },
      ];

  return (
    <header className="mb-4 rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] px-4 py-3 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-tight text-[var(--shell-text)] md:text-2xl">{title}</h1>
          {subtitle ? <p className="mt-1 max-w-4xl text-sm leading-5 text-[var(--shell-muted)]">{subtitle}</p> : null}
        </div>
        <nav
          aria-label="Breadcrumb"
          className="flex shrink-0 flex-wrap items-center gap-1 text-xs font-semibold text-[var(--shell-muted)] lg:justify-end lg:pt-1"
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
      </div>
    </header>
  );
}
