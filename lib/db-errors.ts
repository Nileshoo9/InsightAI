import { PrismaClientInitializationError, PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

const TRANSIENT_DB_ERROR_PATTERNS = [
  "database system is not accepting connections",
  "hot standby mode is disabled",
  "the database server was reached but timed out",
  "can't reach database server"
];

export function isDatabaseUnavailableError(error: unknown) {
  if (error instanceof PrismaClientInitializationError) {
    return true;
  }

  if (error instanceof PrismaClientKnownRequestError) {
    return error.code === "P1001" || error.code === "P1002";
  }

  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return TRANSIENT_DB_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}
