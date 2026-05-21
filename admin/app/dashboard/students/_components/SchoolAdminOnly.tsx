export function SchoolAdminOnly({ moduleName }: { moduleName: string }) {
  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-bold uppercase tracking-wide text-rose-600">School Admin access required</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">This module is not available for your role.</h1>
        <p className="mt-2 text-sm text-slate-500">
          Only School Admin users can manage {moduleName}. Backend authorization is still enforced on every request.
        </p>
      </div>
    </div>
  );
}
