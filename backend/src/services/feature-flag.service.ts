import { prisma } from '../config/db';

export const isFeatureEnabled = async (params: {
  key: string;
  schoolId?: string | null;
  userId?: string | null;
}) => {
  const { key, schoolId, userId } = params;

  const flag = await prisma.featureFlag.findUnique({
    where: { key },
    include: { overrides: true },
  });

  if (!flag) return false;

  const userOverride = flag.overrides.find((override) => override.userId === userId);
  if (userOverride) return userOverride.status === 'ENABLED';

  const schoolOverride = flag.overrides.find((override) => override.schoolId === schoolId);
  if (schoolOverride) return schoolOverride.status === 'ENABLED';

  return flag.status === 'ENABLED';
};

export const getConfigValue = async (params: {
  key: string;
  schoolId?: string | null;
}) => {
  const { key, schoolId } = params;

  const config = await prisma.configEntry.findUnique({ where: { key } });
  if (!config) return null;

  if (schoolId) {
    const override = await prisma.tenantConfigOverride.findUnique({
      where: { configId_schoolId: { configId: config.id, schoolId } },
    });

    if (override) {
      return override.value;
    }
  }

  return config.value;
};
