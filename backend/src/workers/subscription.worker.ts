import { prisma } from '../config/db';
import { logger } from '../config/logger';
import { runWithDistributedLock, type DistributedLockClient } from '../services/distributedLock.service';
import { markOverdueSubscriptionInvoices } from '../services/subscription.service';

let subscriptionInterval: NodeJS.Timeout | undefined;
let activeSubscriptionRun: Promise<unknown> | undefined;
const subscriptionJobName = 'subscriptions.expiry-check';
const subscriptionLockKey = 'academify:scheduler:subscriptions:expiry-check';
const subscriptionLockTtlMs = 55 * 60 * 1000;

export const processExpiredSubscriptions = async () => {
  try {
    const now = new Date();
    
    const overdueInvoices = await markOverdueSubscriptionInvoices(now);

    // Find subscriptions past grace period
    const expiredSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        nextDueAt: { lt: now }
      },
      include: { school: true }
    });

    for (const subscription of expiredSubscriptions) {
      // Update subscription status
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'EXPIRED' }
      });

      // Suspend school
      await prisma.school.update({
        where: { id: subscription.schoolId },
        data: { 
          status: 'SUSPENDED',
          statusReason: 'Payment overdue - subscription expired'
        }
      });

      logger.info(`School ${subscription.school.name} suspended due to expired subscription`);
    }

    // Find subscriptions in grace period for warnings
    const graceSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        endsAt: { lt: now },
        nextDueAt: { gte: now }
      },
      include: { school: true }
    });

    for (const subscription of graceSubscriptions) {
      const daysLeft = Math.ceil((subscription.nextDueAt!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      logger.warn(`School ${subscription.school.name} in grace period - ${daysLeft} days left`);
    }

    logger.info(
      `Processed ${expiredSubscriptions.length} expired subscriptions, ${graceSubscriptions.length} in grace period, ${overdueInvoices.count} overdue invoices`,
    );
  } catch (error) {
    logger.error({ err: error }, 'Error processing expired subscriptions');
  }
};

export const runSubscriptionSchedulerOnce = async (params?: { lockClient?: DistributedLockClient }) =>
  runWithDistributedLock({
    key: subscriptionLockKey,
    ttlMs: subscriptionLockTtlMs,
    jobName: subscriptionJobName,
    client: params?.lockClient,
    run: processExpiredSubscriptions,
  });

const triggerSubscriptionSchedulerRun = () => {
  activeSubscriptionRun = runSubscriptionSchedulerOnce().finally(() => {
    activeSubscriptionRun = undefined;
  });
  return activeSubscriptionRun;
};

// Run every hour.
export const startSubscriptionScheduler = () => {
  if (subscriptionInterval) return;
  subscriptionInterval = setInterval(() => {
    void triggerSubscriptionSchedulerRun();
  }, 60 * 60 * 1000);
  void triggerSubscriptionSchedulerRun(); // Run immediately on start.
};

export const stopSubscriptionScheduler = async () => {
  const activeRun = activeSubscriptionRun;
  clearInterval(subscriptionInterval);
  subscriptionInterval = undefined;
  if (activeRun) await activeRun;
};

export const startSubscriptionWorker = startSubscriptionScheduler;
export const stopSubscriptionWorker = stopSubscriptionScheduler;
