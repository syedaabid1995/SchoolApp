import fs from 'fs/promises';
import path from 'path';
import {
  LEGACY_FILE_TARGETS,
  buildLegacyMigrationObjectKey,
  buildLegacyReferenceWhere,
  classifyFileReference,
  maskReference,
  prepareLegacyFileRecord,
  prepareLegacyFileUpdateData,
  referenceNeedsMigration,
  resolveLegacyReferenceToLocalFile,
  type LegacyStorageCategory,
} from '../src/services/legacyFileReferences.service';

type Options = {
  apply: boolean;
  schoolId?: string;
  limit?: number;
  category?: LegacyStorageCategory;
  onlyExistingFiles: boolean;
  strictMissing: boolean;
  deleteLocalAfterVerify: boolean;
};

const allowedCategories: LegacyStorageCategory[] = [
  'uploads',
  'homework',
  'imports',
  'exports',
  'audit-exports',
  'backups',
  'student-transfers',
  'tmp',
];

const parseOptions = (): Options => {
  const args = process.argv.slice(2);
  const options: Options = {
    apply: false,
    onlyExistingFiles: false,
    strictMissing: false,
    deleteLocalAfterVerify: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--apply') options.apply = true;
    else if (arg === '--dry-run') options.apply = false;
    else if (arg === '--school-id') options.schoolId = args[++index];
    else if (arg === '--limit') options.limit = Number(args[++index]);
    else if (arg === '--category') options.category = args[++index] as LegacyStorageCategory;
    else if (arg === '--only-existing-files') options.onlyExistingFiles = true;
    else if (arg === '--strict-missing') options.strictMissing = true;
    else if (arg === '--delete-local-after-verify') options.deleteLocalAfterVerify = true;
    else if (arg === '--help') {
      console.log('Usage: tsx scripts/migrate-legacy-uploads-to-storage.ts [--dry-run] [--apply] [--school-id <id>] [--limit <n>] [--category <category>] [--only-existing-files] [--strict-missing]');
      process.exit(0);
    }
  }

  if (options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit < 1)) {
    throw new Error('--limit must be a positive integer');
  }
  if (options.category && !allowedCategories.includes(options.category)) {
    throw new Error(`--category must be one of: ${allowedCategories.join(', ')}`);
  }
  if (options.deleteLocalAfterVerify) {
    throw new Error('--delete-local-after-verify is intentionally not implemented in Phase 2B.');
  }

  return options;
};

const contentTypeFromPath = (value: string) => {
  const ext = path.extname(value).toLowerCase();
  if (ext === '.csv') return 'text/csv';
  if (ext === '.json') return 'application/json';
  if (ext === '.xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.doc') return 'application/msword';
  if (ext === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return 'application/octet-stream';
};

const manifestPath = () =>
  path.resolve(process.cwd(), 'storage/migration-manifests', `legacy-uploads-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`);

const appendManifest = async (filePath: string, entry: Record<string, unknown>) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.appendFile(filePath, `${JSON.stringify(entry)}\n`, { mode: 0o600 });
};

const main = async () => {
  const options = parseOptions();
  const [{ prisma }, storage] = await Promise.all([
    import('../src/config/db'),
    import('../src/services/runtimeStorage.service'),
  ]);
  const manifest = options.apply ? manifestPath() : null;

  let scannedRows = 0;
  let candidates = 0;
  let existingFiles = 0;
  let missingFiles = 0;
  let skippedAlreadyMigrated = 0;
  let migrated = 0;
  let unchanged = 0;
  const examples: Array<Record<string, string | number | null | boolean>> = [];

  try {
    for (const target of LEGACY_FILE_TARGETS) {
      if (options.category && target.category !== options.category) continue;
      const delegate = (prisma as any)[target.delegateName];
      if (!delegate?.findMany) continue;

      const rows = await delegate.findMany({
        where: buildLegacyReferenceWhere(target, options.schoolId, { scanEncryptedStudentFields: true }),
        select: target.select,
        take: options.limit,
      });

      scannedRows += rows.length;

      for (const rawRow of rows) {
        const row = prepareLegacyFileRecord(target, rawRow);
        if (options.limit && candidates >= options.limit) break;
        const schoolId = target.getSchoolId(row);

        for (const field of target.fields) {
          if (options.limit && candidates >= options.limit) break;
          const value = row[field];
          if (typeof value !== 'string') continue;
          const type = classifyFileReference(value);

          if (!referenceNeedsMigration(value)) {
            if (type === 'storage-local' || type === 'storage-s3') skippedAlreadyMigrated += 1;
            continue;
          }

          candidates += 1;
          const resolved = await resolveLegacyReferenceToLocalFile(value);

          if (!resolved?.path) {
            missingFiles += 1;
            if (options.strictMissing) {
              throw new Error(`Missing local file for ${target.model}.${field} ${row.id}: ${maskReference(value)}`);
            }
            if (examples.length < 10) {
              examples.push({
                model: target.model,
                field,
                id: row.id,
                schoolId,
                category: target.category,
                referenceType: type,
                reference: maskReference(value),
                fileExists: false,
              });
            }
            if (options.onlyExistingFiles) continue;
            continue;
          }

          existingFiles += 1;
          const key = buildLegacyMigrationObjectKey({
            schoolId,
            category: target.category,
            model: target.model,
            field,
            recordId: row.id,
            legacyReference: value,
          });

          if (examples.length < 10) {
            examples.push({
              model: target.model,
              field,
              id: row.id,
              schoolId,
              category: target.category,
              referenceType: type,
              reference: maskReference(value),
              fileExists: true,
            });
          }

          if (!options.apply) continue;

          const uploaded = await storage.putRuntimeFile({
            key,
            filePath: resolved.path,
            contentType: contentTypeFromPath(resolved.relativePath),
            metadata: {
              migratedFrom: 'legacy-local-upload',
              sourceModel: target.model,
              sourceField: field,
            },
          });

          const updateResult = await delegate.updateMany({
            where: { id: row.id, [field]: rawRow[field] },
            data: prepareLegacyFileUpdateData(target, field, uploaded.storageRef),
          });

          if (updateResult.count === 1) {
            migrated += 1;
            if (manifest) {
              await appendManifest(manifest, {
                model: target.model,
                field,
                id: row.id,
                schoolId,
                category: target.category,
                oldReference: value.replace(/[?#].*$/, ''),
                newReference: uploaded.storageRef,
                key: uploaded.key,
                migratedAt: new Date().toISOString(),
              });
            }
          } else {
            unchanged += 1;
          }
        }
      }
    }

    console.log(JSON.stringify({
      ok: true,
      dryRun: !options.apply,
      applied: options.apply,
      scannedRows,
      candidates,
      existingFiles,
      missingFiles,
      skippedAlreadyMigrated,
      migrated,
      unchanged,
      oldLocalFilesDeleted: false,
      manifestPath: manifest ? path.relative(process.cwd(), manifest) : null,
      examples,
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
};

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    dryRun: !process.argv.slice(2).includes('--apply'),
    applied: process.argv.slice(2).includes('--apply'),
    message: error instanceof Error ? error.message : 'Legacy upload migration failed.',
  }, null, 2));
  process.exitCode = 1;
});
