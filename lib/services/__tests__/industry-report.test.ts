import { describe, expect, it } from "vitest";
import { detectIndustryDomain } from "@/lib/services/domain-engine";
import { createDataProfile } from "@/lib/services/profiler";
import { buildIndustryReport } from "@/lib/services/report-engine";

describe("industry report engine", () => {
  it("detects sales data and permits revenue analysis", () => {
    const rows = [
      { "Order Date": "2026-01-01", Product: "A", Category: "Tools", Quantity: 2, Revenue: 100, Region: "East", Customer: "C1" },
      { "Order Date": "2026-01-02", Product: "B", Category: "Tools", Quantity: 1, Revenue: 80, Region: "West", Customer: "C2" }
    ];
    const report = buildIndustryReport(rows, createDataProfile(rows));
    expect(report.domain.name).toContain("Sales");
    expect(report.kpis.some((kpi) => kpi.label === "Total Revenue")).toBe(true);
  });

  it("detects education data instead of sales", () => {
    const rows = [
      { student_id: 1, student_name: "A", attendance: 92, marks: 88, subject: "Math" },
      { student_id: 2, student_name: "B", attendance: 75, marks: 64, subject: "Science" }
    ];
    expect(detectIndustryDomain(Object.keys(rows[0]), rows).domain).toBe("Education");
  });

  it("detects healthcare data instead of sales", () => {
    const rows = [
      { patient_id: "P1", diagnosis: "Diabetes", doctor: "Dr A", treatment: "Medication", age: 52 },
      { patient_id: "P2", diagnosis: "Hypertension", doctor: "Dr B", treatment: "Therapy", age: 61 }
    ];
    expect(detectIndustryDomain(Object.keys(rows[0]), rows).domain).toBe("Healthcare");
  });

  it("detects finance data from cashflow and ledger terminology", () => {
    const rows = [
      { ledger_id: "L1", cashflow: 15000, liquidity_ratio: 1.8, working_capital: 24000, debt_coverage: 2.1 },
      { ledger_id: "L2", cashflow: 18000, liquidity_ratio: 1.9, working_capital: 26000, debt_coverage: 2.4 }
    ];
    expect(detectIndustryDomain(Object.keys(rows[0]), rows).domain).toBe("Finance & Banking");
  });

  it("builds a non-sales report from an arbitrary schema", () => {
    const rows = [
      { student_id: 1, subject: "Math", attendance: 92, marks: 88 },
      { student_id: 2, subject: "Science", attendance: 75, marks: 64 },
      { student_id: 3, subject: "Math", attendance: 96, marks: 91 }
    ];
    const profile = createDataProfile(rows);
    const report = buildIndustryReport(rows, profile);
    expect(report.domain.name).toContain("Education");
    expect(report.methodology.numericMetrics).toContain("marks");
    expect(report.kpis.some((k) => k.label === "Average Marks")).toBe(true);
    expect(report.findings.length).toBeGreaterThan(1);
    expect(report.kpis.some((kpi) => /revenue|sales|customer/i.test(kpi.label))).toBe(false);
  });

  it("builds an education strategy with analytical charts and evidence", () => {
    const rows = [
      { student_id: "S1", math_score: 92, biology_score: 84, absence_days: 1, gender: "F", subject: "Math" },
      { student_id: "S2", math_score: 61, biology_score: 68, absence_days: 12, gender: "M", subject: "Biology" },
      { student_id: "S3", math_score: 78, biology_score: 75, absence_days: 5, gender: "F", subject: "Math" },
      { student_id: "S4", math_score: 55, biology_score: 60, absence_days: 15, gender: "M", subject: "Biology" }
    ];
    const detection = detectIndustryDomain(Object.keys(rows[0]), rows);
    const report = buildIndustryReport(rows, createDataProfile(rows));
    expect(detection.domain).toBe("Education");
    expect(detection.confidence).toBeGreaterThanOrEqual(0.8);
    expect(detection.matchedSignals).toEqual(expect.arrayContaining(["math_score", "biology_score", "absence_days", "student_id"]));
    expect(report.kpis.map((kpi) => kpi.label)).toEqual(expect.arrayContaining(["Average Math Score", "Average Biology Score", "Average Absence Days"]));
    expect(report.kpis.some((kpi) => /revenue|sales|customer/i.test(kpi.label))).toBe(false);
    expect(report.charts.some((chart) => chart.type === "histogram")).toBe(true);
    expect(report.charts.some((chart) => chart.type === "scatter")).toBe(true);
    expect(report.findings.some((finding) => finding.title === "Attendance Pattern")).toBe(true);
  });

  it("detects workforce data without sales KPIs", () => {
    const rows = [
      { "Employee ID": "E1", Department: "Engineering", Salary: 80000, "Joining Date": "2020-01-01", "Performance Score": 4, Tenure: 5, Attrition: "No" },
      { "Employee ID": "E2", Department: "Finance", Salary: 70000, "Joining Date": "2021-01-01", "Performance Score": 3, Tenure: 4, Attrition: "Yes" }
    ];
    const report = buildIndustryReport(rows, createDataProfile(rows));
    expect(report.domain.name).toContain("Workforce");
    expect(report.kpis.some((kpi) => kpi.label === "Average Salary")).toBe(true);
    expect(report.kpis.some((kpi) => /revenue|sales/i.test(kpi.label))).toBe(false);
  });

  it("uses general analytics for weakly identified schemas", () => {
    const rows = [{ alpha: "x", beta: 1 }, { alpha: "y", beta: 2 }];
    expect(detectIndustryDomain(Object.keys(rows[0]), rows).domain).toBe("General Analytics");
  });

  it("ignores malformed column metadata instead of throwing", () => {
    expect(() => detectIndustryDomain(["Student ID", undefined, null, 42], [{ marks: 80 }])).not.toThrow();
  });
});
