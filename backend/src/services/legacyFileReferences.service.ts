import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

export type LegacyReferenceType =
  | 'storage-s3'
  | 'storage-local'
  | 'legacy-upload-url'
  | 'legacy-relative-upload'
  | 'legacy-local-path'
  | 'external-url'
  | 'empty'
  | 'unknown';

export type LegacyStorageCategory =
  | 'uploads'
  | 'homework'
  | 'imports'
  | 'exports'
  | 'audit-exports'
  | 'backups'
  | 'student-transfers'
  | 'tmp';

export type LegacyFileTarget = {
  model: string;
  delegateName: string;
  fields: string[];
  category: LegacyStorageCategory;
  select: Record<string, unknown>;
  schoolWhere?: (schoolId: string) => Record<string, unknown>;
  getSchoolId: (record: any) => string | null;
};

export const LEGACY_REFERENCE_PATTERNS = [
  '/uploads/',
  'uploads/',
  'backend/uploads',
  'local://',
  '\\uploads\\',
  'exports/',
  'backend/exports',
  'storage/backups',
  'backups/',
];

export const LEGACY_FILE_TARGETS: LegacyFileTarget[] = [
  {
    model: 'Student',
    delegateName: 'student',
    fields: ['photoUrl', 'fatherPhotoUrl', 'motherPhotoUrl', 'guardianPhotoUrl', 'docBirthCert', 'docTransferCert', 'docAadhaar', 'docReportCard'],
    category: 'uploads',
    select: {
      id: true,
      schoolId: true,
      photoUrl: true,
      fatherPhotoUrl: true,
      motherPhotoUrl: true,
      guardianPhotoUrl: true,
      docBirthCert: true,
      docTransferCert: true,
      docAadhaar: true,
      docReportCard: true,
    },
    schoolWhere: (schoolId) => ({ schoolId }),
    getSchoolId: (record) => record.schoolId ?? null,
  },
  {
    model: 'StudentDocument',
    delegateName: 'studentDocument',
    fields: ['url'],
    category: 'uploads',
    select: { id: true, schoolId: true, url: true },
    schoolWhere: (schoolId) => ({ schoolId }),
    getSchoolId: (record) => record.schoolId ?? null,
  },
  {
    model: 'StudentPhoto',
    delegateName: 'studentPhoto',
    fields: ['url'],
    category: 'uploads',
    select: { id: true, url: true, student: { select: { schoolId: true } } },
    schoolWhere: (schoolId) => ({ student: { schoolId } }),
    getSchoolId: (record) => record.student?.schoolId ?? null,
  },
  {
    model: 'TeacherProfile',
    delegateName: 'teacherProfile',
    fields: ['photoUrl'],
    category: 'uploads',
    select: { id: true, schoolId: true, photoUrl: true },
    schoolWhere: (schoolId) => ({ schoolId }),
    getSchoolId: (record) => record.schoolId ?? null,
  },
  {
    model: 'StaffDocument',
    delegateName: 'staffDocument',
    fields: ['fileUrl'],
    category: 'uploads',
    select: { id: true, schoolId: true, fileUrl: true },
    schoolWhere: (schoolId) => ({ schoolId }),
    getSchoolId: (record) => record.schoolId ?? null,
  },
  {
    model: 'Homework',
    delegateName: 'homework',
    fields: ['attachmentUrl'],
    category: 'homework',
    select: { id: true, schoolId: true, attachmentUrl: true },
    schoolWhere: (schoolId) => ({ schoolId }),
    getSchoolId: (record) => record.schoolId ?? null,
  },
  {
    model: 'ImportJob',
    delegateName: 'importJob',
    fields: ['filePath'],
    category: 'imports',
    select: { id: true, schoolId: true, filePath: true },
    schoolWhere: (schoolId) => ({ schoolId }),
    getSchoolId: (record) => record.schoolId ?? null,
  },
  {
    model: 'DataExportJob',
    delegateName: 'dataExportJob',
    fields: ['filePath'],
    category: 'exports',
    select: { id: true, schoolId: true, filePath: true },
    schoolWhere: (schoolId) => ({ schoolId }),
    getSchoolId: (record) => record.schoolId ?? null,
  },
  {
    model: 'AuditExport',
    delegateName: 'auditExport',
    fields: ['fileUrl', 'fileKey'],
    category: 'audit-exports',
    select: { id: true, schoolId: true, fileUrl: true, fileKey: true },
    schoolWhere: (schoolId) => ({ schoolId }),
    getSchoolId: (record) => record.schoolId ?? null,
  },
  {
    model: 'BackupJob',
    delegateName: 'backupJob',
    fields: ['storagePath'],
    category: 'backups',
    select: { id: true, schoolId: true, storagePath: true },
    schoolWhere: (schoolId) => ({ schoolId }),
    getSchoolId: (record) => record.schoolId ?? null,
  },
  {
    model: 'FaceSample',
    delegateName: 'faceSample',
    fields: ['imageUrl'],
    category: 'uploads',
    select: { id: true, imageUrl: true, faceProfile: { select: { schoolId: true } } },
    schoolWhere: (schoolId) => ({ faceProfile: { schoolId } }),
    getSchoolId: (record) => record.faceProfile?.schoolId ?? null,
  },
  {
    model: 'AttendanceEvidence',
    delegateName: 'attendanceEvidence',
    fields: ['imageUrl'],
    category: 'uploads',
    select: {
      id: true,
      imageUrl: true,
      record: { select: { session: { select: { schoolId: true } } } },
    },
    schoolWhere: (schoolId) => ({ record: { session: { schoolId } } }),
    getSchoolId: (record) => record.record?.session?.schoolId ?? null,
  },
  {
    model: 'LeaveAttachment',
    delegateName: 'leaveAttachment',
    fields: ['fileUrl'],
    category: 'uploads',
    select: { id: true, fileUrl: true, leaveApplication: { select: { schoolId: true } } },
    schoolWhere: (schoolId) => ({ leaveApplication: { schoolId } }),
    getSchoolId: (record) => record.leaveApplication?.schoolId ?? null,
  },
  {
    model: 'FeeInvoice',
    delegateName: 'feeInvoice',
    fields: ['pdfUrl'],
    category: 'exports',
    select: { id: true, schoolId: true, pdfUrl: true },
    schoolWhere: (schoolId) => ({ schoolId }),
    getSchoolId: (record) => record.schoolId ?? null,
  },
  {
    model: 'FeeReceipt',
    delegateName: 'feeReceipt',
    fields: ['pdfUrl'],
    category: 'exports',
    select: { id: true, schoolId: true, pdfUrl: true },
    schoolWhere: (schoolId) => ({ schoolId }),
    getSchoolId: (record) => record.schoolId ?? null,
  },
  {
    model: 'SubscriptionPayment',
    delegateName: 'subscriptionPayment',
    fields: ['proofUrl'],
    category: 'uploads',
    select: { id: true, schoolId: true, proofUrl: true },
    schoolWhere: (schoolId) => ({ schoolId }),
    getSchoolId: (record) => record.schoolId ?? null,
  },
];

