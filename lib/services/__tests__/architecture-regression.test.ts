import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createDataProfile } from "@/lib/services/profiler";

describe("project architecture guardrails", () => {
  it("removes the legacy sales-only DataRecord model from the canonical schema", () => {
    const schema = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8");
    expect(schema).not.toMatch(/model\s+DataRecord\s*\{/i);
    expect(schema).toMatch(/model\s+File\s*\{/i);
  });

  it("documents the generic data-analysis architecture instead of the outdated SaaS sales pitch", () => {
    const readme = readFileSync(join(process.cwd(), "README.md"), "utf8");
    expect(readme.toLowerCase()).toContain("general analytics");
    expect(readme.toLowerCase()).not.toContain("production-ready mvp");
    expect(readme.toLowerCase()).not.toContain("openai responses api");
  });

  it("keeps the full 10,000-row profile intact instead of silently truncating the dataset", () => {
    const rows = Array.from({ length: 10_000 }, (_, index) => ({
      id: `row-${index}`,
      score: 60 + (index % 40),
      department: index % 2 === 0 ? "A" : "B",
      attendance: 70 + (index % 30)
    }));

    const profile = createDataProfile(rows);
    expect(profile.rowCount).toBe(10_000);
    expect(profile.columns.length).toBeGreaterThan(0);
    expect(profile.rowCount).toBeGreaterThanOrEqual(10_000);
  });
});
