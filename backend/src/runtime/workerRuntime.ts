import { logger } from '../config/logger';
import { startFaceWorker, stopFaceWorker } from '../workers/face.worker';
import { startFeeGenerationWorker, stopFeeGenerationWorker } from '../workers/fee-generation.worker';
import { startImportWorker, stopImportWorker } from '../workers/import.worker';
import { startNotificationWorker, stopNotificationWorker } from '../workers/notification.worker';
import { startPlatformEmailWorker, stopPlatformEmailWorker } from '../workers/platform-email.worker';
import { startReportWorker, stopReportWorker } from '../workers/report.worker';
import { startTenantEmailWorker, stopTenantEmailWorker } from '../workers/tenant-email.worker';

export type WorkerLifecycle = {
  name: string;
  start: () => unknown;
  stop: () => Promise<void> | void;
};

export const defaultWorkerLifecycles: WorkerLifecycle[] = [
  { name: 'fee-generation', start: startFeeGenerationWorker, stop: stopFeeGenerationWorker },
  { name: 'import-jobs', start: startImportWorker, stop: stopImportWorker },
  { name: 'notifications', start: startNotificationWorker, stop: stopNotificationWorker },
  { name: 'platform-email', start: startPlatformEmailWorker, stop: stopPlatformEmailWorker },
  { name: 'tenant-email', start: startTenantEmailWorker, stop: stopTenantEmailWorker },
  { name: 'report-generation', start: startReportWorker, stop: stopReportWorker },
  { name: 'face-processing', start: startFaceWorker, stop: stopFaceWorker },
];

export const createWorkerRuntime = (workers: WorkerLifecycle[] = defaultWorkerLifecycles) => {
  let started = false;
  const startedWorkers: WorkerLifecycle[] = [];

  const start = async () => {
    if (started) return;
    for (const worker of workers) {
      worker.start();
      startedWorkers.push(worker);
      logger.info({ worker: worker.name }, 'queue worker started');
    }
    started = true;
  };

  const stop = async () => {
    const workersToStop = [...startedWorkers].reverse();
    startedWorkers.length = 0;
    started = false;

    const results = await Promise.allSettled(workersToStop.map((worker) => Promise.resolve(worker.stop())));
    const failed = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (failed) throw failed.reason;
  };

  return { start, stop, getStartedWorkerNames: () => startedWorkers.map((worker) => worker.name) };
};

export type WorkerRuntime = ReturnType<typeof createWorkerRuntime>;