const stripQueryAndFragment = (value: string) => value.replace(/[?#].*$/, '');

const decodePathPart = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const classifyFileReference = (value: string | null | undefined): LegacyReferenceType => {
  const raw = value?.trim();
  if (!raw) return 'empty';
  const normalized = raw.replace(/\\/g, '/');
  const lower = normalized.toLowerCase();

  if (lower.startsWith('s3://')) return 'storage-s3';
  if (lower.startsWith('local://')) return 'storage-local';
  if (lower.startsWith('/uploads/')) return 'legacy-upload-url';
  if (lower.startsWith('uploads/')) return 'legacy-relative-upload';
  if (lower.includes('/uploads/') || lower.includes('backend/uploads/')) return 'legacy-local-path';
  if (lower.includes('/exports/') || lower.includes('backend/exports/') || lower.includes('/storage/backups/') || lower.includes('/backups/')) {
    return 'legacy-local-path';
  }

  try {
    const parsed = new URL(raw);
    if (parsed.pathname.toLowerCase().startsWith('/uploads/')) return 'legacy-upload-url';
    return 'external-url';
  } catch {
    return path.isAbsolute(raw) ? 'legacy-local-path' : 'unknown';
  }
};

export const referenceNeedsMigration = (value: string | null | undefined) => {
  const type = classifyFileReference(value);
  return type === 'legacy-upload-url' || type === 'legacy-relative-upload' || type === 'legacy-local-path';
};

export const maskReference = (value: string | null | undefined) => {
  const raw = stripQueryAndFragment(value?.trim() ?? '');
  if (!raw) return '<empty>';
  if (raw.length <= 42) return raw;
  return `${raw.slice(0, 24)}...${raw.slice(-14)} (len=${raw.length})`;
};

const pathAfterSegment = (value: string, segment: string) => {
  const normalized = stripQueryAndFragment(value).replace(/\\/g, '/');
  const lower = normalized.toLowerCase();
  const index = lower.lastIndexOf(segment);
  if (index < 0) return null;
  return normalized.slice(index + segment.length);
};

export const safeRelativePathFromLegacyReference = (value: string) => {
  const trimmed = stripQueryAndFragment(value.trim());
  let candidate: string | null = null;

  try {
    const parsed = new URL(trimmed);
    candidate = parsed.pathname.toLowerCase().startsWith('/uploads/')
      ? parsed.pathname.slice('/uploads/'.length)
      : null;
  } catch {
    const normalized = trimmed.replace(/\\/g, '/');
    if (normalized.startsWith('/uploads/')) candidate = normalized.slice('/uploads/'.length);
    else if (normalized.startsWith('uploads/')) candidate = normalized.slice('uploads/'.length);
    else candidate = pathAfterSegment(normalized, '/uploads/');
  }

  if (!candidate) return null;

  const decoded = decodePathPart(candidate).replace(/\\/g, '/');
  if (decoded.startsWith('/') || decoded.includes('\0')) return null;
  const parts = decoded.split('/').filter(Boolean);
  if (!parts.length) return null;
  if (parts.some((part) => part === '.' || part === '..' || part.includes(':'))) return null;
  return parts.join('/');
};

export const getDefaultLegacyUploadRoots = (cwd = process.cwd()) => {
  const roots = [
    path.resolve(cwd, 'uploads'),
    path.resolve(cwd, 'backend/uploads'),
    path.resolve(cwd, '../uploads'),
    path.resolve(cwd, 'exports'),
    path.resolve(cwd, 'backend/exports'),
    path.resolve(cwd, '../backend/exports'),
    path.resolve(cwd, 'storage'),
    path.resolve(cwd, 'backend/storage'),
    path.resolve(cwd, '../backend/storage'),
  ];
  return [...new Set(roots)];
};

export const resolveLegacyReferenceToLocalFile = async (value: string, roots = getDefaultLegacyUploadRoots()) => {
  const relativePath = safeRelativePathFromLegacyReference(value);
  const stripped = stripQueryAndFragment(value.trim()).replace(/\\/g, '/');
  if (stripped.includes('\0')) return null;
  if (stripped.split('/').some((part) => part === '.' || part === '..' || part.includes(':'))) return null;

  const candidates = relativePath
    ? roots.map((root) => ({ root, candidate: path.resolve(root, relativePath) }))
    : roots.flatMap((root) => [
        { root, candidate: path.isAbsolute(stripped) ? path.resolve(stripped) : path.resolve(process.cwd(), stripped) },
        { root, candidate: path.resolve(root, stripped) },
      ]);

  for (const { root, candidate } of candidates) {
    const resolvedRoot = path.resolve(root);
    if (!candidate.startsWith(resolvedRoot + path.sep) && candidate !== resolvedRoot) continue;
    try {
      const stat = await fs.stat(candidate);
      if (stat.isFile()) {
        return {
          path: candidate,
          relativePath: relativePath ?? path.relative(resolvedRoot, candidate).split(path.sep).join('/'),
          sizeBytes: stat.size,
        };
      }
    } catch {
      // Try the next allowed legacy root.
    }
  }

  return { path: null, relativePath: relativePath ?? null, sizeBytes: null };
};

const safeKeySegment = (value: string) =>
  value
    .trim()
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(0, 96) || 'item';

export const extensionFromLegacyReference = (value: string) => {
  const relative = safeRelativePathFromLegacyReference(value);
  const ext = path.extname(relative ?? stripQueryAndFragment(value)).toLowerCase().replace(/[^a-z0-9.]/g, '');
  return ext && ext.length <= 16 ? ext : '';
};

export const buildLegacyMigrationObjectKey = (params: {
  schoolId?: string | null;
  category: LegacyStorageCategory;
  model: string;
  field: string;
  recordId: string;
  legacyReference: string;
}) => {
  const root = params.schoolId ? `schools/${params.schoolId}` : 'platform';
  const hash = crypto.createHash('sha256').update(params.legacyReference).digest('hex').slice(0, 12);
  const ext = extensionFromLegacyReference(params.legacyReference);
  return [
    root,
    safeKeySegment(params.category),
    'legacy',
    safeKeySegment(params.model),
    safeKeySegment(params.field),
    `${safeKeySegment(params.recordId)}-${hash}${ext}`,
  ].join('/');
};

export const buildLegacyReferenceWhere = (target: LegacyFileTarget, schoolId?: string | null) => {
  const patternWhere = {
    OR: target.fields.flatMap((field) =>
      LEGACY_REFERENCE_PATTERNS.map((pattern) => ({
        [field]: { contains: pattern, mode: 'insensitive' },
      })),
    ),
  };

  const schoolWhere = schoolId && target.schoolWhere ? target.schoolWhere(schoolId) : null;
  return schoolWhere ? { AND: [schoolWhere, patternWhere] } : patternWhere;
};
