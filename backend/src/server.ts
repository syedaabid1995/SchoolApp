import type { Server } from 'http';
import { createApp, appLogger } from './app';
import { env } from './config/env';
import { prisma } from './config/db';
import { closeRedis } from './config/redis';
import { closeQueues } from './queues';
import { initializeTelemetry } from './telemetry';
import { assertProcessRoleAllowed, parseProcessRole, processRoleStartsApi } from './runtime/processRole';
import { createShutdownHandler } from './runtime/shutdown';

let httpServer: Server | undefined;

const closeHttpServer = async () => {
  if (!httpServer) return;
  await new Promise<void>((resolve, reject) => {
    httpServer!.close((error) => {
      if (error) reject(error);
      else resolve();
    });
    httpServer!.closeIdleConnections?.();
  });
  httpServer = undefined;
};

const shutdownHandler = createShutdownHandler([
  { name: 'http-server', run: closeHttpServer },
  { name: 'queues', run: closeQueues },
  { name: 'redis', run: closeRedis },
  { name: 'prisma', run: () => prisma.$disconnect() },
]);

const start = async () => {
  initializeTelemetry();
  const processRole = parseProcessRole(env.ACADEMIFY_PROCESS_ROLE, env.NODE_ENV);
  assertProcessRoleAllowed(processRole, env.NODE_ENV);

  if (!processRoleStartsApi(processRole) || !env.RUN_API) {
    throw new Error('API entrypoint requires ACADEMIFY_PROCESS_ROLE=api or all and RUN_API=true.');
  }

  try {
    await prisma.$connect();
    appLogger.info({ processRole }, 'database connected');

    const app = createApp();
    httpServer = app.listen(env.PORT, () => {
      appLogger.info({ port: env.PORT, env: env.NODE_ENV, processRole }, 'api server started');
    });
  } catch (err) {
    appLogger.error({ err, processRole }, 'failed to start API process');
    await shutdownHandler.shutdown('startup_error');
    process.exit(1);
  }
};

shutdownHandler.installSignalHandlers();

void start();
