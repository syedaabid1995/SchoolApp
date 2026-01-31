import { createApp, appLogger } from './app';
import { env } from './config/env';
import { prisma } from './config/db';

const start = async () => {
  const app = createApp();

  try {
    await prisma.$connect();
    appLogger.info('database connected');

    app.listen(env.PORT, () => {
      appLogger.info({ port: env.PORT, env: env.NODE_ENV }, 'server started');
    });
  } catch (err) {
    appLogger.error({ err }, 'failed to start server');
    await prisma.$disconnect();
    process.exit(1);
  }
};

void start();
