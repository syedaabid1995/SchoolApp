import { PrismaClient } from '@prisma/client';
import { env } from './env';

const logLevels: Parameters<typeof PrismaClient>[0]['log'] =
  env.NODE_ENV === 'development'
    ? ['query', 'info', 'warn', 'error']
    : ['warn', 'error'];

export const prisma = new PrismaClient({
  log: logLevels,
});
