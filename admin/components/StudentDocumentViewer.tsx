'use client';

import { useEffect, useMemo, useState } from 'react';
import type { StudentDocument, StudentDocumentFile } from '../services/student.service';
import { resolveUploadUrl } from '../services/student.service';
import { getStudentDocumentFiles } from '../utils/student-document-files';

type ViewerDocument = {
  id: string;
  title: string;
  documentNumber?: string | null;
  url?: string;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  files?: StudentDocumentFile[] | null;
};

type Props = {
  open: boolean;
  document: ViewerDocument | null;
  onClose: () => void;
};

const isImageFile = (file: StudentDocumentFile) => {
  const mime = (file.mimeType || '').toLowerCase();
  if (mime.startsWith('image/')) return true;
  const name = `${file.fileName || ''} ${file.url || ''}`.toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.webp', '.gif'].some((ext) => name.includes(ext));
};

const isPdfFile = (file: StudentDocumentFile) => {
  const mime = (file.mimeType || '').toLowerCase();
  if (mime.includes('pdf')) return true;
  return `${file.fileName || ''} ${file.url || ''}`.toLowerCase().includes('.pdf');
};

const fileSignedUrl = (documentId: string, file: StudentDocumentFile, fallbackIndex: number) =>
  resolveUploadUrl(file.url, {
    type: 'student-document',
    id: file.documentId || documentId,
    fileIndex: typeof file.fileIndex === 'number' ? file.fileIndex : fallbackIndex,
  });

export default function StudentDocumentViewer({ open, document, onClose }: Props) {
  const files = useMemo(
    () => (document ? getStudentDocumentFiles(document as StudentDocument) : []),
    [document],
  );
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [document?.id]);

  if (!open || !document) return null;

  const safeIndex = Math.min(Math.max(activeIndex, 0), Math.max(files.length - 1, 0));
  const active = files[safeIndex];
  const activeUrl = active ? fileSignedUrl(document.id, active, safeIndex) : null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-lg font-black text-slate-950">{document.title}</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {document.documentNumber ? `${document.documentNumber} · ` : ''}
              {files.length} file{files.length === 1 ? '' : 's'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50 p-5">
          {active && activeUrl ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {isImageFile(active) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activeUrl}
                  alt={`${document.title} page ${safeIndex + 1}`}
                  className="mx-auto max-h-[58vh] w-auto max-w-full object-contain"
                />
              ) : isPdfFile(active) ? (
                <iframe
                  title={`${document.title} page ${safeIndex + 1}`}
                  src={activeUrl}
                  className="h-[58vh] w-full"
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
                  <p className="text-sm font-semibold text-slate-600">
                    Preview is not available for this file type.
                  </p>
                  <a
                    href={activeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white"
                  >
                    Open file
                  </a>
                </div>
              )}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
              No files available for this document.
            </p>
          )}

          {files.length > 1 ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {files.map((file, index) => {
                const thumbUrl = fileSignedUrl(document.id, file, index);
                const selected = index === safeIndex;
                return (
                  <button
                    key={`${file.documentId || document.id}-${file.fileIndex ?? index}`}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    className={`overflow-hidden rounded-2xl border text-left transition ${
                      selected
                        ? 'border-violet-500 ring-2 ring-violet-200'
                        : 'border-slate-200 hover:border-slate-300'
                    } bg-white`}
                  >
                    <div className="flex h-28 items-center justify-center bg-slate-100">
                      {thumbUrl && isImageFile(file) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumbUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          {isPdfFile(file) ? 'PDF' : 'File'} {index + 1}
                        </span>
                      )}
                    </div>
                    <div className="px-3 py-2">
                      <p className="truncate text-xs font-bold text-slate-700">
                        {file.fileName || `Attachment ${index + 1}`}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
