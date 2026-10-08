import { detectIndustryDomain, getDomainLanguage } from "@/lib/services/domain-engine";
import type { DataProfile, Correlation } from "@/lib/services/profiler";

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
export type ReportFinding = { title: string; description: string; evidence: string; importance: "high" | "medium" | "low" };
export type IndustryReport = {
  version: 1;
  domain: { name: string; confidence: number; objective: string; matchedSignals: string[] };
  executive: { headline: string; summary: string };
  kpis: ReportKpi[];
  charts: ReportChart[];
  findings: ReportFinding[];
  risks: ReportFinding[];
  opportunities: ReportFinding[];
  recommendations: string[];
  dataQuality: { score: number; missingPct: number; duplicatePct: number; warnings: string[] };
  methodology: { rows: number; columns: number; numericMetrics: string[]; dimensions: string[]; dateColumn?: string; correlations: Correlation[]; thresholds: string[] };
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

function metric(profile: DataProfile, patterns: RegExp[]) {
  return profile.numericSummary?.find((item) => patterns.some((pattern) => pattern.test(item.column.toLowerCase())));
}

function hasColumn(profile: DataProfile, patterns: RegExp[]) {
  return profile.columns.some((column) => patterns.some((pattern) => pattern.test(column.name.toLowerCase())));
}

function humanize(column: string) {
  return column.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function educationScoreMetrics(profile: DataProfile) {
  return (profile.numericSummary || []).filter((item) => /score|mark|grade|gpa|math|mathematics|biology|physics|chemistry|english/.test(item.column.toLowerCase()));
}

function averageForGroup(rows: Record<string, unknown>[], groupColumn: string, metricColumn: string) {
  const groups = new Map<string, { sum: number; count: number }>();
  for (const row of rows) {
    const group = String(row[groupColumn] ?? "").trim();
    const value = Number(row[metricColumn]);
    if (!group || !Number.isFinite(value)) continue;
    const current = groups.get(group) || { sum: 0, count: 0 };
    current.sum += value;
    current.count += 1;
    groups.set(group, current);
  }
  return [...groups.entries()].map(([name, values]) => ({ name, value: Number((values.sum / values.count).toFixed(2)), count: values.count })).sort((a, b) => b.value - a.value);
}

function educationRiskCount(rows: Record<string, unknown>[], scoreColumns: string[], absenceColumn?: string) {
  if (!scoreColumns.length) return undefined;
  const scores = rows.map((row) => scoreColumns.map((column) => Number(row[column])).filter(Number.isFinite)).filter((values) => values.length);
  const overall = scores.flat();
  if (!overall.length) return undefined;
  const sorted = overall.slice().sort((a, b) => a - b);
  const lowThreshold = sorted[Math.floor(sorted.length * 0.25)];
  const absenceValues = absenceColumn ? rows.map((row) => Number(row[absenceColumn])).filter(Number.isFinite).sort((a, b) => a - b) : [];
  const highAbsence = absenceValues.length ? absenceValues[Math.floor(absenceValues.length * 0.75)] : undefined;
  let count = 0;
  for (const row of rows) {
    const rowScores = scoreColumns.map((column) => Number(row[column])).filter(Number.isFinite);
    const lowScore = rowScores.length > 0 && rowScores.reduce((sum, value) => sum + value, 0) / rowScores.length <= lowThreshold;
    const highAbsences = highAbsence !== undefined && Number(row[absenceColumn as string]) >= highAbsence;
    if (lowScore && highAbsences) count += 1;
  }
  return { count, lowThreshold, highAbsence };
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

function buildKpis(rows: Record<string, unknown>[], profile: DataProfile, domainName: string): ReportKpi[] {
  const kpis: ReportKpi[] = [];
  const add = (label: string, value: number | undefined, context: string) => {
    if (value !== undefined && Number.isFinite(value)) kpis.push({ label, value, context });
  };
  const average = (label: string, patterns: RegExp[]) => {
    const found = metric(profile, patterns);
    if (found) add(label, found.avg, `Average ${found.column}; range ${formatNumber(found.min)}–${formatNumber(found.max)}`);
  };

  if (domainName.includes("Education")) {
    add("Total Students", hasColumn(profile, [/student/]) ? profile.rowCount : undefined, "Rows representing student records");
    const scoreMetrics = educationScoreMetrics(profile);
    for (const score of scoreMetrics.slice(0, 3)) average(`Average ${humanize(score.column)}`, [new RegExp(`^${score.column.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i")]);
    average("Average GPA", [/^gpa$|gpa/]);
    average("Average Attendance", [/attendance/]);
    average("Average Absence Days", [/absence/]);
    const passColumn = profile.columns.find((column) => /pass|fail|outcome|result/.test(column.name.toLowerCase()))?.name;
    if (passColumn) {
      const passCount = rows.filter((row) => /pass|yes|true|success/i.test(String(row[passColumn]))).length;
      add("Pass Rate", (passCount / Math.max(1, rows.length)) * 100, `Based on ${passColumn}`);
    }
    const absenceColumn = profile.columns.find((column) => /absence/.test(column.name.toLowerCase()))?.name;
    const risk = educationRiskCount(rows, scoreMetrics.map((item) => item.column), absenceColumn);
    if (risk) add("At-Risk Students", risk.count, `Bottom 25% score (<= ${formatNumber(risk.lowThreshold)}) and top 25% absence${risk.highAbsence !== undefined ? ` (>= ${formatNumber(risk.highAbsence)})` : ""}`);
  } else if (domainName.includes("Healthcare")) {
    add("Total Patients", hasColumn(profile, [/patient/]) ? profile.rowCount : undefined, "Rows representing patient records");
    average("Average Age", [/^age$|age/]);
    average("Average Length of Stay", [/length.*stay|stay|los/]);
    average("Average Treatment Cost", [/cost|charge|expense/]);
  } else if (domainName.includes("Workforce")) {
    add("Total Employees", hasColumn(profile, [/employee/]) ? profile.rowCount : undefined, "Rows representing employee records");
    average("Average Salary", [/salary|compensation|wage/]);
    average("Average Tenure", [/tenure/]);
    average("Average Performance Score", [/performance/]);
  } else if (domainName.includes("Sales")) {
    const revenue = metric(profile, [/revenue|sales|amount|total/]);
    add("Total Revenue", revenue ? revenue.avg * revenue.count : undefined, revenue ? `Calculated from ${revenue.column}` : "");
    add("Orders", hasColumn(profile, [/order/]) ? profile.rowCount : undefined, "Rows representing orders");
    average("Average Quantity", [/quantity|qty|units/]);
    average("Average Order Value", [/revenue|sales|amount|total/]);
  }

  if (!kpis.length) kpis.push({ label: "Records", value: profile.rowCount, context: `Rows analyzed in ${domainName}` });
  for (const summary of (profile.numericSummary || [])) {
    if (kpis.length >= 4) break;
    if (!kpis.some((kpi) => kpi.context?.includes(summary.column))) {
      kpis.push({ label: `Avg ${summary.column}`, value: summary.avg, context: `Range ${formatNumber(summary.min)}–${formatNumber(summary.max)}` });
    }
  }
  return kpis.slice(0, 4);
}

function buildEducationCharts(rows: Record<string, unknown>[], profile: DataProfile): ReportChart[] {
  const charts: ReportChart[] = [];
  const scores = educationScoreMetrics(profile);
  const groupColumn = profile.columns.find((column) => /subject|gender|department|class/.test(column.name.toLowerCase()))?.name;
  if (groupColumn && scores[0]) {
    const grouped = averageForGroup(rows, groupColumn, scores[0].column);
    if (grouped.length > 1) charts.push({ id: `education-${groupColumn}-performance`, type: "bar", title: `Average ${humanize(scores[0].column)} by ${humanize(groupColumn)}`, description: `Mean ${humanize(scores[0].column)} for each ${humanize(groupColumn)} group.`, xColumn: groupColumn, yColumn: scores[0].column, data: grouped.slice(0, 10) });
  }
  if (scores.length > 1) {
    const values = rows.flatMap((row) => scores.map((score) => Number(row[score.column])).filter(Number.isFinite));
    const min = Math.min(...values); const max = Math.max(...values); const width = Math.max(1, (max - min) / 5);
    const bins = Array.from({ length: 5 }, (_, index) => ({ name: `${formatNumber(min + index * width)}-${formatNumber(index === 4 ? max : min + (index + 1) * width)}`, value: 0 }));
    for (const value of values) bins[Math.min(4, Math.floor((value - min) / width))].value += 1;
    charts.push({ id: "education-score-distribution", type: "histogram", title: "Academic Score Distribution", description: "Observed distribution across available academic score fields.", data: bins });
  }
  const absence = profile.numericSummary?.find((item) => /absence/.test(item.column.toLowerCase()));
  if (absence && scores[0]) charts.push({ id: "education-absence-performance", type: "scatter", title: `${humanize(absence.column)} vs ${humanize(scores[0].column)}`, description: "Association between absence and academic performance; correlation does not imply causation.", xColumn: absence.column, yColumn: scores[0].column, data: rows.map((row) => ({ x: Number(row[absence.column]), y: Number(row[scores[0].column]) })).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)).slice(0, 500) });
  if (groupColumn && /gender/.test(groupColumn.toLowerCase()) && scores[0]) {
    const grouped = averageForGroup(rows, groupColumn, scores[0].column);
    if (grouped.length > 1) charts.push({ id: "education-gender-performance", type: "bar", title: `Average ${humanize(scores[0].column)} by Gender`, description: "Mean academic score by gender category.", xColumn: groupColumn, yColumn: scores[0].column, data: grouped });
  }
  return charts;
}

function buildCharts(rows: Record<string, unknown>[], profile: DataProfile, domain: string): ReportChart[] {
  if (domain === "Education") return buildEducationCharts(rows, profile).slice(0, 4);
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
    const values = rows
      .map((row) => Number(row[metric.column]))
      .filter(Number.isFinite);
    const binCount = Math.min(12, Math.max(5, Math.ceil(Math.sqrt(values.length))));
    const width = (metric.max - metric.min) / binCount;
    const bins = Array.from({ length: binCount }, (_, index) => ({
      name: `${formatNumber(metric.min + index * width)}-${formatNumber(index === binCount - 1 ? metric.max : metric.min + (index + 1) * width)}`,
      value: 0
    }));
    for (const value of values) {
      const index = Math.min(binCount - 1, Math.floor((value - metric.min) / width));
      bins[index].value += 1;
    }
    charts.push({
      id: "metric-range",
      type: "histogram",
      title: `${metric.column} distribution`,
      description: `Frequency distribution of ${metric.column} using ${binCount} equal-width bins.`,
      xColumn: metric.column,
      data: bins
    });
  }
  return charts.filter((chart) => chart.data.length > 0).slice(0, 4);
}

function buildGenericEvidence(rows: Record<string, unknown>[], profile: DataProfile): ReportFinding[] {
  const finding = (title: string, description: string, evidence: string, importance: ReportFinding["importance"] = "medium"): ReportFinding => ({ title, description, evidence, importance });
  const findings: ReportFinding[] = [];

  const metric = profile.numericSummary?.[0];
  const dimension = profile.categoricalBreakdown?.[0];
  const series = profile.timeSeries || [];

  if (dimension && metric) {
    const grouped = averageForGroup(rows, dimension.column, metric.column);
    if (grouped.length > 1) {
      const strongest = grouped[0];
      const weakest = grouped[grouped.length - 1];
      const gap = strongest.value - weakest.value;
      const relativeGap = Math.abs(gap) / Math.max(Math.abs(weakest.value), 1) * 100;
      if (Math.abs(gap) >= Math.max(5, Math.abs(metric.avg) * 0.1) && relativeGap >= 8) {
        findings.push(finding(
          "Largest segment gap",
          `${strongest.name} performs materially higher than ${weakest.name} on ${metric.column}.`,
          `Observed mean gap: ${formatNumber(gap)} points (${relativeGap.toFixed(1)}% relative difference). ${strongest.name} represents ${formatNumber(strongest.value)} compared with ${weakest.name} at ${formatNumber(weakest.value)}.`,
          "high"
        ));
      }
    }

    if (dimension.items.length > 0) {
      const topShare = dimension.items[0]?.pct ?? 0;
      if (topShare >= 30) {
        findings.push(finding(
          "Category concentration",
          `${dimension.column} is highly concentrated in a small number of values.`,
          `The top observed value accounts for ${pct(topShare)} of records, indicating a concentrated distribution rather than a broad spread.`,
          "medium"
        ));
      }
    }
  }

  if (series.length >= 2) {
    const first = series[0].value;
    const last = series[series.length - 1].value;
    const change = first === 0 ? 0 : ((last - first) / Math.abs(first)) * 100;
    if (Math.abs(change) >= 10) {
      findings.push(finding(
        "Temporal change",
        `${series[0].metric} shows a material period-over-period shift.`,
        `From ${formatNumber(first)} to ${formatNumber(last)}: ${change >= 0 ? "up" : "down"} ${Math.abs(change).toFixed(1)}% across the observed timeline.`,
        "high"
      ));
    }
  }

  const strongRelationship = profile.correlations?.find((item) => Math.abs(item.coefficient) >= 0.6);
  if (strongRelationship) {
    findings.push(finding(
      "Relationship signal",
      `${strongRelationship.first} and ${strongRelationship.second} show a strong observed association.`,
      `Pearson correlation: ${strongRelationship.coefficient.toFixed(2)} (${strongRelationship.strength} strength). This is an association, not a confirmed cause.`,
      "medium"
    ));
  }

  const missingColumn = profile.columns.find((column) => column.missingPct > 20);
  if (missingColumn) {
    findings.push(finding(
      "Data quality risk",
      `${missingColumn.name} has a meaningful missing-data pattern.`,
      `${missingColumn.missingPct.toFixed(1)}% of values are missing, so conclusions based on this field should be treated with caution.`,
      "medium"
    ));
  }

  if (!findings.length) {
    findings.push(finding(
      "Dataset overview",
      "The available structure is too limited to support a strong directional conclusion.",
      `The dataset contains ${formatNumber(profile.rowCount)} records and ${profile.columnCount} fields with no dominant gap or trend signal above the threshold.`,
      "low"
    ));
  }

  return findings.slice(0, 5);
}

function buildNarrative(rows: Record<string, unknown>[], profile: DataProfile, domain: ReturnType<typeof detectIndustryDomain>) {
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
  const finding = (title: string, description: string, evidence: string, importance: ReportFinding["importance"] = "medium"): ReportFinding => ({ title, description, evidence, importance });
  const genericFindings = buildGenericEvidence(rows, profile);
  const findings: ReportFinding[] = [
    ...genericFindings,
    finding("Dataset Coverage", `${formatNumber(profile.rowCount)} records were evaluated across ${profile.columnCount} fields.`, `Detected reporting lens: ${language.label}.`, "low")
  ];
  const risks: ReportFinding[] = buildQuality(profile).warnings.map((warning) => finding("Data Quality", warning, warning, "medium"));
  const opportunities: ReportFinding[] = [];

  if (domain.domain === "Education") {
    const scoreMetrics = educationScoreMetrics(profile);
    const scoreSummary = scoreMetrics.slice(0, 4).map((item) => `${humanize(item.column)} average ${formatNumber(item.avg)}`).join("; ");
    if (scoreSummary) findings.push(finding("Academic Performance", "Academic outcomes vary across the available score fields.", scoreSummary, "high"));
    const absence = profile.numericSummary?.find((item) => /absence/.test(item.column.toLowerCase()));
    const relationship = profile.correlations?.find((item) => absence && (item.first === absence.column || item.second === absence.column) && scoreMetrics.some((score) => score.column === item.first || score.column === item.second));
    if (relationship) {
      const direction = relationship.coefficient < 0 ? "negative" : "positive";
      findings.push(finding("Attendance Pattern", `${humanize(relationship.first)} and ${humanize(relationship.second)} show a ${relationship.strength} ${direction} association.`, `Pearson correlation: ${relationship.coefficient.toFixed(2)}; this is an association, not a causal claim.`, "high"));
    }
    if (scoreMetrics.length > 1) {
      const leaderScore = scoreMetrics.slice().sort((a, b) => b.avg - a.avg)[0];
      findings.push(finding("Subject Comparison", `${humanize(leaderScore.column)} has the highest observed average among the profiled academic measures.`, `${humanize(leaderScore.column)} average: ${formatNumber(leaderScore.avg)}.`, "medium"));
    }
    if (dimension?.column && /gender|department|subject/.test(dimension.column.toLowerCase()) && scoreMetrics[0]) {
      const groups = averageForGroup(rows, dimension.column, scoreMetrics[0].column);
      if (groups.length > 1) findings.push(finding("Student Segmentation", `${humanize(scoreMetrics[0].column)} differs across ${humanize(dimension.column)} groups.`, `Compared ${groups.length} groups using mean ${humanize(scoreMetrics[0].column)}.`, "medium"));
    }
    const absenceColumn = profile.columns.find((column) => /absence/.test(column.name.toLowerCase()))?.name;
    const risk = educationRiskCount(rows, scoreMetrics.map((item) => item.column), absenceColumn);
    if (risk && risk.count > 0) risks.push(finding("Academic Risk", `${risk.count} records meet the combined low-score and elevated-absence rule.`, `Thresholds: score at or below ${formatNumber(risk.lowThreshold)} and absence at or above the 75th percentile.`, "high"));
    opportunities.push(finding("Targeted Support", "Use the combined score and absence segment to prioritize follow-up rather than treating all students uniformly.", "Risk thresholds are calculated from the observed score and absence distributions.", "high"));
  } else {
    if (metric) findings.push(finding("Primary Measure", `${metric.column} establishes the main quantitative baseline.`, `Average ${formatNumber(metric.avg)}; range ${formatNumber(metric.min)} to ${formatNumber(metric.max)}.`, "medium"));
    if (leader) findings.push(finding("Segmentation", `${dimension!.column} provides the strongest available grouping signal.`, `${leader.name} represents ${pct(leader.pct)} of observed records.`, "medium"));
  }
  if (series.length >= 2) findings.push(finding("Trend", trend, `${series[0].metric} changed from ${formatNumber(series[0].value)} to ${formatNumber(series[series.length - 1].value)}.`, "medium"));
  if (metric && metric.volatility > Math.abs(metric.avg) * 2) risks.push(finding("Volatility", `${metric.column} has a wide observed range relative to its mean.`, `Range ${formatNumber(metric.min)} to ${formatNumber(metric.max)} versus average ${formatNumber(metric.avg)}.`, "medium"));
  if (!opportunities.length) opportunities.push(finding("Next Analysis", metric ? `Review ${metric.column} by the strongest available dimensions.` : "Add a measurable outcome field to improve analytical coverage.", metric ? `Available measure: ${metric.column}.` : "No reliable numeric measure was found.", "low"));

  const recommendations = [
    `Adopt ${language.objective.toLowerCase()} as the primary reporting lens rather than applying a generic sales template.`,
    `Investigate the strongest observed difference or risk signal before making operational decisions.`,
    metric ? `Track ${metric.column} with median and percentile context, not only the average, to reduce sensitivity to skew and outliers.` : "Prioritize schema enrichment and define one measurable outcome before operationalizing the dashboard.",
    dimension ? `Segment decisions by ${dimension.column} and compare the top segments against the long tail.` : "Introduce meaningful business dimensions such as department, region, cohort, type or category where applicable."
  ];
  const educationMetrics = domain.domain === "Education" ? educationScoreMetrics(profile) : [];
  const educationSummary = educationMetrics.length
    ? `${educationMetrics.slice(0, 3).map((item) => `${humanize(item.column)} averages ${formatNumber(item.avg)}`).join(", ")}.`
    : "Academic score coverage is limited.";

  const executiveSummaryParts = findings
    .slice(0, 3)
    .map((item) => `${item.title}: ${item.description}`)
    .filter(Boolean);

  const summary = executiveSummaryParts.length
    ? `${executiveSummaryParts.join(" ")}${series.length >= 2 ? ` ${trend}` : ""}`
    : domain.domain === "Education"
      ? `The dataset contains ${formatNumber(profile.rowCount)} student records. ${educationSummary} ${trend}`
      : `${language.objective}. ${trend}`;

  return {
    headline: domain.domain === "Education" ? "Education analytics: academic performance and attendance" : `${language.label}: ${metric ? `${metric.column} is the primary quantitative signal` : "structure and distribution are the primary signals"}.`,
    summary,
    findings,
    risks: risks.slice(0, 5),
    opportunities: opportunities.slice(0, 5),
    recommendations: recommendations.slice(0, 4)
  };
}

export function buildIndustryReport(rows: Record<string, unknown>[], profile: DataProfile): IndustryReport {
  const domain = detectIndustryDomain(profile.columns.map((c) => c.name), rows.slice(0, 30));
  const language = getDomainLanguage(domain.domain);
  const quality = buildQuality(profile);
  const narrative = buildNarrative(rows, profile, domain);
  return {
    version: 1,
    domain: { name: language.label, confidence: domain.confidence, objective: domain.objective, matchedSignals: domain.matchedSignals },
    executive: { headline: narrative.headline, summary: narrative.summary },
    kpis: buildKpis(rows, profile, language.label),
    charts: buildCharts(rows, profile, domain.domain),
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
      dateColumn: profile.timeSeries?.[0]?.dateColumn,
      correlations: profile.correlations || [],
      thresholds: domain.domain === "Education" ? ["Academic risk: average available score at or below the observed 25th percentile plus absence at or above the observed 75th percentile."] : []
    }
  };
}
