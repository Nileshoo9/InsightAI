import { buildSummary } from "@/lib/services/analytics";
import { generateGenericInsights, generateInsights, parseAnalysisIntent } from "@/lib/services/openai";
import { runDataDiagnostics } from "@/lib/services/diagnostics";
import { GenericProfile, ParsedRecord, AggregatedSummary } from "@/lib/types";
import { createDataProfile } from "@/lib/services/profiler";

type DataRecordRow = {
  date: Date;
  revenue: number;
  product: string;
  category?: string | null;
  [key: string]: unknown;
};
function toParsedRecord(rows: DataRecordRow[]): ParsedRecord[] {
  return rows.map((r) => ({
    ...r,
    date: r.date,
    primaryMetric: r.revenue
  }));
}

function parseLooseNumber(value: unknown): number | null {
  const txt = String(value ?? "").trim();
  if (!txt) return null;

  const cleaned = txt.replace(/[^0-9.-]+/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === "-.") return null;

  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parsePossibleDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  const txt = String(value ?? "").trim();
  if (!txt) return null;

  // Prefer explicit date-like patterns first
  const dateLike = /^(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/;
  if (dateLike.test(txt)) {
    const parsed = new Date(txt);
    if (!Number.isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      if (y >= 1990 && y <= 2100) return parsed;
    }
  }

  // Excel serial date support with sane bounds
  const asNumber = Number(txt);
  if (Number.isFinite(asNumber) && asNumber >= 25569 && asNumber <= 90000) {
    const d = new Date(Math.round((asNumber - 25569) * 86400 * 1000));
    const y = d.getUTCFullYear();
    if (y >= 1990 && y <= 2100) return d;
  }

  return null;
}

export async function analyzeFromRecords(rows: DataRecordRow[], prompt?: string) {
  let parsed = toParsedRecord(rows);
  
  // Extract dynamic metadata for intent parsing
  const categories = Array.from(new Set(parsed.map(p => p.category).filter(Boolean))) as string[];
  const items = Array.from(new Set(parsed.map(p => p.product).filter(Boolean))).slice(0, 50);
  
  if (prompt?.trim()) {
    const intent = await parseAnalysisIntent(prompt, { categories, products: items });

    if (intent.isFiltered) {
      if (intent.categories?.length) {
        parsed = parsed.filter(p => p.category && intent.categories!.includes(p.category));
      }
      if (intent.products?.length) {
        parsed = parsed.filter(p => intent.products!.includes(p.product));
      }
      if (intent.searchQuery) {
        const q = intent.searchQuery.toLowerCase();
        parsed = parsed.filter(p => 
          Object.values(p).some(v => String(v).toLowerCase().includes(q))
        );
      }
    }
  }

  const summary = await buildSummary(parsed);
  const insights = await generateInsights(summary, prompt);
  return { summary, insights, profile: null };
}

export async function analyzeFromRawRows(rows: Record<string, unknown>[], prompt?: string) {
  if (!rows.length) return { summary: null, insights: null, profile: createDataProfile([]) };
  
  const profile = createDataProfile(rows);
  const insights = await generateGenericInsights(rows, profile, prompt);
  const diagnostics = runDataDiagnostics(rows);
  
  const summary: AggregatedSummary = {
    totalRecords: rows.length,
    uniqueValues: {},
    topEntries: (profile.categoricalBreakdown || []).map(c => ({ column: c.column, items: c.items })),
    trends: profile.timeSeries || [],
    anomalies: diagnostics.anomalies.map((reason, index) => ({
      label: `Data quality alert ${index + 1}`,
      value: 0,
      reason
    })),
    domainInfo: {
      name: (insights as any).domainName || "Generic Dataset",
      description: `Automated analysis with ${diagnostics.score}% data health score.`,
      dataQualityScore: diagnostics.score,
      suggestedKPIs: (profile.numericSummary || []).map(n => n.column)
    }
  };

  return { summary, insights, profile };
}
