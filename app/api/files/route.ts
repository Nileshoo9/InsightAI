import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/http";
import { requireAuth } from "@/lib/require-auth";

export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth(req);
  if (error || !session) return error || fail("Unauthorized", 401);

  const files = await prisma.file.findMany({
    where: { userId: session.userId },
    orderBy: { uploadedAt: "desc" }
  });

  return ok({ files });
}
