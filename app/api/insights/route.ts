import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/http";
import { requireAuth } from "@/lib/require-auth";

export async function GET(req: NextRequest) {
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
}
