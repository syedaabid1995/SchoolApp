'use client';

export type DocumentCollectionRow = {
  id: string;
  title: string;
  documentNumber: string;
  files: File[];
};

const allowedDocumentTypes = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
];

const allowedDocumentExtensions = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.webp'];

export const documentAccept = '.pdf,.doc,.docx,image/jpeg,image/png,image/webp';

const newDocumentRow = (): DocumentCollectionRow => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  title: '',
  documentNumber: '',
  files: [],
});

export const initialDocumentRows = () => [newDocumentRow()];

export const validateDocumentFiles = (files: File[]) => {
  const invalid = files.find((file) => {
    const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    return !allowedDocumentTypes.includes(file.type) || !allowedDocumentExtensions.includes(extension) || file.size > 20 * 1024 * 1024;
  });
  if (!invalid) return '';
  return `"${invalid.name}" must be a PDF, DOC, DOCX, JPG, PNG, or WebP file under 20 MB.`;
};

type Props = {
  rows: DocumentCollectionRow[];
  onChange: (rows: DocumentCollectionRow[]) => void;
  onError?: (message: string) => void;
  title?: string;
};

export default function DocumentCollectionCard({ rows, onChange, onError, title = 'Documents' }: Props) {
  const updateRow = (id: string, patch: Partial<DocumentCollectionRow>) => {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const removeRow = (id: string) => {
    const nextRows = rows.filter((row) => row.id !== id);
    onChange(nextRows.length ? nextRows : initialDocumentRows());
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-black text-slate-950">{title}</h2>
        <button
          type="button"
          onClick={() => onChange([...rows, newDocumentRow()])}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
          aria-label="Add document"
          title="Add document"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
        </button>
      </div>

      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={row.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1.2fr_auto]">
              <input
                value={row.title}
                onChange={(event) => updateRow(row.id, { title: event.target.value })}
                placeholder="Aadhaar card, PAN card, marksheet"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
              />
              <input
                value={row.documentNumber}
                onChange={(event) => updateRow(row.id, { documentNumber: event.target.value })}
                placeholder="Document number"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
              />
              <input
                type="file"
                multiple
                accept={documentAccept}
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  const error = validateDocumentFiles(files);
                  if (error) {
                    onError?.(error);
                    event.target.value = '';
                    return;
                  }
                  updateRow(row.id, { files });
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              />
              <button
                type="button"
                onClick={() => removeRow(row.id)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                aria-label={`Remove document ${index + 1}`}
                title="Remove document"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 6h18" />
                  <path d="M8 6V4h8v2" />
                  <path d="M6 6l1 15h10l1-15" />
                </svg>
              </button>
            </div>
            {row.files.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {row.files.map((file) => (
                  <span key={`${row.id}-${file.name}-${file.size}`} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-600">
                    {file.name}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
