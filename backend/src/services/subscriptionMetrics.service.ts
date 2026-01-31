import { prisma } from '../config/db';

export const getSubscriptionMetrics = async (schoolId: string) => {
  const [subscription, usage] = await Promise.all([
    prisma.subscription.findUnique({ where: { schoolId } }),
    prisma.usageCounter.findUnique({ where: { schoolId } }),
  ]);

  const studentCount = usage?.students ?? 0;
  const teacherCount = usage?.teachers ?? 0;

  const studentLimit = subscription?.studentLimit ?? 0;
  const teacherLimit = subscription?.teacherLimit ?? 0;

  return {
    plan: subscription
      ? {
          name: subscription.planName,
          status: subscription.status,
          startsAt: subscription.startsAt,
          endsAt: subscription.endsAt,
          studentLimit,
          teacherLimit,
        }
      : null,
    usage: {
      students: studentCount,
      teachers: teacherCount,
    },
    overLimit: {
      students: studentLimit > 0 ? studentCount > studentLimit : false,
      teachers: teacherLimit > 0 ? teacherCount > teacherLimit : false,
    },
  };
};
