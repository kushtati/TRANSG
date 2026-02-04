// server/config/prisma.ts

import { PrismaClient } from '@prisma/client';
import { isDevelopment } from './env.js';

declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma = globalThis.prisma ?? new PrismaClient({
  log: isDevelopment ? ['query', 'error', 'warn'] : ['error'],
});

if (isDevelopment) {
  globalThis.prisma = prisma;
}
