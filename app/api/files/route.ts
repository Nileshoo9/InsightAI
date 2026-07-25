import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/http";
import { requireAuth } from "@/lib/require-auth";
import { isDatabaseUnavailableError } from "@/lib/db-errors";

export async function GET(req: NextRequest) {
  try {
    const { session, error } = await requireAuth(req);
    if (error || !session) return error || fail("Unauthorized", 401);

    const files = await prisma.file.findMany({
      where: { userId: session.userId },
      orderBy: { uploadedAt: "desc" }
    });

    return ok({ files });
  } catch (err) {
    if (isDatabaseUnavailableError(err)) {
      return fail("Database is temporarily unavailable. Please try again shortly.", 503);
    }
    return fail("Failed to fetch files", 500);
  }
}
