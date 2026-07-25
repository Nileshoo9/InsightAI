import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/http";
import { getSessionFromRequest } from "@/lib/auth";
import { generateWithModelFallback, extractJsonObject } from "@/lib/services/openai";

function fallbackAnswer(question: string, dataContext: Record<string, any>): { answer: string; suggestedAction: string } {
  const summary = dataContext?.summary;
  const profile = dataContext?.profile;
  const recordCount = Number(summary?.totalRecords || 0);
  const topTrend = Array.isArray(summary?.trends) ? summary.trends.slice(-1)[0] : null;

  const evidenceParts: string[] = [];
  if (recordCount > 0) evidenceParts.push(`${recordCount.toLocaleString()} records were analyzed`);
  if (topTrend && typeof topTrend === "object") {
    const label = String((topTrend as any).label || "latest period");
    const value = Number((topTrend as any).value || 0);
    evidenceParts.push(`${label} value is ${value.toLocaleString()}`);
  }
  if (!evidenceParts.length && profile?.columnCount) {
    evidenceParts.push(`dataset has ${Number(profile.columnCount).toLocaleString()} columns`);
  }

  const evidence = evidenceParts.length ? evidenceParts.join("; ") : "insufficient structured evidence in stored context";

  return {
    answer: `I could not run an AI query for "${question}" right now, but based on saved context: ${evidence}.`,
    suggestedAction:
      "Retry in a minute or add a paid Gemini quota. Meanwhile, ask a specific metric question like 'top category by revenue in latest period'."
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSessionFromRequest(req);
    if (!session) return fail("Unauthorized", 401);

    const body = await req.json();
    const { question } = body;
    if (!question) return fail("Question is required", 400);

    const insight = await prisma.insight.findFirst({
      where: { id, userId: session.userId },
      include: { file: true }
    });

    if (!insight) return fail("Insight not found", 404);

    // Prepare context: Use InsightJson (summary & profile) + tiny sample of raw data
    const dataContext = JSON.parse(insight.insightsJson || "{}");
    
    // SLIM CONTEXT: Be extremely aggressive to stay under Grq 6k free limit
    const rawSample = Array.isArray(insight.file.rawPreview) 
      ? insight.file.rawPreview.slice(0, 8) // Reduced from 50 to 8
      : "No raw sample available";

    const profile = dataContext.profile || {};
    const slimProfile = {
      rowCount: profile.rowCount,
      columnCount: profile.columnCount,
      columns: profile.columns,
      // Only keep top 5 items for the first 3 categorical columns to save thousands of tokens
      categoricalBreakdown: Array.isArray(profile.categoricalBreakdown) 
        ? profile.categoricalBreakdown.slice(0, 3).map((cb: any) => ({
            column: cb.column,
            items: Array.isArray(cb.items) ? cb.items.slice(0, 5) : []
          }))
        : [],
      numericSummary: Array.isArray(profile.numericSummary) ? profile.numericSummary.slice(0, 10) : []
    };

    const prompt = `
You are a helpful data analyst assistant providing answers to Natural Language Queries (NLQ).
The user asked: "${question}"

Dataset Context (minified for token efficiency):
${JSON.stringify({
  summary: {
    totalRecords: dataContext.summary?.totalRecords,
    primaryMetricTotal: dataContext.summary?.primaryMetricTotal,
    domain: dataContext.summary?.domainInfo?.name,
    trends: dataContext.summary?.trends?.slice(-5) // Only last 5 trends
  },
  profile: slimProfile,
  sample: rawSample
})}

Instructions:
1. Provide a direct, factual answer grounded in the available data.
2. If the data is insufficient, clearly state what is missing.
3. Mention one supporting evidence point.
4. Provide one practical strategic recommendation.
5. Keep answer under 90 words.

Response format: Return ONLY valid JSON.
{
  "answer": "string",
  "suggestedAction": "string"
}
`.trim();

    let text = "";
    try {
      text = await generateWithModelFallback("fast", prompt);
    } catch (err) {
      console.warn("NLQ model fallback activated:", err);
      return ok(fallbackAnswer(question, dataContext));
    }

    const json = extractJsonObject(text);
    if (!json) return ok(fallbackAnswer(question, dataContext));

    const parsed = JSON.parse(json) as { answer?: unknown; suggestedAction?: unknown };

    return ok({
      answer: String(parsed.answer || "I could not derive a confident answer from the current data context.").trim(),
      suggestedAction: String(parsed.suggestedAction || "Narrow the question to a specific metric, date range, or segment.")
    });
  } catch (err) {
    console.error("NLQ Error:", err);
    return fail("Failed to process query", 500);
  }
}
