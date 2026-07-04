import type { Server } from 'http';
import { createApp, appLogger } from './app';
import { env } from './config/env';
import { prisma } from './config/db';
import { closeRedis } from './config/redis';
import { closeQueues } from './queues';
import { initializeTelemetry } from './telemetry';
import { assertProcessRoleAllowed, parseProcessRole } from './runtime/processRole';
import { createShutdownHandler } from './runtime/shutdown';
import { createSchedulerRuntime } from './runtime/schedulerRuntime';
import { createWorkerRuntime } from './runtime/workerRuntime';
import { closeEmailTransports } from './services/email/transports';

let httpServer: Server | undefined;
const workerRuntime = createWorkerRuntime();
const schedulerRuntime = createSchedulerRuntime();

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
  { name: 'schedulers', run: schedulerRuntime.stop },
  { name: 'queue-workers', run: workerRuntime.stop },
  { name: 'email-transports', run: closeEmailTransports },
  { name: 'queues', run: closeQueues },
  { name: 'redis', run: closeRedis },
  { name: 'prisma', run: () => prisma.$disconnect() },
]);

const start = async () => {
  initializeTelemetry();
  const processRole = parseProcessRole(env.ACADEMIFY_PROCESS_ROLE, env.NODE_ENV);
  assertProcessRoleAllowed(processRole, env.NODE_ENV);

  if (processRole !== 'all') {
    throw new Error('Combined entrypoint requires ACADEMIFY_PROCESS_ROLE=all.');
  }

  try {
    await prisma.$connect();
    const app = createApp();
    httpServer = app.listen(env.PORT, () => {
      appLogger.info({ port: env.PORT, env: env.NODE_ENV, processRole }, 'combined API server started');
    });
    await workerRuntime.start();
    await schedulerRuntime.start();
    appLogger.warn({ processRole }, 'combined API/worker/scheduler process is for local development only');
  } catch (err) {
    appLogger.error({ err, processRole }, 'failed to start combined process');
    await shutdownHandler.shutdown('startup_error');
    process.exit(1);
  }
};

shutdownHandler.installSignalHandlers();

void start();
