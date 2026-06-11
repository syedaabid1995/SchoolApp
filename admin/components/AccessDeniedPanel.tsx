type AccessDeniedPanelProps = {
  title?: string;
  message?: string;
};

export default function AccessDeniedPanel({
  title = "You can't able to view this page",
  message = 'Ask admin for access.',
}: AccessDeniedPanelProps) {
  return (
    <section className="mx-auto max-w-3xl rounded-2xl border border-[var(--shell-border,#e2e8f0)] bg-[var(--shell-card,#ffffff)] p-8 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-100">
        <svg
          className="h-6 w-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.9}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3.5 5.5 6v5.5c0 4.1 2.6 7.5 6.5 9 3.9-1.5 6.5-4.9 6.5-9V6L12 3.5Z" />
          <path d="M12 8v5" />
          <path d="M12 16h.01" />
        </svg>
      </div>
      <h1 className="mt-4 text-2xl font-semibold text-[var(--shell-text,#0f172a)]">{title}</h1>
      <p className="mt-2 text-sm text-[var(--shell-muted,#64748b)]">{message}</p>
    </section>
  );
}
