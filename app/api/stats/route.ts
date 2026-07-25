import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/http";
import { requireAuth } from "@/lib/require-auth";

export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth(req);
  if (error || !session) return error || fail("Unauthorized", 401);

  const [fileCount, insightCount, recordCount, lastFile, lastInsight] =
    await Promise.all([
      prisma.file.count({ where: { userId: session.userId } }),
      prisma.insight.count({ where: { userId: session.userId } }),
      prisma.dataRecord.count({
        where: { file: { userId: session.userId } }
      }),
      prisma.file.findFirst({
        where: { userId: session.userId },
        orderBy: { uploadedAt: "desc" },
        select: { uploadedAt: true }
      }),
      prisma.insight.findFirst({
        where: { userId: session.userId },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true }
      })
    ]);

  return ok({
    fileCount,
    insightCount,
    recordCount,
    lastUpload: lastFile?.uploadedAt || null,
    lastAnalysis: lastInsight?.createdAt || null
  });
}
