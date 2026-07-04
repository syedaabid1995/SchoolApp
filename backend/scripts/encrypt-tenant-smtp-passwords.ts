import { prisma } from '../src/config/db';
import { encryptSecret, isEncryptedSecret } from '../src/utils/cryptoVault';

const run = async () => {
  const configs = await prisma.schoolMessagingConfig.findMany({
    where: {
      channel: 'EMAIL',
      service: { code: 'SMTP' },
    },
    select: {
      id: true,
      credentials: true,
    },
  });

  let updated = 0;
  for (const config of configs) {
    const credentials =
      config.credentials && typeof config.credentials === 'object' && !Array.isArray(config.credentials)
        ? (config.credentials as Record<string, unknown>)
        : {};
    const password = typeof credentials.password === 'string' ? credentials.password : '';
    if (!password || isEncryptedSecret(password)) continue;

    await prisma.schoolMessagingConfig.update({
      where: { id: config.id },
      data: {
        credentials: {
          ...credentials,
          password: encryptSecret(password),
        },
      },
    });
    updated += 1;
  }

  console.log(`Encrypted ${updated} tenant SMTP password(s).`);
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
