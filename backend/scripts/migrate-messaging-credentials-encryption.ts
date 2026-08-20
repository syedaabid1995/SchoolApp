import { NotificationChannel, Prisma } from '@prisma/client';
import { prisma } from '../src/config/db';
import {
  decryptMessagingCredentials,
  encryptMessagingCredentialsForStorage,
  isMessagingSecretCredentialKey,
} from '../src/utils/messagingCredentialsCrypto';
import { isEncryptedSensitiveField } from '../src/utils/sensitiveFieldCrypto';
import { isEncryptedSecret } from '../src/utils/cryptoVault';

type Options = {
  apply: boolean;
  schoolId?: string;
  channel?: NotificationChannel;
  limit?: number;
};

const parseOptions = (): Options => {
  const args = process.argv.slice(2);
  const options: Options = { apply: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--apply') options.apply = true;
    else if (arg === '--dry-run') options.apply = false;
    else if (arg === '--school-id') options.schoolId = args[++index];
    else if (arg === '--channel') options.channel = args[++index] as NotificationChannel;
    else if (arg === '--limit') options.limit = Number(args[++index]);
    else if (arg === '--help') {
      console.log('Usage: tsx scripts/migrate-messaging-credentials-encryption.ts [--dry-run] [--apply] [--school-id <id>] [--channel EMAIL|SMS|WHATSAPP|PUSH] [--limit <n>]');
      process.exit(0);
    }
  }
  if (options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit < 1)) {
    throw new Error('--limit must be a positive integer');
  }
  if (options.channel && !['EMAIL', 'SMS', 'WHATSAPP', 'PUSH'].includes(options.channel)) {
    throw new Error('--channel must be one of: EMAIL, SMS, WHATSAPP, PUSH');
  }
  return options;
};

const secretState = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) return 'empty';
  if (isEncryptedSensitiveField(value)) return 'sensitiveEncrypted';
  if (isEncryptedSecret(value)) return 'legacyVaultEncrypted';
  return 'plaintext';
};

const main = async () => {
  const options = parseOptions();
  const configs = await prisma.schoolMessagingConfig.findMany({
    where: {
      ...(options.schoolId ? { schoolId: options.schoolId } : {}),
      ...(options.channel ? { channel: options.channel } : {}),
    },
    select: {
      id: true,
      schoolId: true,
      channel: true,
      credentials: true,
    },
    take: options.limit,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });

  let changedConfigs = 0;
  let updatedConfigs = 0;
  let decryptErrorConfigs = 0;
  const changedSecretKeys: Record<string, number> = {};
  const beforeStates: Record<string, number> = {};

  for (const config of configs) {
    const current =
      config.credentials && typeof config.credentials === 'object' && !Array.isArray(config.credentials)
        ? (config.credentials as Record<string, unknown>)
        : {};
    let decrypted: Record<string, string>;
    try {
      decrypted = decryptMessagingCredentials(current);
    } catch {
      decryptErrorConfigs += 1;
      continue;
    }
    const next = encryptMessagingCredentialsForStorage(decrypted);

    const changedKeys = new Set<string>();
    for (const key of Object.keys(current)) {
      if (!isMessagingSecretCredentialKey(key)) continue;
      const state = secretState(current[key]);
      beforeStates[state] = (beforeStates[state] ?? 0) + 1;
      if (current[key] !== next[key]) {
        changedKeys.add(key);
      }
    }
    for (const key of Object.keys(next)) {
      if (!isMessagingSecretCredentialKey(key)) continue;
      if (!(key in current) && next[key]) {
        changedKeys.add(key);
      }
    }

    if (!changedKeys.size) continue;
    changedConfigs += 1;
    for (const key of changedKeys) {
      changedSecretKeys[key] = (changedSecretKeys[key] ?? 0) + 1;
    }

    if (options.apply) {
      await prisma.schoolMessagingConfig.update({
        where: { id: config.id },
        data: {
          credentials: next as unknown as Prisma.InputJsonValue,
        },
      });
      updatedConfigs += 1;
    }
  }

  console.log(JSON.stringify({
    ok: true,
    dryRun: !options.apply,
    applied: options.apply,
    modifiedDatabase: options.apply,
    scope: {
      schoolId: options.schoolId ?? null,
      channel: options.channel ?? null,
      limit: options.limit ?? null,
    },
    scannedConfigs: configs.length,
    changedConfigs,
    updatedConfigs,
    decryptErrorConfigs,
    beforeStates,
    changedSecretKeys: Object.fromEntries(Object.entries(changedSecretKeys).sort()),
  }, null, 2));
};

main()
  .catch((error) => {
    const applied = process.argv.slice(2).includes('--apply');
    console.error(JSON.stringify({
      ok: false,
      dryRun: !applied,
      applied,
      modifiedDatabase: false,
      message: error instanceof Error ? error.message : 'Messaging credentials encryption migration failed.',
    }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
