import { createDataProfile, type DataProfile } from "@/lib/services/profiler";

export type ComputedKpi = { name: string; value: number; unit?: string; formula: string; description: string };
export type ChartRecommendation = { chartType: string; title: string; xColumn?: string; yColumn?: string; configJson: Record<string, unknown> };

function number(value: unknown): number | null { const n = typeof value === "number" ? value : Number(String(value ?? "").replace(/,/g, "")); return Number.isFinite(n) ? n : null; }
function pearson(a: number[], b: number[]) { const ma = a.reduce((x, y) => x + y, 0) / a.length; const mb = b.reduce((x, y) => x + y, 0) / b.length; const top = a.reduce((s, x, i) => s + (x - ma) * (b[i] - mb), 0); const bottom = Math.sqrt(a.reduce((s, x) => s + (x - ma) ** 2, 0) * b.reduce((s, y) => s + (y - mb) ** 2, 0)); return bottom ? top / bottom : 0; }

export function computeAnalysis(rows: Record<string, unknown>[], profile: DataProfile = createDataProfile(rows)) {
  const numeric = profile.columns.filter((column) => column.dataType === "numeric" && column.semanticType !== "id");
  const categorical = profile.columns.filter((column) => column.dataType === "categorical");
  const dates = profile.columns.filter((column) => column.dataType === "date");
  const kpis: ComputedKpi[] = [{ name: "Row Count", value: rows.length, formula: "count(rows)", description: "Usable records after cleaning." }];
  for (const column of numeric.slice(0, 4)) {
    const values = rows.map((row) => number(row[column.name])).filter((value): value is number => value !== null);
    kpis.push({ name: `Total ${column.displayName || column.name}`, value: values.reduce((a, b) => a + b, 0), formula: `sum(${column.name})`, description: "Deterministically calculated numeric total." });
    if (column.mean !== null && column.mean !== undefined) kpis.push({ name: `Average ${column.displayName || column.name}`, value: column.mean, formula: `mean(${column.name})`, description: "Arithmetic mean of non-missing values." });
  }
  const charts: ChartRecommendation[] = [];
  if (dates[0] && numeric[0]) charts.push({ chartType: "line", title: `${numeric[0].name} over time`, xColumn: dates[0].name, yColumn: numeric[0].name, configJson: { type: "line", aggregation: "sum" } });
  if (categorical[0] && numeric[0]) charts.push({ chartType: "bar", title: `${numeric[0].name} by ${categorical[0].name}`, xColumn: categorical[0].name, yColumn: numeric[0].name, configJson: { type: "bar", aggregation: "sum" } });
  if (numeric[0]) charts.push({ chartType: "histogram", title: `${numeric[0].name} distribution`, xColumn: numeric[0].name, configJson: { type: "histogram" } });
  if (categorical[0] && !numeric[0]) charts.push({ chartType: "pie", title: `${categorical[0].name} distribution`, xColumn: categorical[0].name, configJson: { type: "pie", aggregation: "count" } });
  const correlations = [] as { x: string; y: string; correlation: number }[];
  for (let i = 0; i < numeric.length; i++) for (let j = i + 1; j < numeric.length; j++) {
    const pairs = rows.map((row) => [number(row[numeric[i].name]), number(row[numeric[j].name])] as const).filter((pair): pair is [number, number] => pair[0] !== null && pair[1] !== null);
    if (pairs.length >= 3) correlations.push({ x: numeric[i].name, y: numeric[j].name, correlation: Number(pearson(pairs.map((pair) => pair[0]), pairs.map((pair) => pair[1])).toFixed(3)) });
  }
  if (correlations.length) charts.push({ chartType: "heatmap", title: "Numeric correlations", configJson: { type: "heatmap", correlations } });
  return { kpis, charts, correlations };
}
