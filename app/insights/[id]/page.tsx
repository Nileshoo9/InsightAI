import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createDataProfile } from "@/lib/services/profiler";
import { buildIndustryReport } from "@/lib/services/report-engine";
import { IndustryReport } from "@/components/industry-report";

async function getInsight(userId: string, id: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) return null;

  const insight = await prisma.insight.findFirst({
    where: { id, userId },
    include: { file: true }
  });
  if (!insight) return null;

  let parsedJson: any = null;
  if (insight.insightsJson) {
    try { parsedJson = JSON.parse(insight.insightsJson); } catch { parsedJson = null; }
  }

  const rawRows = Array.isArray(insight.file.rawPreview)
    ? (insight.file.rawPreview as Record<string, unknown>[])
    : [];

  // Reports created before industry-v1 are upgraded on read from the original raw schema.
  const profile = parsedJson?.profile || (rawRows.length ? createDataProfile(rawRows) : null);
  const report = parsedJson?.report || (profile ? buildIndustryReport(rawRows, profile) : null);
  if (!report) return null;

  return {
    id: insight.id,
    fileId: insight.fileId,
    fileName: insight.file.fileName,
    createdAt: insight.createdAt.toISOString(),
    insightsText: insight.insightsText,
    insightData: parsedJson,
    report
  };
}

export default async function InsightDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");

  const { id } = await params;
  const data = await getInsight(session.userId, id);
  if (!data) redirect("/dashboard");

  return <IndustryReport insight={data} report={data.report} />;
}
