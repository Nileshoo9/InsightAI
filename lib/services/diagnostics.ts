export type DataHealthResult = {
  score: number;
  totalMissing: number;
  outliers: { column: string; count: number }[];
  duplicatePercentage: number;
  anomalies: string[];
};

function parseLooseNumber(value: unknown): number | null {
  const txt = String(value ?? "").trim();
  if (!txt) return null;
  const cleaned = txt.replace(/[^0-9.-]+/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === "-.") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function runDataDiagnostics(rows: Record<string, unknown>[]): DataHealthResult {
  if (!rows.length) return { score: 100, totalMissing: 0, outliers: [], duplicatePercentage: 0, anomalies: [] };

  const rowCount = rows.length;
  const columns = Object.keys(rows[0]);
  let totalMissing = 0;
  const outliers: { column: string; count: number }[] = [];
  const anomalies: string[] = [];

  // 1. Missing Value Check
  for (const row of rows) {
    for (const col of columns) {
      const val = row[col];
      if (val === null || val === undefined || String(val).trim() === "") {
        totalMissing++;
      }
    }
  }

  // 2. Outlier Detection (Z-Score > 3)
  for (const col of columns) {
    const numericValues = rows
      .map(r => parseLooseNumber(r[col]))
      .filter((n): n is number => n !== null);

    if (numericValues.length > 5) {
      const mean = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
      const stdDev = Math.sqrt(
        numericValues.map(v => Math.pow(v - mean, 2)).reduce((a, b) => a + b, 0) / numericValues.length
      );

      if (stdDev > 0) {
        const colOutliers = numericValues.filter(v => Math.abs((v - mean) / stdDev) > 3);
        if (colOutliers.length > 0) {
          outliers.push({ column: col, count: colOutliers.length });
        }
      }
    }
  }

  // 3. Duplicate Row Detection (Quick hash-based)
  const uniqueRows = new Set(rows.map(r => JSON.stringify(r))).size;
  const duplicatePercentage = ((rowCount - uniqueRows) / rowCount) * 100;

  // 4. Construct Anomalies
  if (totalMissing > 0) {
    const missingPct = ((totalMissing / (rowCount * columns.length)) * 100).toFixed(1);
    anomalies.push(`${missingPct}% of values are missing or incomplete.`);
  }
  if (duplicatePercentage > 2) {
    anomalies.push(`Detected ${duplicatePercentage.toFixed(1)}% duplicate records.`);
  }
  outliers.forEach(o => {
    anomalies.push(`Column "${o.column}" contains ${o.count} statistical outliers.`);
  });

  // 5. Calculate Score
  let score = 100;
  score -= (totalMissing / (rowCount * columns.length)) * 100;
  score -= duplicatePercentage * 0.5;
  score -= outliers.length * 2;

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    totalMissing,
    outliers,
    duplicatePercentage,
    anomalies
  };
}
