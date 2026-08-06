export type StudentDocumentFilePayload = {
  url: string;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

export const normalizeStudentDocumentFiles = (document: {
  url?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  files?: unknown;
}): StudentDocumentFilePayload[] => {
  if (Array.isArray(document.files) && document.files.length) {
    const parsed = document.files
      .map((entry) => {
        const row = asRecord(entry);
        const url = typeof row?.url === 'string' ? row.url.trim() : '';
        if (!url) return null;
        return {
          url,
          fileName:
            typeof row?.fileName === 'string'
              ? row.fileName
              : typeof row?.filename === 'string'
                ? row.filename
                : null,
          mimeType: typeof row?.mimeType === 'string' ? row.mimeType : null,
          sizeBytes:
            typeof row?.sizeBytes === 'number' && Number.isFinite(row.sizeBytes)
              ? row.sizeBytes
              : null,
        } satisfies StudentDocumentFilePayload;
      })
      .filter(Boolean) as StudentDocumentFilePayload[];
    if (parsed.length) return parsed;
  }

  const url = typeof document.url === 'string' ? document.url.trim() : '';
  if (!url) return [];
  return [
    {
      url,
      fileName: document.fileName ?? null,
      mimeType: document.mimeType ?? null,
      sizeBytes: document.sizeBytes ?? null,
    },
  ];
};
