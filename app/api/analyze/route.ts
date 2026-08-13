import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { analyzeSchema } from "@/lib/validation";
import { getSessionFromRequest } from "@/lib/auth";
import { analyzeFromRawRows } from "@/lib/services/insights";
import { cleanDataset } from "@/lib/services/cleaning";
import { computeAnalysis } from "@/lib/services/analysis-engine";
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

      const rawPreview = Array.isArray(file.rawPreview) ? (file.rawPreview as Record<string, unknown>[]) : [];
      const cleaned = cleanDataset(rawPreview);
      const result = cleaned.rows.length ? await analyzeFromRawRows(cleaned.rows, prompt) : null;

      if (!result) return fail("No records found for file", 404);

      const { summary, insights, profile } = result;
      const computed = computeAnalysis(cleaned.rows, profile);

      // Optionally, associate this analysis with a DatasetVersion if available
      const datasetFile = await prisma.datasetFile.findFirst({ where: { fileId: file.id }, select: { datasetId: true } });
      let analysisRunId: string | undefined;
      if (datasetFile) {
        const version = await prisma.datasetVersion.findFirst({ where: { datasetId: datasetFile.datasetId }, orderBy: { createdAt: 'desc' }, select: { id: true } });
        if (version) {
          const ar = await prisma.analysisRun.create({
            data: {
              datasetVersionId: version.id,
              objective: prompt || "auto",
              status: "completed",
              startedAt: new Date(),
              completedAt: new Date()
            }
          });
          analysisRunId = ar.id;

          await prisma.cleaningAction.createMany({ data: cleaned.actions.map((action) => ({
            datasetVersionId: version.id, analysisRunId: ar.id, columnName: action.columnName, operation: action.operation,
            beforeCount: action.beforeCount, afterCount: action.afterCount, details: action.details as Prisma.InputJsonValue
          })) });
          await prisma.kPI.createMany({ data: computed.kpis.map((kpi) => ({ analysisRunId: ar.id, name: kpi.name, value: String(kpi.value), unit: kpi.unit, formula: kpi.formula, description: kpi.description })) });
          await prisma.chart.createMany({ data: computed.charts.map((chart) => ({ analysisRunId: ar.id, chartType: chart.chartType, title: chart.title, xColumn: chart.xColumn, yColumn: chart.yColumn, configJson: chart.configJson as Prisma.InputJsonValue })) });

          // Persist column profiles into the DatasetVersion.columns table for later UI use
          try {
            if (profile && (profile as any).columns && Array.isArray((profile as any).columns) && (profile as any).columns.length) {
              const cols = (profile as any).columns.map((c: any) => ({
                datasetVersionId: version.id,
                name: c.name,
                displayName: c.displayName || c.name,
                dataType: c.dataType || undefined,
                semanticType: c.semanticType || undefined,
                nullable: (c.missingCount || 0) > 0,
                uniqueCount: c.uniqueCount || 0,
                missingCount: c.missingCount || 0,
                minValue: c.min !== null && c.min !== undefined ? String(c.min) : undefined,
                maxValue: c.max !== null && c.max !== undefined ? String(c.max) : undefined,
                meanValue: c.mean ?? undefined,
                // `medianValue` is a Float in Prisma. Text/categorical medians belong
                // in the profile JSON, not this numeric summary column.
                medianValue: typeof c.median === "number" && Number.isFinite(c.median) ? c.median : null
              }));

              // createMany ignores undefined fields for some drivers; ensure we limit to sane batch sizes
              await prisma.column.createMany({ data: cols.slice(0, 500) });
            }
          } catch (err) {
            console.warn("Failed to persist column profiles:", err);
          }
        }
      }

      const saved = await prisma.insight.create({
        data: {
          userId: session.userId,
          fileId: file.id,
          analysisRunId: analysisRunId,
          type: "analysis",
          title: "Automated analysis",
          description: JSON.stringify({ summary, insights }, null, 2),
          insightsText: insights?.executiveSummary || "Automated dataset analysis completed.",
          insightsJson: { summary, insights, profile, quality: { actions: cleaned.actions, score: summary?.domainInfo.dataQualityScore }, kpis: computed.kpis, charts: computed.charts, correlations: computed.correlations } as Prisma.InputJsonValue,
          evidenceJson: profile || { metadata: { rawRowCount: file.rawRowCount, goal: prompt } }
        }
      });

      return ok({
        insightId: saved.id,
        fileId: file.id,
        summary,
        insights,
        profile,
        quality: { actions: cleaned.actions, score: summary?.domainInfo.dataQualityScore },
        kpis: computed.kpis,
        charts: computed.charts,
        correlations: computed.correlations
      });
    }

    const rawRows = (data || []) as Record<string, unknown>[];
    const cleaned = cleanDataset(rawRows);
    const { summary, insights, profile } = await analyzeFromRawRows(cleaned.rows, prompt);
    const computed = computeAnalysis(cleaned.rows, profile);
    return ok({ summary, insights, profile, quality: { actions: cleaned.actions, score: summary?.domainInfo.dataQualityScore }, ...computed });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return fail("Database is temporarily unavailable. Please try again shortly.", 503);
    }
    return fail("Analyze failed", 500);
  }
}
