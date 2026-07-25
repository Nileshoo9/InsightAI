import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/http";
import { requireAuth } from "@/lib/require-auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAuth(req);
  if (error || !session) return error || fail("Unauthorized", 401);
  const { id } = await params;
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) return fail("Invalid file id", 400);

  const file = await prisma.file.findFirst({
    where: { id, userId: session.userId },
    select: {
      id: true,
      fileName: true,
      uploadedAt: true,
      rawPreview: true,
      rawRowCount: true,
      _count: { select: { records: true, insights: true } }
    }
  });

  if (!file) return fail("File not found", 404);

  const preview = Array.isArray(file.rawPreview)
    ? (file.rawPreview as Record<string, unknown>[]).slice(0, 50)
    : [];

  return ok({
    id: file.id,
    fileName: file.fileName,
    uploadedAt: file.uploadedAt,
    rawRowCount: file.rawRowCount,
    recordCount: file._count.records,
    insightCount: file._count.insights,
    preview
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await requireAuth(req);
  if (error || !session) return error || fail("Unauthorized", 401);
  const { id } = await params;
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) return fail("Invalid file id", 400);

  const file = await prisma.file.findFirst({
    where: { id, userId: session.userId }
  });
  if (!file) return fail("File not found", 404);

  /* Cascade delete */
  await prisma.insight.deleteMany({ where: { fileId: id } });
  await prisma.dataRecord.deleteMany({ where: { fileId: id } });
  await prisma.file.delete({ where: { id } });

  return ok({ success: true });
}
