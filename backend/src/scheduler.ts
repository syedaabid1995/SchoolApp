import { appLogger } from './app';
import { env } from './config/env';
import { prisma } from './config/db';
import { closeRedis } from './config/redis';
import { closeQueues } from './queues';
import { initializeTelemetry } from './telemetry';
import { assertProcessRoleAllowed, parseProcessRole, processRoleStartsSchedulers } from './runtime/processRole';
import { createShutdownHandler } from './runtime/shutdown';
import { createSchedulerRuntime } from './runtime/schedulerRuntime';

const schedulerRuntime = createSchedulerRuntime();
const shutdownHandler = createShutdownHandler([
  { name: 'schedulers', run: schedulerRuntime.stop },
  { name: 'queues', run: closeQueues },
  { name: 'redis', run: closeRedis },
  { name: 'prisma', run: () => prisma.$disconnect() },
]);

const start = async () => {
  initializeTelemetry();
  const processRole = parseProcessRole(env.ACADEMIFY_PROCESS_ROLE, env.NODE_ENV);
  assertProcessRoleAllowed(processRole, env.NODE_ENV);

  if (!processRoleStartsSchedulers(processRole) || !env.RUN_SCHEDULERS) {
    throw new Error('Scheduler entrypoint requires ACADEMIFY_PROCESS_ROLE=scheduler or all and RUN_SCHEDULERS=true.');
  }

  try {
    await prisma.$connect();
    await schedulerRuntime.start();
    appLogger.info({ processRole, schedulers: schedulerRuntime.getStartedSchedulerNames() }, 'scheduler process started');
  } catch (err) {
    appLogger.error({ err, processRole }, 'failed to start scheduler process');
    await shutdownHandler.shutdown('startup_error');
    process.exit(1);
  }
};

shutdownHandler.installSignalHandlers();

void start();
