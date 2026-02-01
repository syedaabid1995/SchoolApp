'use client';

export default function FullPageLoader({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate/40">
      <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-lg">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate/200 border-t-emerald-500" />
        <span className="text-sm font-semibold text-slate">{label}</span>
      </div>
    </div>
  );
}
