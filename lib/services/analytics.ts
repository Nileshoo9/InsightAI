import { AggregatedSummary, ParsedRecord } from "@/lib/types";

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export async function buildSummary(records: ParsedRecord[]): Promise<AggregatedSummary> {
  if (!records.length) {
    return {
      totalRecords: 0,
      uniqueValues: {},
      topEntries: [],
      trends: [],
      anomalies: [],
      domainInfo: { name: "Empty", description: "No data found", suggestedKPIs: [] }
    };
  }

  const columns = Object.keys(records[0]).filter(k => k !== "date" && k !== "primaryMetric");
  const totalRecords = records.length;
  
  // Identify numeric vs categorical
  const numericCols: string[] = [];
  const categoricalCols: string[] = [];
  
  for (const col of columns) {
    const vals = records.slice(0, 100).map(r => r[col]);
    const numCount = vals.filter(v => {
      if (typeof v === "number") return true;
      if (typeof v === "string") {
        const stripped = v.replace(/[^0-9.-]+/g, "");
        return stripped !== "" && !isNaN(Number(stripped));
      }
      return false;
    }).length;
    if (numCount > vals.length * 0.8) {
      numericCols.push(col);
    } else {
      categoricalCols.push(col);
    }
  }

  // Calculate unique values
  const uniqueValues: Record<string, number> = {};
  for (const col of categoricalCols) {
    uniqueValues[col] = new Set(records.map(r => r[col])).size;
  }

  // Calculate top entries
  const topEntries = categoricalCols
    .filter(col => uniqueValues[col] > 1 && (uniqueValues[col] < totalRecords * 0.95 || totalRecords < 10))
    .slice(0, 3)
    .map(col => {
      const counts: Record<string, number> = {};
      for (const r of records) {
        const val = String(r[col] || "Unknown");
        counts[val] = (counts[val] || 0) + 1;
      }
      return {
        column: col,
        items: Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([name, value]) => ({ name, value }))
      };
    });

  // Calculate trends (if date and numeric exists)
  const dateCol = records[0].date ? "date" : null;
  const primaryMetricCol = numericCols[0] || "primaryMetric";
  
  const trends: AggregatedSummary["trends"] = [];
  if (dateCol && primaryMetricCol) {
    const dayMap = new Map<string, number>();
    for (const r of records) {
      const rDate = r[dateCol];
      if (!(rDate instanceof Date)) continue;
      const key = rDate.toISOString().slice(0, 10);
      const val = typeof r[primaryMetricCol] === "number" ? r[primaryMetricCol] : Number(String(r[primaryMetricCol] || "0").replace(/[^0-9.-]+/g, ""));
      dayMap.set(key, (dayMap.get(key) || 0) + (val || 0));
    }
    
    trends.push(...[...dayMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-30)
      .map(([label, value]) => ({ label, value, metric: primaryMetricCol }))
    );
  }

  // Detect basic anomalies
  const anomalies: AggregatedSummary["anomalies"] = [];
  if (trends.length > 5) {
    const values = trends.map(t => t.value);
    const avg = average(values);
    const stdDev = Math.sqrt(average(values.map(v => Math.pow(v - avg, 2))));
    const threshold = avg + stdDev * 2;
    
    anomalies.push(...trends
      .filter(t => t.value > threshold)
      .map(t => ({ label: t.label, value: t.value, reason: "Significant spike above normal variance" }))
    );
  }

  return {
    totalRecords,
    primaryMetricTotal: numericCols[0] ? records.reduce((sum, r) => sum + (Number(String(r[numericCols[0]] || "0").replace(/[^0-9.-]+/g, "")) || 0), 0) : undefined,
    uniqueValues,
    topEntries,
    trends,
    anomalies,
    domainInfo: {
      name: "Assessed Dataset",
      description: `Analysis across ${categoricalCols.length} categories and ${numericCols.length} metrics.`,
      suggestedKPIs: numericCols.slice(0, 4)
    }
  };
}
