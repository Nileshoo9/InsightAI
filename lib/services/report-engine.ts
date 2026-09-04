import { detectIndustryDomain, getDomainLanguage } from "@/lib/services/domain-engine";
import type { DataProfile } from "@/lib/services/profiler";

export type ReportKpi = { label: string; value: number; unit?: string; context?: string };
export type ReportChart = {
  id: string;
  type: "line" | "bar" | "donut" | "histogram" | "scatter";
  title: string;
  description: string;
  xColumn?: string;
  yColumn?: string;
  data: Array<Record<string, unknown>>;
};
export type IndustryReport = {
  version: 1;
  domain: { name: string; confidence: number; objective: string };
  executive: { headline: string; summary: string };
  kpis: ReportKpi[];
  charts: ReportChart[];
  findings: string[];
  risks: string[];
  opportunities: string[];
  recommendations: string[];
  dataQuality: { score: number; missingPct: number; duplicatePct: number; warnings: string[] };
  methodology: { rows: number; columns: number; numericMetrics: string[]; dimensions: string[]; dateColumn?: string };
};

function formatNumber(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function pct(value: number) {
  return `${value.toFixed(1)}%`;
}

function safeNumber(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function buildQuality(profile: DataProfile) {
  const columns = profile.columns || [];
  const missing = columns.length ? columns.reduce((sum, c) => sum + c.missingPct, 0) / columns.length : 0;
  const duplicates = columns.length ? columns.reduce((sum, c) => sum + (c.uniquePct < 100 ? c.duplicateCount / Math.max(1, c.rowCount) * 100 : 0), 0) / columns.length : 0;
  const warnings: string[] = [];
  if (missing > 10) warnings.push(`Average field missingness is ${missing.toFixed(1)}%; validate incomplete columns before decisions.`);
  if (duplicates > 20) warnings.push(`Repeated values are common across dimensions (${duplicates.toFixed(1)}% average duplicate rate).`);
  if (!profile.timeSeries?.length) warnings.push("No reliable time-series relationship was detected; period-over-period analysis is limited.");
  if (!profile.numericSummary?.length) warnings.push("No reliable numeric measure was detected; the report emphasizes distributions and record-level structure.");
  const score = Math.max(0, Math.min(100, 100 - missing * 1.8 - duplicates * 0.35 - warnings.length * 3));
  return { score: Math.round(score), missingPct: Number(missing.toFixed(1)), duplicatePct: Number(duplicates.toFixed(1)), warnings };
}

function buildKpis(profile: DataProfile, domainName: string): ReportKpi[] {
  const kpis: ReportKpi[] = [{ label: "Records", value: profile.rowCount, context: `Rows analyzed in ${domainName}` }];
  for (const metric of (profile.numericSummary || []).slice(0, 3)) {
    kpis.push({ label: `Avg ${metric.column}`, value: metric.avg, context: `Range ${formatNumber(metric.min)}–${formatNumber(metric.max)}` });
  }
  return kpis.slice(0, 4);
}

function buildCharts(profile: DataProfile): ReportChart[] {
  const charts: ReportChart[] = [];
  const series = profile.timeSeries || [];
  if (series.length >= 2) {
    charts.push({
      id: "time-series",
      type: "line",
      title: `${series[0].metric} over time`,
      description: `Aggregated by ${series[0].dateColumn} using the detected primary numeric measure.`,
      xColumn: series[0].dateColumn,
      yColumn: series[0].metric,
      data: series.map((p) => ({ label: p.label, value: p.value }))
    });
  }

  for (const breakdown of (profile.categoricalBreakdown || []).slice(0, 2)) {
    charts.push({
      id: `dimension-${breakdown.column}`,
      type: "bar",
      title: `${breakdown.column} distribution`,
      description: `Top observed values for ${breakdown.column}.`,
      xColumn: breakdown.column,
      data: breakdown.items.slice(0, 10).map((i) => ({ name: i.name, value: i.value, pct: i.pct }))
    });
  }

  const metric = profile.numericSummary?.[0];
  if (metric && Number.isFinite(metric.min) && Number.isFinite(metric.max) && metric.min !== metric.max) {
    charts.push({
      id: "metric-range",
      type: "histogram",
      title: `${metric.column} distribution`,
      description: `Distribution proxy using the profiled minimum, maximum, average and quartiles.`,
      xColumn: metric.column,
      data: [
        { name: "Minimum", value: metric.min },
        { name: "Q1", value: safeNumber(profile.columns.find((c) => c.name === metric.column)?.q1) },
        { name: "Average", value: metric.avg },
        { name: "Q3", value: safeNumber(profile.columns.find((c) => c.name === metric.column)?.q3) },
        { name: "Maximum", value: metric.max }
      ]
    });
  }
  return charts.slice(0, 4);
}

function buildNarrative(profile: DataProfile, domain: ReturnType<typeof detectIndustryDomain>) {
  const language = getDomainLanguage(domain.domain);
  const metric = profile.numericSummary?.[0];
  const dimension = profile.categoricalBreakdown?.[0];
  const series = profile.timeSeries || [];
  let trend = "No sufficiently reliable time series was detected.";
  if (series.length >= 2) {
    const first = series[0].value;
    const last = series[series.length - 1].value;
    const change = first === 0 ? 0 : ((last - first) / Math.abs(first)) * 100;
    trend = `${series[0].metric} moved ${change >= 0 ? "up" : "down"} ${Math.abs(change).toFixed(1)}% from the first to the latest observed period.`;
  }

  const leader = dimension?.items?.[0];
  const findings = [
    `${formatNumber(profile.rowCount)} records were evaluated across ${profile.columnCount} fields, with the report calibrated for ${language.label}.`,
    metric ? `${metric.column} has an average of ${formatNumber(metric.avg)}, ranging from ${formatNumber(metric.min)} to ${formatNumber(metric.max)}; this defines the main quantitative baseline.` : "The dataset does not contain a sufficiently reliable continuous measure for standard KPI aggregation.",
    leader ? `${dimension!.column} is the strongest detected segmentation dimension; ${leader.name} represents ${pct(leader.pct)} of observed records.` : "No high-confidence categorical concentration was detected.",
    trend
  ];

  const risks = [
    ...buildQuality(profile).warnings,
    metric && metric.volatility > Math.abs(metric.avg) * 2 ? `${metric.column} has a wide observed range relative to its mean; investigate outliers and segmentation before forecasting.` : "No extreme volatility warning was triggered by the available summary statistics."
  ].slice(0, 4);

  const opportunities = [
    leader ? `Investigate why ${leader.name} leads ${dimension!.column} and test whether its drivers can be replicated across the next-largest segments.` : "Identify the strongest recurring segments and establish a KPI baseline for them.",
    metric ? `Create threshold monitoring for ${metric.column} and review changes by the most informative categorical dimensions.` : "Introduce a measurable outcome field so future reports can quantify performance and change.",
    series.length >= 2 ? "Use period-over-period comparisons to separate structural movement from isolated spikes." : "Add a reliable date/time field to unlock trend, seasonality and period-over-period analysis."
  ];

  const recommendations = [
    `Adopt ${language.objective.toLowerCase()} as the primary reporting lens rather than applying a generic sales template.`,
    metric ? `Track ${metric.column} with median and percentile context, not only the average, to reduce sensitivity to skew and outliers.` : "Prioritize schema enrichment and define one measurable outcome before operationalizing the dashboard.",
    dimension ? `Segment decisions by ${dimension.column} and compare the top segments against the long tail.` : "Introduce meaningful business dimensions such as department, region, cohort, type or category where applicable."
  ];

  return {
    headline: `${language.label}: ${metric ? `${metric.column} is the primary quantitative signal` : "structure and distribution are the primary signals"}.`,
    summary: `${language.objective}. ${trend}`,
    findings,
    risks,
    opportunities,
    recommendations
  };
}

export function buildIndustryReport(rows: Record<string, unknown>[], profile: DataProfile): IndustryReport {
  const domain = detectIndustryDomain(profile.columns.map((c) => c.name), rows.slice(0, 30));
  const language = getDomainLanguage(domain.domain);
  const quality = buildQuality(profile);
  const narrative = buildNarrative(profile, domain);
  return {
    version: 1,
    domain: { name: language.label, confidence: domain.confidence, objective: language.objective },
    executive: { headline: narrative.headline, summary: narrative.summary },
    kpis: buildKpis(profile, language.label),
    charts: buildCharts(profile),
    findings: narrative.findings,
    risks: narrative.risks,
    opportunities: narrative.opportunities,
    recommendations: narrative.recommendations,
    dataQuality: quality,
    methodology: {
      rows: profile.rowCount,
      columns: profile.columnCount,
      numericMetrics: (profile.numericSummary || []).map((n) => n.column),
      dimensions: (profile.categoricalBreakdown || []).map((c) => c.column),
      dateColumn: profile.timeSeries?.[0]?.dateColumn
    }
  };
}
