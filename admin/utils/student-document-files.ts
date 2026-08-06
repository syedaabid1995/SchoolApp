import type { StudentDocument, StudentDocumentFile } from '../services/student.service';

export const getStudentDocumentFiles = (
  document: Pick<
    StudentDocument,
    'id' | 'url' | 'fileName' | 'mimeType' | 'sizeBytes' | 'files'
  > & { id?: string },
): StudentDocumentFile[] => {
  if (Array.isArray(document.files) && document.files.length) {
    return document.files
      .filter((file) => typeof file?.url === 'string' && file.url.trim())
      .map((file, index) => ({
        ...file,
        documentId: file.documentId || document.id,
        fileIndex: typeof file.fileIndex === 'number' ? file.fileIndex : index,
      }));
  }
  if (!document.url?.trim()) return [];
  return [
    {
      url: document.url,
      fileName: document.fileName ?? null,
      mimeType: document.mimeType ?? null,
      sizeBytes: document.sizeBytes ?? null,
      documentId: document.id,
      fileIndex: 0,
    },
  ];
};

export type GroupedStudentDocument = {
  id: string;
  title: string;
  documentNumber?: string | null;
  createdAt: string;
  files: StudentDocumentFile[];
  /** All underlying document row ids (legacy duplicates may contribute). */
  documentIds: string[];
};

const groupKey = (document: StudentDocument) =>
  `${document.title.trim().toLowerCase()}::${(document.documentNumber || '').trim().toLowerCase()}`;

/**
 * Prefer one card per logical document.
 * Legacy rows uploaded as separate cards with the same title/number are grouped.
 */
export const groupStudentDocumentsForDisplay = (
  documents: StudentDocument[] | null | undefined,
): GroupedStudentDocument[] => {
  if (!documents?.length) return [];

  const grouped = new Map<string, GroupedStudentDocument>();

  for (const document of documents) {
    const key = groupKey(document);
    const files = getStudentDocumentFiles(document).map((file, index) => ({
      ...file,
      documentId: document.id,
      fileIndex: typeof file.fileIndex === 'number' ? file.fileIndex : index,
    }));
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, {
        id: document.id,
        title: document.title,
        documentNumber: document.documentNumber,
        createdAt: document.createdAt,
        files,
        documentIds: [document.id],
      });
      continue;
    }

    existing.files.push(...files);
    if (!existing.documentIds.includes(document.id)) {
      existing.documentIds.push(document.id);
    }
    if (document.createdAt > existing.createdAt) {
      existing.createdAt = document.createdAt;
      existing.id = document.id;
    }
  }

  return [...grouped.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};
