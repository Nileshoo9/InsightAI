import { Prisma } from "@prisma/client";

const TRANSIENT_DB_ERROR_PATTERNS = [
  "database system is not accepting connections",
  "hot standby mode is disabled",
  "the database server was reached but timed out",
  "can't reach database server"
];

export function isDatabaseUnavailableError(error: unknown) {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P1001" || error.code === "P1002";
  }

  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return TRANSIENT_DB_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}
