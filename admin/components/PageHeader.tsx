'use client';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
}

export default function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <header className="mb-6 rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm md:px-6">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Workspace</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">{title}</h1>
      {subtitle && (
          <p className="max-w-4xl text-sm leading-6 text-slate-600">
          {subtitle}
        </p>
      )}
      </div>
    </header>
  );
}
