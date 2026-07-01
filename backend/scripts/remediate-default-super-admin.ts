import 'dotenv/config';
import { PrismaClient, type UserStatus } from '@prisma/client';

type Mode = 'disable' | 'force-reset';

const DEFAULT_EMAIL = 'techstageit@admin.com';
const prisma = new PrismaClient();

const args = process.argv.slice(2);

const argValue = (name: string) => {
  const prefix = `${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
};

const hasFlag = (name: string) => args.includes(name);

const maskEmail = (email: string) => {
  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) return '<masked-email>';
  const visiblePrefix = localPart.slice(0, 2);
  return `${visiblePrefix}${'*'.repeat(Math.max(localPart.length - visiblePrefix.length, 3))}@${domain}`;
};

const printUsage = () => {
  console.log([
    'Usage: npm run remediate:default-super-admin -- [--dry-run] [--apply] [--email=techstageit@admin.com] [--mode=disable|force-reset]',
    '',
    'Defaults to dry-run mode. No full email, password, or password hash is printed.',
    '',
    'Modes:',
    '  disable      Set status=INACTIVE and mustChangePassword=true.',
    '  force-reset  Keep current status and set mustChangePassword=true.',
  ].join('\n'));
};

const parseMode = (): Mode => {
  const mode = argValue('--mode') ?? 'disable';
  if (mode === 'disable' || mode === 'force-reset') return mode;
  throw new Error('Invalid --mode. Use disable or force-reset.');
};

const assertSafeApply = (apply: boolean) => {
  if (!apply) return;
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_SUPER_ADMIN_REMEDIATION !== 'true') {
    throw new Error(
      'Refusing to apply in production without ALLOW_PRODUCTION_SUPER_ADMIN_REMEDIATION=true. Prefer running this during a reviewed maintenance window.',
    );
  }
};

const main = async () => {
  if (hasFlag('--help') || hasFlag('-h')) {
    printUsage();
    return;
  }

  const apply = hasFlag('--apply');
  const email = argValue('--email') ?? DEFAULT_EMAIL;
  const mode = parseMode();
  assertSafeApply(apply);

  const user = await prisma.user.findFirst({
    where: {
      schoolId: null,
      email: { equals: email, mode: 'insensitive' },
      roles: { some: { role: { name: 'SUPER_ADMIN' } } },
    },
    select: {
      id: true,
      email: true,
      status: true,
      mustChangePassword: true,
      mfaEnabled: true,
      updatedAt: true,
      roles: { select: { role: { select: { name: true } } } },
    },
  });

  const maskedEmail = maskEmail(email);

  if (!user) {
    console.log(JSON.stringify({ found: false, email: maskedEmail, applied: false, mode }, null, 2));
    return;
  }

  const updateData: { status?: UserStatus; mustChangePassword: boolean } =
    mode === 'disable'
      ? { status: 'INACTIVE', mustChangePassword: true }
      : { mustChangePassword: true };

  const summary = {
    found: true,
    applied: apply,
    mode,
    user: {
      id: user.id,
      email: maskEmail(user.email),
      status: user.status,
      mustChangePassword: user.mustChangePassword,
      mfaEnabled: user.mfaEnabled,
      roles: user.roles.map((entry) => entry.role.name),
      updatedAt: user.updatedAt.toISOString(),
    },
    plannedUpdate: updateData,
  };

  if (!apply) {
    console.log(JSON.stringify({ ...summary, dryRun: true }, null, 2));
    return;
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: updateData,
    select: {
      id: true,
      email: true,
      status: true,
      mustChangePassword: true,
      mfaEnabled: true,
      updatedAt: true,
    },
  });

  console.log(JSON.stringify({
    ...summary,
    dryRun: false,
    updated: {
      ...updated,
      email: maskEmail(updated.email),
      updatedAt: updated.updatedAt.toISOString(),
    },
  }, null, 2));
};

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Default super-admin remediation failed.');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
