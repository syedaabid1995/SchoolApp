import {
  LEGACY_FILE_TARGETS,
  buildLegacyReferenceWhere,
  classifyFileReference,
  maskReference,
  prepareLegacyFileRecord,
} from '../src/services/legacyFileReferences.service';

type Options = {
  schoolId?: string;
  limit?: number;
};

const parseOptions = (): Options => {
  const args = process.argv.slice(2);
  const options: Options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--school-id') options.schoolId = args[++index];
    else if (arg === '--limit') options.limit = Number(args[++index]);
    else if (arg === '--help') {
      console.log('Usage: tsx scripts/audit-legacy-file-references.ts [--school-id <id>] [--limit <n>]');
      process.exit(0);
    }
  }
  if (options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit < 1)) {
    throw new Error('--limit must be a positive integer');
  }
  return options;
};

const increment = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1);

const main = async () => {
  const options = parseOptions();
  const { prisma } = await import('../src/config/db');
  const byTarget = new Map<string, number>();
  const bySchool = new Map<string, number>();
  const byType = new Map<string, number>();
  const examples: Array<Record<string, string | null>> = [];
  let scannedRows = 0;
  let matchedReferences = 0;

  try {
    for (const target of LEGACY_FILE_TARGETS) {
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
        const schoolId = target.getSchoolId(row);
        for (const field of target.fields) {
          const value = row[field];
          if (typeof value !== 'string') continue;
          const type = classifyFileReference(value);
          if (type === 'empty' || type === 'unknown' || type === 'external-url') continue;

          matchedReferences += 1;
          increment(byTarget, `${target.model}.${field}`);
          increment(bySchool, schoolId ?? 'platform-or-unknown');
          increment(byType, type);
          if (examples.length < 10) {
            examples.push({
              model: target.model,
              field,
              id: row.id,
              schoolId,
              type,
              reference: maskReference(value),
            });
          }
        }
      }
    }

    console.log(JSON.stringify({
      ok: true,
      dryRun: true,
      modifiedDatabase: false,
      scannedRows,
      matchedReferences,
      byTarget: Object.fromEntries([...byTarget.entries()].sort()),
      bySchool: Object.fromEntries([...bySchool.entries()].sort()),
      byType: Object.fromEntries([...byType.entries()].sort()),
      examples,
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
};

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    dryRun: true,
    modifiedDatabase: false,
    message: error instanceof Error ? error.message : 'Legacy file reference audit failed.',
  }, null, 2));
  process.exitCode = 1;
});
