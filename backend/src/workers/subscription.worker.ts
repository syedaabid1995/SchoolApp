import { prisma } from '../config/db';
import { logger } from '../config/logger';

export const processExpiredSubscriptions = async () => {
  try {
    const now = new Date();
    
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

    logger.info(`Processed ${expiredSubscriptions.length} expired subscriptions, ${graceSubscriptions.length} in grace period`);
  } catch (error) {
    logger.error({ err: error }, 'Error processing expired subscriptions');
  }
};

// Run every hour
export const startSubscriptionWorker = () => {
  setInterval(processExpiredSubscriptions, 60 * 60 * 1000);
  processExpiredSubscriptions(); // Run immediately on start
};
