import { DataRecord } from "@prisma/client";
import { buildSummary } from "@/lib/services/analytics";
import { generateGenericInsights, generateInsights, parseAnalysisIntent } from "@/lib/services/openai";
import { runDataDiagnostics } from "@/lib/services/diagnostics";
import { GenericProfile, ParsedRecord, AggregatedSummary } from "@/lib/types";

function toParsedRecord(rows: DataRecord[]): ParsedRecord[] {
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

export async function analyzeFromRecords(rows: DataRecord[], prompt?: string) {
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

function createGenericProfile(rows: Record<string, unknown>[]): GenericProfile {
  const columns = rows.length ? Object.keys(rows[0]) : [];
  const rowCount = rows.length;
  
  const valueMap = new Map<string, Map<string, number>>();
  const numericMap = new Map<string, { count: number; sum: number; min: number; max: number; values: number[] }>();

  for (const col of columns) {
    valueMap.set(col, new Map());
  }

  for (const row of rows) {
    for (const col of columns) {
      const raw = row[col];
      const txt = String(raw ?? "").trim();
      if (!txt || txt.toLowerCase() === "null" || txt.toLowerCase() === "undefined") continue;

      const bucket = valueMap.get(col)!;
      bucket.set(txt, (bucket.get(txt) || 0) + 1);

      const n = parseLooseNumber(txt);
      if (n !== null && !/^\d{4}-\d{2}-\d{2}$/.test(txt)) {
        const prev = numericMap.get(col) || {
          count: 0,
          sum: 0,
          min: Number.POSITIVE_INFINITY,
          max: Number.NEGATIVE_INFINITY,
          values: []
        };
        prev.count += 1;
        prev.sum += n;
        prev.min = Math.min(prev.min, n);
        prev.max = Math.max(prev.max, n);
        if (prev.values.length < 100) prev.values.push(n); // Sample for variance
        numericMap.set(col, prev);
      }
    }
  }

  // Filter numeric columns: remove things that look like IDs (all unique) or have 0 variance
  const validNumericCols = [...numericMap.entries()].filter(([col, v]) => {
    const uniqCount = valueMap.get(col)?.size || 0;
    const numericCoverage = rowCount > 0 ? v.count / rowCount : 0;
    const isId = uniqCount === rowCount && v.max - v.min + 1 === rowCount;
    const hasVariance = v.max !== v.min;
    const isProbablyYear = v.min > 1900 && v.max < 2100 && v.count === rowCount;
    return hasVariance && !isId && !isProbablyYear && numericCoverage >= 0.35;
  });

  const categoricalBreakdown = columns
    .map((col) => ({ col, uniq: valueMap.get(col)?.size || 0 }))
    .filter((x) => x.uniq >= 2 && x.uniq <= Math.max(50, Math.ceil(rowCount * 0.7)))
    .sort((a, b) => a.uniq - b.uniq)
    .slice(0, 8)
    .map((x) => ({
      column: x.col,
      items: [...(valueMap.get(x.col)?.entries() || [])]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([name, value]) => ({ 
          name, 
          value,
          pct: rowCount > 0 ? (value / rowCount) * 100 : 0
        }))
    }));

  const numericSummary = validNumericCols
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8)
    .map(([column, v]) => ({
      column,
      avg: v.sum / v.count,
      min: v.min,
      max: v.max,
      count: v.count,
      volatility: v.max - v.min // Basic range signal
    }));

  // Potential Primary Driver (Highest categorical concentrator for a numeric metric)
  const topDriver = categoricalBreakdown[0] && numericSummary[0] ? {
     dimension: categoricalBreakdown[0].column,
     metric: numericSummary[0].column,
     topSegment: categoricalBreakdown[0].items[0].name,
     concentration: categoricalBreakdown[0].items[0].pct
  } : null;

  // Improved Date Detection
  const dateCandidates = columns
    .map((col) => {
      const sample = rows.slice(0, Math.min(120, rowCount)).map((r) => r[col]);
      const validDates = sample.filter((v) => parsePossibleDate(v) !== null).length;
      const ratio = sample.length ? validDates / sample.length : 0;
      const lname = col.toLowerCase();
      const hasDateHint = /(date|time|month|year|day|created|updated|period)/.test(lname);
      const score = ratio + (hasDateHint ? 0.25 : 0);
      return { col, ratio, score, validDates };
    })
    .filter((x) => x.validDates >= 8 && x.ratio >= 0.5)
    .sort((a, b) => b.score - a.score);
  
  const metric = numericSummary[0]?.column;
  const dateColumn = dateCandidates[0]?.col;

  let timeSeries: GenericProfile["timeSeries"] = [];
  if (metric && dateColumn) {
    const periodMap = new Map<string, number>();
    for (const row of rows) {
      const d = parsePossibleDate(row[dateColumn]);
      const v = parseLooseNumber(row[metric]);
      if (!d || v === null) continue;
      
      const key = d.toISOString().slice(0, 10);
      periodMap.set(key, (periodMap.get(key) || 0) + v);
    }
    
    timeSeries = [...periodMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-60)
      .map(([label, value]) => ({ label, value, metric, dateColumn }));
  }

  return {
    rowCount,
    columnCount: columns.length,
    columns: columns.slice(0, 30),
    categoricalBreakdown,
    numericSummary,
    timeSeries,
    // Add internal metadata for AI
    metadata: {
       topDriver,
       isTemporal: timeSeries.length > 5,
       sampleSize: rowCount
    }
  } as any;
}


export async function analyzeFromRawRows(rows: Record<string, unknown>[], prompt?: string) {
  if (!rows.length) return { summary: null, insights: null, profile: createGenericProfile([]) };
  
  const profile = createGenericProfile(rows);
  const insights = await generateGenericInsights(rows, profile, prompt);
  const diagnostics = runDataDiagnostics(rows);
  
  const summary: AggregatedSummary = {
    totalRecords: rows.length,
    uniqueValues: {},
    topEntries: profile.categoricalBreakdown.map(c => ({ column: c.column, items: c.items })),
    trends: profile.timeSeries,
    anomalies: diagnostics.anomalies.map((reason, index) => ({
      label: `Data quality alert ${index + 1}`,
      value: 0,
      reason
    })),
    domainInfo: {
      name: (insights as any).domainName || "Generic Dataset",
      description: `Automated analysis with ${diagnostics.score}% data health score.`,
      suggestedKPIs: profile.numericSummary.map(n => n.column)
    }
  };

  return { summary, insights, profile };
}
