import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { AppIcon, type AppIconName } from '../AppIcon';

type Tone = 'blue' | 'emerald' | 'amber' | 'violet' | 'rose' | 'slate';

const toneClassMap: Record<Tone, { icon: string; accent: string; soft: string; ring: string; text: string; bar: string }> = {
  blue: {
    icon: 'bg-blue-600 text-white',
    accent: 'bg-blue-600',
    soft: 'bg-blue-50',
    ring: 'ring-blue-100',
    text: 'text-blue-700',
    bar: 'bg-blue-500',
  },
  emerald: {
    icon: 'bg-emerald-600 text-white',
    accent: 'bg-emerald-600',
    soft: 'bg-emerald-50',
    ring: 'ring-emerald-100',
    text: 'text-emerald-700',
    bar: 'bg-emerald-500',
  },
  amber: {
    icon: 'bg-amber-500 text-white',
    accent: 'bg-amber-500',
    soft: 'bg-amber-50',
    ring: 'ring-amber-100',
    text: 'text-amber-700',
    bar: 'bg-amber-500',
  },
  violet: {
    icon: 'bg-violet-600 text-white',
    accent: 'bg-violet-600',
    soft: 'bg-violet-50',
    ring: 'ring-violet-100',
    text: 'text-violet-700',
    bar: 'bg-violet-500',
  },
  rose: {
    icon: 'bg-rose-600 text-white',
    accent: 'bg-rose-600',
    soft: 'bg-rose-50',
    ring: 'ring-rose-100',
    text: 'text-rose-700',
    bar: 'bg-rose-500',
  },
  slate: {
    icon: 'bg-slate-900 text-white',
    accent: 'bg-slate-900',
    soft: 'bg-slate-50',
    ring: 'ring-slate-200',
    text: 'text-slate-700',
    bar: 'bg-slate-500',
  },
};

export function DashboardHero({
  eyebrow,
  title,
  subtitle,
  actions,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] shadow-sm">
      <div className="grid gap-6 border-b border-[var(--shell-border)] bg-[linear-gradient(135deg,rgba(37,99,235,0.12),rgba(16,185,129,0.08),rgba(245,158,11,0.08))] p-5 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase text-[var(--shell-muted)]">{eyebrow}</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--shell-text)] md:text-3xl">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--shell-muted)]">{subtitle}</p>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2 lg:justify-end">{actions}</div> : null}
      </div>
      {children ? <div className="p-5">{children}</div> : null}
    </section>
  );
}

export function MetricCard({
  label,
  value,
  helper,
  icon,
  tone = 'blue',
  meta,
}: {
  label: string;
  value: ReactNode;
  helper?: string;
  icon: AppIconName;
  tone?: Tone;
  meta?: string;
}) {
  const toneClasses = toneClassMap[tone];
  return (
    <article className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${toneClasses.icon}`}>
          <AppIcon name={icon} className="h-5 w-5" />
        </span>
        {meta ? (
          <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${toneClasses.soft} ${toneClasses.text} ring-1 ${toneClasses.ring}`}>
            {meta}
          </span>
        ) : null}
      </div>
      <p className="mt-4 text-xs font-bold uppercase text-[var(--shell-muted)]">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[var(--shell-text)]">{value}</p>
      {helper ? <p className="mt-2 text-xs leading-5 text-[var(--shell-muted)]">{helper}</p> : null}
    </article>
  );
}

export function SectionPanel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-[var(--shell-text)]">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm leading-5 text-[var(--shell-muted)]">{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function QuickActionTile({
  href,
  title,
  description,
  icon,
  tone = 'blue',
}: {
  href: string;
  title: string;
  description: string;
  icon: AppIconName;
  tone?: Tone;
}) {
  const toneClasses = toneClassMap[tone];
  return (
    <Link
      href={href}
      prefetch={false}
      className="group flex min-h-24 items-center gap-3 rounded-xl border border-[var(--shell-border)] bg-[var(--shell-card)] p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${toneClasses.icon}`}>
        <AppIcon name={icon} className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block font-bold text-[var(--shell-text)] group-hover:text-blue-700">{title}</span>
        <span className="mt-1 block text-sm leading-5 text-[var(--shell-muted)]">{description}</span>
      </span>
    </Link>
  );
}

export function MiniBarChart({ values, labels, tone = 'blue' }: { values: number[]; labels: string[]; tone?: Tone }) {
  const toneClasses = toneClassMap[tone];
  const finiteValues = values.map((value) => (Number.isFinite(Number(value)) ? Number(value) : 0));
  const max = Math.max(...finiteValues, 1);

  return (
    <div className="flex h-32 items-end gap-2">
      {finiteValues.map((value, index) => {
        const height = Math.max(10, Math.round((value / max) * 100));
        return (
          <div key={`${labels[index] ?? index}-${index}`} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div className="flex h-24 w-full items-end rounded-lg bg-[var(--shell-subtle)] px-1.5 py-1.5">
              <div className={`w-full rounded-md ${toneClasses.bar}`} style={{ height: `${height}%` }} title={`${labels[index] ?? 'Item'}: ${value}`} />
            </div>
            <span className="truncate text-[11px] font-semibold text-[var(--shell-muted)]">{labels[index] ?? ''}</span>
          </div>
        );
      })}
    </div>
  );
}

export function RingMetric({ value, label, tone = 'blue' }: { value: number; label: string; tone?: Tone }) {
  const toneClasses = toneClassMap[tone];
  const normalizedValue = Math.max(0, Math.min(Number.isFinite(value) ? value : 0, 100));
  return (
    <div className={`rounded-xl border border-[var(--shell-border)] ${toneClasses.soft} p-4 ring-1 ${toneClasses.ring}`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[var(--shell-text)]">{label}</p>
          <p className={`mt-1 text-2xl font-bold ${toneClasses.text}`}>{normalizedValue}%</p>
        </div>
        <div className="h-14 w-14 rounded-full bg-[conic-gradient(currentColor_var(--ring-value),rgba(148,163,184,0.25)_0)] p-1 text-current" style={{ '--ring-value': `${normalizedValue}%` } as CSSProperties}>
          <div className="h-full w-full rounded-full bg-[var(--shell-card)]" />
        </div>
      </div>
    </div>
  );
}

export function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--shell-border)] bg-[var(--shell-subtle)] p-6 text-center text-sm text-[var(--shell-muted)]">
      {message}
    </div>
  );
}
