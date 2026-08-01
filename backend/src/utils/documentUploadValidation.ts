import path from 'path';
import { HttpError } from '../middlewares/error.middleware';

const documentTypes = {
  'application/pdf': {
    extensions: ['.pdf'],
    matches: (buffer: Buffer) => buffer.length > 5 && buffer.toString('ascii', 0, 5) === '%PDF-',
  },
  'application/msword': {
    extensions: ['.doc'],
    matches: (buffer: Buffer) =>
      buffer.length > 8 &&
      buffer[0] === 0xd0 &&
      buffer[1] === 0xcf &&
      buffer[2] === 0x11 &&
      buffer[3] === 0xe0 &&
      buffer[4] === 0xa1 &&
      buffer[5] === 0xb1 &&
      buffer[6] === 0x1a &&
      buffer[7] === 0xe1,
  },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    extensions: ['.docx'],
    matches: (buffer: Buffer) => buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b,
  },
  'image/jpeg': {
    extensions: ['.jpg', '.jpeg'],
    matches: (buffer: Buffer) => buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  },
  'image/png': {
    extensions: ['.png'],
    matches: (buffer: Buffer) =>
      buffer.length > 24 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a,
  },
  'image/webp': {
    extensions: ['.webp'],
    matches: (buffer: Buffer) =>
      buffer.length > 30 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP',
  },
} as const;

export const allowedDocumentMimeTypes = Object.keys(documentTypes);

export const isAllowedDocumentMimeType = (value: string) =>
  Object.prototype.hasOwnProperty.call(documentTypes, value);

export const validateUploadedDocumentFile = (file: Pick<Express.Multer.File, 'buffer' | 'mimetype' | 'originalname'>) => {
  if (!isAllowedDocumentMimeType(file.mimetype)) {
    throw new HttpError(400, 'Unsupported document type');
  }

  const expected = documentTypes[file.mimetype as keyof typeof documentTypes];
  const extension = path.extname(file.originalname).toLowerCase();
  if (!(expected.extensions as readonly string[]).includes(extension)) {
    throw new HttpError(400, 'Document extension does not match the uploaded file type');
  }

  if (!expected.matches(file.buffer)) {
    throw new HttpError(400, 'Uploaded file content does not match the selected document type');
  }
};
