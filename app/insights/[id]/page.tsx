import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { InsightView } from "@/components/insight-view";
import { prisma } from "@/lib/prisma";

async function getInsight(userId: string, id: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) return null;

  const insight = await prisma.insight.findFirst({
    where: {
      id,
      userId
    },
    include: {
      file: true
    }
  });
  if (!insight) return null;

  type InsightData = {
    summary?: {
      totalRevenue: number;
      totalQuantity: number;
      uniqueCustomers: number;
      weeklyGrowth: number;
      monthlyTrend: { month: string; revenue: number }[];
    };
    insights?: {
      keyInsights: string[];
      recommendations: string[];
      alerts: string[];
      trends: string[];
      risks: string[];
      opportunities: string[];
    };
    profile?: {
      rowCount: number;
      columnCount: number;
      columns: string[];
      categoricalBreakdown: {
        column: string;
        items: { name: string; value: number }[];
      }[];
      numericSummary: {
        column: string;
        avg: number;
        min: number;
        max: number;
        count: number;
      }[];
      timeSeries: {
        label: string;
        value: number;
        metric: string;
        dateColumn: string;
      }[];
    };
  } | null;

  let parsedJson: InsightData = null;
  if (insight.insightsJson) {
    try {
      parsedJson = JSON.parse(insight.insightsJson) as InsightData;
    } catch {
      parsedJson = null;
    }
  }

  return {
    id: insight.id,
    fileId: insight.fileId,
    fileName: insight.file.fileName,
    createdAt: insight.createdAt.toISOString(),
    insightsText: insight.insightsText,
    insightData: parsedJson
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

  return <InsightView insight={data} />;
}
