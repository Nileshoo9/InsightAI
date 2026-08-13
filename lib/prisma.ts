import { PrismaClient } from "@prisma/client";
import { getDatabaseUrl } from "@/lib/env";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

let cachedPrisma: PrismaClient | undefined;

export function getPrisma() {
  getDatabaseUrl();

  if (cachedPrisma) return cachedPrisma;

  cachedPrisma =
    global.prisma ||
    new PrismaClient({
      log: ["error"]
    });

  if (process.env.NODE_ENV !== "production") {
    global.prisma = cachedPrisma;
  }

  return cachedPrisma;
}

export const prisma = getPrisma();
