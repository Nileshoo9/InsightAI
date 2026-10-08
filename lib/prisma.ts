import { PrismaClient } from "@prisma/client";
import { validateServerEnvironment } from "@/lib/env";

validateServerEnvironment();

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}
