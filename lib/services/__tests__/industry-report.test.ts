import { describe, expect, it } from "vitest";
import { detectIndustryDomain } from "@/lib/services/domain-engine";
import { createDataProfile } from "@/lib/services/profiler";
import { buildIndustryReport } from "@/lib/services/report-engine";

describe("industry report engine", () => {
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
    expect(report.kpis.some((k) => k.label === "Avg marks")).toBe(true);
    expect(report.findings.length).toBeGreaterThan(1);
  });
});
