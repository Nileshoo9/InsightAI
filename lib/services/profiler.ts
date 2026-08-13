// Data Profiler for InsightAI
// Computes per-column statistics and semantic type detection for a dataset.

import { mean as _mean, median as _median, standardDeviation as _std } from "simple-statistics";

export type ColumnProfile = {
  name: string;
  displayName?: string;
  dataType: "numeric" | "categorical" | "date" | "boolean" | "text" | "unknown";
  semanticType?: string | null;
  rowCount: number;
  missingCount: number;
  missingPct: number;
  uniqueCount: number;
  uniquePct: number;
  duplicateCount: number;
  min?: number | string | null;
  max?: number | string | null;
  mean?: number | null;
  median?: number | null;
  stddev?: number | null;
  variance?: number | null;
  q1?: number | null;
  q3?: number | null;
  iqr?: number | null;
  mode?: any;
};

export type CategoricalBreakdownItem = {
  column: string;
  items: { name: string; value: number; pct: number }[];
};

export type NumericSummaryItem = {
  column: string;
  avg: number;
  min: number;
  max: number;
  count: number;
  volatility: number;
};

export type TimeSeriesPoint = { label: string; value: number; metric: string; dateColumn: string };

export type DataProfile = {
  columns: ColumnProfile[];
  rowCount: number;
  columnCount: number;
  sampleSize: number;
  categoricalBreakdown?: CategoricalBreakdownItem[];
  numericSummary?: NumericSummaryItem[];
  timeSeries?: TimeSeriesPoint[];
  metadata?: Record<string, any>;
};

const DEFAULT_MAX_ROWS = 5000; // sample up to 5k rows for heavy computations
const DEFAULT_MAX_COLS = 100;
const TRUNCATE_STRING_LEN = 150;

function isNumericValue(v: any): boolean {
  if (v === null || v === undefined || v === "") return false;
  if (typeof v === "number") return Number.isFinite(v);
  if (typeof v === "string") {
    const n = Number(v.replace(/,/g, ""));
    return !Number.isNaN(n) && Number.isFinite(n);
  }
  return false;
}

function parseNumeric(v: any): number | null {
  if (!isNumericValue(v)) return null;
  if (typeof v === "number") return v as number;
  const n = Number((v as string).replace(/,/g, ""));
  return Number.isNaN(n) ? null : n;
}

function isDateValue(v: any): boolean {
  if (!v) return false;
  if (v instanceof Date && !isNaN(v.getTime())) return true;
  if (typeof v !== "string") return false;
  const s = v.trim();
  // Excel serial dates commonly appear in CSV exports. Keep the range narrow
  // enough to avoid treating IDs as dates.
  const serial = Number(s);
  if (Number.isFinite(serial) && serial >= 25569 && serial <= 90000) return true;
  // Quick ISO / common date regex check
  const isoLike = /^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/;
  const alt = /\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}/;
  if (isoLike.test(s) || alt.test(s)) {
    const t = Date.parse(s);
    return !Number.isNaN(t);
  }
  return false;
}

function detectSemanticType(columnName: string, sampleValues: any[]): string | null {
  const name = columnName.toLowerCase();
  if (/email/.test(name)) return "email";
  if (/phone|mobile|tel/.test(name)) return "phone";
  if (/date|day|month|year|timestamp|time/.test(name)) return "date";
  if (/lat|latitude/.test(name)) return "latitude";
  if (/lon|lng|longitude/.test(name)) return "longitude";
  if (/id$|_id$|^id$/.test(name)) return "id";
  if (/amount|price|revenue|cost|total|sum|amount/.test(name)) return "currency";
  if (/zip|postal/.test(name)) return "postal_code";
  if (/country|city|state|region/.test(name)) return "location";
  if (/name|first_name|last_name/.test(name)) {
    return "name";
  }
  // Inspect sample values heuristically
  for (const v of sampleValues) {
    if (!v) continue;
    if (typeof v === "string") {
      if (/^\S+@\S+\.\S+$/i.test(v)) return "email";
      if (/^\+?[0-9\-\s()]{6,}$/.test(v)) return "phone";
    }
  }
  return null;
}

function truncateStringValue(v: any): any {
  if (v === null || v === undefined) return v;
  if (typeof v === "string" && v.length > TRUNCATE_STRING_LEN) return v.slice(0, TRUNCATE_STRING_LEN) + "...";
  return v;
}

