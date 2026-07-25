import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/http";
import { analyzeSchema } from "@/lib/validation";
import { getSessionFromRequest } from "@/lib/auth";
import { buildSummary } from "@/lib/services/analytics";
import { generateInsights } from "@/lib/services/openai";
import { analyzeFromRawRows, analyzeFromRecords } from "@/lib/services/insights";
import { mapRowsToRecords } from "@/lib/services/parser";
import { isDatabaseUnavailableError } from "@/lib/db-errors";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = analyzeSchema.safeParse(body);
    if (!parsed.success) return fail("Invalid analyze payload", 400);

    const session = await getSessionFromRequest(req);
    const { fileId, data, prompt } = parsed.data;

    if (!fileId && !data?.length) {
      return fail("Provide either fileId or data array", 400);
    }

    if (fileId) {
      if (!session) return fail("Unauthorized for file-based analyze", 401);
      const file = await prisma.file.findFirst({
        where: { id: fileId, userId: session.userId },
        select: { id: true, rawPreview: true, rawRowCount: true }
      });
      if (!file) return fail("File not found", 404);

      const rows = await prisma.dataRecord.findMany({ where: { fileId: file.id } });
      const result =
        rows.length > 0
          ? await analyzeFromRecords(rows, prompt)
          : Array.isArray(file.rawPreview) && file.rawPreview.length > 0
            ? await analyzeFromRawRows(file.rawPreview as Record<string, unknown>[], prompt)
            : null;
      if (!result) return fail("No records found for file", 404);

      const { summary, insights, profile } = result;
      const saved = await prisma.insight.create({
        data: {
          userId: session.userId,
          fileId: file.id,
          insightsText: JSON.stringify(insights, null, 2),
          insightsJson: JSON.stringify({
            summary,
            insights,
            profile,
            metadata: { 
              rawRowCount: file.rawRowCount,
              goal: prompt
            }
          })
        }
      });

      return ok({
        insightId: saved.id,
        fileId: file.id,
        summary,
        insights,
        profile
      });
    }

    const rawRows = (data || []) as Record<string, unknown>[];
    const parsedRecords = mapRowsToRecords(rawRows);
    if (parsedRecords.length) {
      const summary = await buildSummary(parsedRecords);
      const insights = await generateInsights(summary, prompt);
      return ok({ summary, insights, profile: null });
    }

    const { summary, insights, profile } = await analyzeFromRawRows(rawRows, prompt);
    return ok({ summary, insights, profile });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return fail("Database is temporarily unavailable. Please try again shortly.", 503);
    }
    return fail("Analyze failed", 500);
  }
}
