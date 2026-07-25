import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/http";
import { requireAuth } from "@/lib/require-auth";
import { isDatabaseUnavailableError } from "@/lib/db-errors";

export async function GET(req: NextRequest) {
  try {
    const { session, error } = await requireAuth(req);
    if (error || !session) return error || fail("Unauthorized", 401);

    const insights = await prisma.insight.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fileId: true,
        createdAt: true,
        file: {
          select: { fileName: true }
        }
      }
    });

    return ok({ insights });
  } catch (err) {
    if (isDatabaseUnavailableError(err)) {
      return fail("Database is temporarily unavailable. Please try again shortly.", 503);
    }
    return fail("Failed to fetch insights", 500);
  }
}
