import { logger } from '../config/logger';
import { startSubscriptionScheduler, stopSubscriptionScheduler } from '../workers/subscription.worker';

export type SchedulerLifecycle = {
  name: string;
  start: () => unknown;
  stop: () => Promise<void> | void;
};

export const defaultSchedulerLifecycles: SchedulerLifecycle[] = [
  { name: 'subscriptions.expiry-check', start: startSubscriptionScheduler, stop: stopSubscriptionScheduler },
];

export const createSchedulerRuntime = (schedulers: SchedulerLifecycle[] = defaultSchedulerLifecycles) => {
  let started = false;
  const startedSchedulers: SchedulerLifecycle[] = [];

  const start = async () => {
    if (started) return;
    for (const scheduler of schedulers) {
      scheduler.start();
      startedSchedulers.push(scheduler);
      logger.info({ scheduler: scheduler.name }, 'scheduler started');
    }
    started = true;
  };

  const stop = async () => {
    const schedulersToStop = [...startedSchedulers].reverse();
    startedSchedulers.length = 0;
    started = false;

    const results = await Promise.allSettled(schedulersToStop.map((scheduler) => Promise.resolve(scheduler.stop())));
    const failed = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (failed) throw failed.reason;
  };

  return { start, stop, getStartedSchedulerNames: () => startedSchedulers.map((scheduler) => scheduler.name) };
};

export type SchedulerRuntime = ReturnType<typeof createSchedulerRuntime>;
