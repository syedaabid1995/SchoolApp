import { appLogger } from './app';
import { env } from './config/env';
import { prisma } from './config/db';
import { closeRedis } from './config/redis';
import { closeQueues } from './queues';
import { initializeTelemetry } from './telemetry';
import { assertProcessRoleAllowed, parseProcessRole, processRoleStartsWorkers } from './runtime/processRole';
import { createShutdownHandler } from './runtime/shutdown';
import { createWorkerRuntime } from './runtime/workerRuntime';

const workerRuntime = createWorkerRuntime();
const shutdownHandler = createShutdownHandler([
  { name: 'queue-workers', run: workerRuntime.stop },
  { name: 'queues', run: closeQueues },
  { name: 'redis', run: closeRedis },
  { name: 'prisma', run: () => prisma.$disconnect() },
]);

const start = async () => {
  initializeTelemetry();
  const processRole = parseProcessRole(env.ACADEMIFY_PROCESS_ROLE, env.NODE_ENV);
  assertProcessRoleAllowed(processRole, env.NODE_ENV);

  if (!processRoleStartsWorkers(processRole) || !env.RUN_WORKERS) {
    throw new Error('Worker entrypoint requires ACADEMIFY_PROCESS_ROLE=worker or all and RUN_WORKERS=true.');
  }

  try {
    await prisma.$connect();
    await workerRuntime.start();
    appLogger.info({ processRole, workers: workerRuntime.getStartedWorkerNames() }, 'worker process started');
  } catch (err) {
    appLogger.error({ err, processRole }, 'failed to start worker process');
    await shutdownHandler.shutdown('startup_error');
    process.exit(1);
  }
};

shutdownHandler.installSignalHandlers();

void start();