export function createDataProfile(rows: Record<string, any>[], options?: { maxRows?: number; maxCols?: number }): DataProfile {
  const maxRows = options?.maxRows ?? DEFAULT_MAX_ROWS;
  const maxCols = options?.maxCols ?? DEFAULT_MAX_COLS;

  const rowCount = rows.length;
  const sampleRows = rows.length > maxRows ? rows.slice(0, maxRows) : rows;

  // Determine columns
  const colSet = new Set<string>();
  for (const r of sampleRows) {
    if (typeof r === "object" && r !== null) {
      for (const k of Object.keys(r)) colSet.add(k);
    }
    if (colSet.size >= maxCols) break;
  }
  const columns = Array.from(colSet).slice(0, maxCols);

  const profiles: ColumnProfile[] = [];

  for (const col of columns) {
    const values: any[] = sampleRows.map((r) => (r && Object.prototype.hasOwnProperty.call(r, col) ? r[col] : null));
    const truncated = values.map(truncateStringValue);
    const nonNull = truncated.filter((v) => v !== null && v !== undefined && v !== "");

    const missingCount = values.length - nonNull.length;
    const uniqueSet = new Set(nonNull.map((v) => (typeof v === "object" ? JSON.stringify(v) : String(v))));
    const uniqueCount = uniqueSet.size;
    const duplicateCount = nonNull.length - uniqueCount;

    // Numeric stats
    const numericVals = nonNull.map(parseNumeric).filter((n) => n !== null) as number[];
    const isMostlyNumeric = numericVals.length / Math.max(1, values.length) >= 0.5;

    // Date detection
    const dateLike = nonNull.filter((v) => isDateValue(v));
    const isMostlyDate = dateLike.length / Math.max(1, values.length) >= 0.5;

    let dataType: ColumnProfile['dataType'] = "unknown";
    // Date evidence/hints take precedence over numeric Excel serial values.
    if (isMostlyDate || (/date|time|month|year|day|timestamp/.test(col.toLowerCase()) && isMostlyNumeric)) dataType = "date";
    else if (isMostlyNumeric) dataType = "numeric";
    else if (uniqueCount <= 20 && nonNull.length > 0) dataType = "categorical";
    else if (nonNull.length > 0 && nonNull.every((v) => typeof v === "boolean" || v === true || v === false)) dataType = "boolean";
    else dataType = nonNull.length === 0 ? "unknown" : "text";

    let min: number | string | null = null;
    let max: number | string | null = null;
    let mean: number | null = null;
    let median: number | null = null;
    let stddev: number | null = null;
    let variance: number | null = null;
    let q1: number | null = null;
    let q3: number | null = null;
    let iqr: number | null = null;
    let mode: any = null;

    if (numericVals.length > 0) {
      const sorted = numericVals.slice().sort((a, b) => a - b);
      min = sorted[0];
      max = sorted[sorted.length - 1];
      mean = _mean(sorted);
      median = _median(sorted);
      stddev = _std(sorted);
      variance = stddev !== null ? Math.pow(stddev, 2) : null;
      const mid = Math.floor(sorted.length / 2);
      q1 = _median(sorted.slice(0, mid));
      q3 = _median(sorted.slice(mid));
      iqr = (q3 !== null && q1 !== null) ? (q3 - q1) : null;
      // mode
      const counts = new Map<number, number>();
      for (const n of numericVals) counts.set(n, (counts.get(n) || 0) + 1);
      let best: number | null = null;
      let bestCount = 0;
      for (const [k, v] of counts.entries()) {
        if (v > bestCount) { best = k; bestCount = v; }
      }
      mode = best;
    } else if (nonNull.length > 0) {
      // treat as text: min/max by lexicographic
      const asStrings = nonNull.map((v) => String(v));
      const sorted = asStrings.slice().sort();
      min = sorted[0];
      max = sorted[sorted.length - 1];
      median = asStrings[Math.floor(sorted.length / 2)] as any;
      // mode for text
      const counts = new Map<string, number>();
      for (const s of asStrings) counts.set(s, (counts.get(s) || 0) + 1);
      let best: string | null = null;
      let bestCount = 0;
      for (const [k, v] of counts.entries()) {
        if (v > bestCount) { best = k; bestCount = v; }
      }
      mode = best;
    }

    const semanticType = detectSemanticType(col, nonNull.slice(0, 20));

    profiles.push({
      name: col,
      displayName: col,
      dataType,
      semanticType,
      rowCount: rowCount,
      missingCount,
      missingPct: Math.round((missingCount / Math.max(1, rowCount)) * 10000) / 100,
      uniqueCount,
      uniquePct: Math.round((uniqueCount / Math.max(1, rowCount)) * 10000) / 100,
      duplicateCount,
      min,
      max,
      mean: mean ?? null,
      median: median ?? null,
      stddev: stddev ?? null,
      variance: variance ?? null,
      q1,
      q3,
      iqr,
      mode
    });
  }

  // Build value maps and numeric summaries for the sampled rows (used for categorical and numeric summaries)
  const valueMap = new Map<string, Map<string, number>>();
  const numericMap = new Map<string, { count: number; sum: number; min: number; max: number; values: number[] }>();

  for (const col of columns) valueMap.set(col, new Map());

  for (const row of sampleRows) {
    for (const col of columns) {
      const raw = row?.[col];
      const txt = raw === null || raw === undefined ? "" : String(raw).trim();
      if (!txt || txt.toLowerCase() === "null" || txt.toLowerCase() === "undefined") continue;

      const bucket = valueMap.get(col)!;
      bucket.set(txt, (bucket.get(txt) || 0) + 1);

      const n = parseNumeric(txt);
      if (n !== null && !/^\d{4}-\d{2}-\d{2}$/.test(txt)) {
        const prev = numericMap.get(col) || { count: 0, sum: 0, min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY, values: [] };
        prev.count += 1;
        prev.sum += n;
        prev.min = Math.min(prev.min, n);
        prev.max = Math.max(prev.max, n);
        if (prev.values.length < 200) prev.values.push(n);
        numericMap.set(col, prev);
      }
    }
  }

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
        .map(([name, value]) => ({ name, value, pct: rowCount > 0 ? (value / rowCount) * 100 : 0 }))
    }));

  const validNumericCols = [...numericMap.entries()].filter(([col, v]) => {
    const uniqCount = valueMap.get(col)?.size || 0;
    const numericCoverage = rowCount > 0 ? v.count / rowCount : 0;
    const isId = uniqCount === rowCount && v.max - v.min + 1 === rowCount;
    const hasVariance = v.max !== v.min;
    const isProbablyYear = v.min > 1900 && v.max < 2100 && v.count === rowCount;
    return hasVariance && !isId && !isProbablyYear && numericCoverage >= 0.35;
  });

  const numericSummary = validNumericCols
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8)
    .map(([column, v]) => ({ column, avg: v.sum / v.count, min: v.min, max: v.max, count: v.count, volatility: v.max - v.min }));

  // Detect date candidates
  const dateCandidates = columns
    .map((col) => {
      const sample = sampleRows.slice(0, Math.min(120, rowCount)).map((r) => r[col]);
      const validDates = sample.filter((v) => isDateValue(v)).length;
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

  let timeSeries: TimeSeriesPoint[] = [];
  if (metric && dateColumn) {
    const periodMap = new Map<string, number>();
    for (const row of rows) {
      const raw = row[dateColumn];
      const serial = Number(raw);
      const parsedDate = raw instanceof Date
        ? raw.getTime()
        : Number.isFinite(serial) && serial >= 25569 && serial <= 90000
          ? (serial - 25569) * 86400 * 1000
          : (typeof raw === 'string' ? Date.parse(raw) : NaN);
      if (Number.isNaN(parsedDate)) continue;
      const d = new Date(parsedDate);
      const v = parseNumeric(row[metric]);
      if (!d || v === null) continue;
      const key = d.toISOString().slice(0, 10);
      periodMap.set(key, (periodMap.get(key) || 0) + v);
    }

    timeSeries = [...periodMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-60)
      .map(([label, value]) => ({ label, value, metric: metric!, dateColumn: dateColumn! }));
  }

  const topDriver = categoricalBreakdown[0] && numericSummary[0] ? {
    dimension: categoricalBreakdown[0].column,
    metric: numericSummary[0].column,
    topSegment: categoricalBreakdown[0].items[0].name,
    concentration: categoricalBreakdown[0].items[0].pct
  } : null;

  const profileResult: DataProfile = {
    columns: profiles,
    rowCount,
    columnCount: columns.length,
    sampleSize: sampleRows.length,
    categoricalBreakdown,
    numericSummary,
    timeSeries,
    metadata: {
      topDriver,
      isTemporal: timeSeries.length > 5,
      sampleSize: rowCount
    }
  };

  return profileResult;
}
