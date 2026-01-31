import { prisma } from '../config/db';
import { HttpError } from '../middlewares/error.middleware';

export const getSubscription = async (schoolId: string) => {
  return prisma.subscription.findUnique({ where: { schoolId } });
};

export const upsertSubscription = async (params: {
  schoolId: string;
  planName: string;
  status: string;
  startsAt: Date;
  endsAt?: Date | null;
  studentLimit: number;
  teacherLimit: number;
}) => {
  return prisma.subscription.upsert({
    where: { schoolId: params.schoolId },
    update: {
      planName: params.planName,
      status: params.status,
      startsAt: params.startsAt,
      endsAt: params.endsAt ?? null,
      studentLimit: params.studentLimit,
      teacherLimit: params.teacherLimit,
    },
    create: {
      schoolId: params.schoolId,
      planName: params.planName,
      status: params.status,
      startsAt: params.startsAt,
      endsAt: params.endsAt ?? null,
      studentLimit: params.studentLimit,
      teacherLimit: params.teacherLimit,
    },
  });
};

export const incrementUsage = async (schoolId: string, type: 'students' | 'teachers', delta = 1) => {
  return prisma.usageCounter.upsert({
    where: { schoolId },
    update: { [type]: { increment: delta } },
    create: { schoolId, students: type === 'students' ? delta : 0, teachers: type === 'teachers' ? delta : 0 },
  });
};

export const enforceLimits = async (schoolId: string, type: 'students' | 'teachers') => {
  const subscription = await prisma.subscription.findUnique({ where: { schoolId } });
  if (!subscription || subscription.status !== 'ACTIVE') {
    throw new HttpError(403, 'Subscription inactive');
  }

  const usage = await prisma.usageCounter.findUnique({ where: { schoolId } });
  const count = usage ? usage[type] : 0;
  const limit = type === 'students' ? subscription.studentLimit : subscription.teacherLimit;

  if (count >= limit) {
    throw new HttpError(403, `${type} limit exceeded`);
  }
};
