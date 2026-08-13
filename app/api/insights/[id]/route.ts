import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/http";
import { requireAuth } from "@/lib/require-auth";
import { isDatabaseUnavailableError } from "@/lib/db-errors";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireAuth(req);
    if (error || !session) return error || fail("Unauthorized", 401);
    const { id } = await params;
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) return fail("Invalid insight id", 400);

    const insight = await prisma.insight.findFirst({
      where: {
        id,
        userId: session.userId
      },
      include: {
        file: true
      }
    });
    if (!insight) return fail("Insight not found", 404);

    let parsedJson: unknown = null;
    if (insight.insightsJson) {
      try {
        parsedJson = JSON.parse(insight.insightsJson);
      } catch {
        parsedJson = null;
      }
    }

    return ok({
      id: insight.id,
      fileId: insight.fileId,
      fileName: insight.file.fileName,
      createdAt: insight.createdAt,
      insightsText: insight.insightsText,
      insightData: parsedJson
    });
  } catch (err) {
    if (isDatabaseUnavailableError(err)) {
      return fail("Database is temporarily unavailable. Please try again shortly.", 503);
    }
    return fail("Failed to fetch insight report", 500);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireAuth(req);
    if (error || !session) return error || fail("Unauthorized", 401);
    const { id } = await params;
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) return fail("Invalid insight id", 400);

    const insight = await prisma.insight.findFirst({
      where: { id, userId: session.userId }
    });
    if (!insight) return fail("Insight not found", 404);

    await prisma.insight.delete({ where: { id } });
    return ok({ success: true });
  } catch (err) {
    if (isDatabaseUnavailableError(err)) {
      return fail("Database is temporarily unavailable. Please try again shortly.", 503);
    }
    return fail("Failed to delete insight report", 500);
  }
}
