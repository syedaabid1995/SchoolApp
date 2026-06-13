import { PrismaClient, Prisma } from '@prisma/client';
import { env } from './env';
import { registerPrismaObservability } from '../services/observability/prisma-observability.service';

const logLevels: Prisma.LogLevel[] =
  env.NODE_ENV === 'development'
    ? ['query', 'info', 'warn', 'error']
    : ['warn', 'error'];

export const prisma = new PrismaClient({
  log: logLevels,
});

registerPrismaObservability(prisma);
