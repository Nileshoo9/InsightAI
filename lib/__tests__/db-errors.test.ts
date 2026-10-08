import { describe, expect, it } from "vitest";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { getDatabaseUrl } from "@/lib/env";
import { isDatabaseUnavailableError } from "@/lib/db-errors";

describe("database resilience", () => {
  it("treats Prisma connection pool timeouts as transient database errors", () => {
    const error = new PrismaClientKnownRequestError(
      "Timed out fetching a new connection from the connection pool",
      {
        code: "P2024",
        clientVersion: "test",
        meta: {}
      }
    );

    expect(isDatabaseUnavailableError(error)).toBe(true);
  });

  it("adds conservative connection pooling settings to the database URL", () => {
    const original = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgresql://user:pass@host:5432/db";

    try {
      const url = getDatabaseUrl();
      expect(url).toContain("connection_limit=5");
      expect(url).toContain("pool_timeout=15");
    } finally {
      if (original === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = original;
    }
  });
});
