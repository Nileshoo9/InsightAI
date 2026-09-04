import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/http";
import { analyzeSchema } from "@/lib/validation";
import { getSessionFromRequest } from "@/lib/auth";
import { analyzeFromRawRows } from "@/lib/services/insights";
import { buildIndustryReport } from "@/lib/services/report-engine";
import { isDatabaseUnavailableError } from "@/lib/db-errors";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = analyzeSchema.safeParse(body);
    if (!parsed.success) return fail("Invalid analyze payload", 400);

    const session = await getSessionFromRequest(req);
    const { fileId, data, prompt } = parsed.data;

    if (!fileId && !data?.length) return fail("Provide either fileId or data array", 400);

    if (fileId) {
      if (!session) return fail("Unauthorized for file-based analyze", 401);
      const file = await prisma.file.findFirst({
        where: { id: fileId, userId: session.userId },
        select: { id: true, rawPreview: true, rawRowCount: true }
      });
      if (!file) return fail("File not found", 404);

      // IMPORTANT: never force arbitrary datasets through the sales-only DataRecord schema.
      // rawPreview preserves the original columns and lets the profiler/domain engine decide
      // whether the dataset is healthcare, education, finance, sales, IoT, etc.
      const rawRows = Array.isArray(file.rawPreview)
        ? (file.rawPreview as Record<string, unknown>[])
        : [];
      if (!rawRows.length) return fail("No source rows found for file", 404);

      const { summary, insights, profile } = await analyzeFromRawRows(rawRows, prompt);
      const report = profile ? buildIndustryReport(rawRows, profile as any) : null;

      const saved = await prisma.insight.create({
        data: {
          userId: session.userId,
          fileId: file.id,
          insightsText: JSON.stringify(insights, null, 2),
          insightsJson: JSON.stringify({
            summary,
            insights,
            profile,
            report,
            metadata: {
              rawRowCount: file.rawRowCount,
              goal: prompt,
              analysisVersion: "industry-v1"
            }
          })
        }
      });

      return ok({ insightId: saved.id, fileId: file.id, summary, insights, profile, report });
    }

    const rawRows = (data || []) as Record<string, unknown>[];
    const { summary, insights, profile } = await analyzeFromRawRows(rawRows, prompt);
    const report = profile ? buildIndustryReport(rawRows, profile as any) : null;
    return ok({ summary, insights, profile, report });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return fail("Database is temporarily unavailable. Please try again shortly.", 503);
    }
    console.error("Analyze failed", error);
    return fail("Analyze failed", 500);
  }
}
