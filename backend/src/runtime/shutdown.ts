import { env } from '../config/env';
import { logger } from '../config/logger';

type ShutdownTask = {
  name: string;
  run: () => Promise<void> | void;
};

export const createShutdownHandler = (tasks: ShutdownTask[]) => {
  let shutdownPromise: Promise<void> | undefined;

  const shutdown = async (signal: NodeJS.Signals | 'startup_error') => {
    if (shutdownPromise) return shutdownPromise;

    shutdownPromise = (async () => {
      logger.info({ signal }, 'shutdown started');
      const forceExit = setTimeout(() => {
        logger.error({ signal, timeoutMs: env.SHUTDOWN_GRACE_MS }, 'shutdown timed out; forcing exit');
        process.exit(1);
      }, env.SHUTDOWN_GRACE_MS);
      forceExit.unref();

      try {
        for (const task of tasks) {
          try {
            await task.run();
          } catch (err) {
            logger.error({ err, task: task.name }, 'shutdown task failed');
            throw err;
          }
        }
        clearTimeout(forceExit);
        logger.info({ signal }, 'shutdown complete');
      } catch (err) {
        clearTimeout(forceExit);
        logger.error({ err, signal }, 'shutdown failed');
        process.exitCode = 1;
      }
    })();

    return shutdownPromise;
  };

  const installSignalHandlers = () => {
    process.once('SIGTERM', () => {
      void shutdown('SIGTERM').finally(() => process.exit(process.exitCode ?? 0));
    });
    process.once('SIGINT', () => {
      void shutdown('SIGINT').finally(() => process.exit(process.exitCode ?? 0));
    });
  };

  return { shutdown, installSignalHandlers };
};
