import { describe, it, expect } from "vitest";
import { mapRowsToRecords } from "../parser";
import { buildSummary } from "../analytics";
import { runDataDiagnostics } from "../diagnostics";

describe("Data Analyst Service Suite", () => {
  describe("parser.ts - mapRowsToRecords", () => {
    it("should successfully parse valid rows and resolve aliases", () => {
      const mockRows = [
        {
          date: "2026-02-15",
          sales: "250.50",
          product_name: "Super Widget",
          units: "3",
          segment: "Software",
          buyer: "Alice"
        },
        {
          order_date: "2026-02-16",
          total_revenue: "500",
          sku: "Mega App",
          qty: "10",
          product_category: "Cloud",
          customer_name: "Bob"
        }
      ];

      const records = mapRowsToRecords(mockRows);
      expect(records).toHaveLength(2);

      expect(records[0]).toEqual({
        date: new Date("2026-02-15T00:00:00.000Z"),
        revenue: 250.50,
        product: "Super Widget",
        quantity: 3,
        category: "Software",
        customer: "Alice"
      });

      expect(records[1]).toEqual({
        date: new Date("2026-02-16T00:00:00.000Z"),
        revenue: 500,
        product: "Mega App",
        quantity: 10,
        category: "Cloud",
        customer: "Bob"
      });
    });

    it("should reject non-date values such as generic IDs, phone numbers, or zipcodes", () => {
      const mockRows = [
        {
          date: "90210", // Zipcode
          sales: "100",
          product: "Item A",
          qty: "1"
        },
        {
          date: "123456", // Invalid year
          sales: "200",
          product: "Item B",
          qty: "2"
        },
        {
          date: "2026-02-18", // Valid date
          sales: "150",
          product: "Item C",
          qty: "5"
        }
      ];

      const records = mapRowsToRecords(mockRows);
      // Only the last row with the valid date should pass validation
      expect(records).toHaveLength(1);
      expect(records[0].product).toBe("Item C");
    });

    it("should correctly convert valid Excel serial dates", () => {
      // 46000 corresponds to a date in 2025: 2025-12-11
      const mockRows = [
        {
          date: "46000",
          sales: "100",
          product: "Item A",
          qty: "1"
        }
      ];

      const records = mapRowsToRecords(mockRows);
      expect(records).toHaveLength(1);
      expect(records[0].date!.getUTCFullYear()).toBe(2025);
    });
  });

  describe("analytics.ts - buildSummary", () => {
    it("should compute correct KPI totals, unique values, and top categorical entries", async () => {
      const mockRecords = [
        {
          date: new Date("2026-01-01"),
          revenue: 100,
          product: "Apples",
          quantity: 10,
          category: "Fruit",
          customer: "CUST-A",
          extra_numeric: 50
        },
        {
          date: new Date("2026-01-02"),
          revenue: 200,
          product: "Bananas",
          quantity: 5,
          category: "Fruit",
          customer: "CUST-B",
          extra_numeric: 150
        },
        {
          date: new Date("2026-01-03"),
          revenue: 300,
          product: "Apples",
          quantity: 20,
          category: "Fruit",
          customer: "CUST-A",
          extra_numeric: 100
        },
        {
          date: new Date("2026-01-04"),
          revenue: 150,
          product: "Carrots",
          quantity: 15,
          category: "Vegetable",
          customer: "CUST-C",
          extra_numeric: 80
        }
      ];

      const summary = await buildSummary(mockRecords);

      expect(summary.totalRecords).toBe(4);
      expect(summary.uniqueValues.category).toBe(2); // Fruit, Vegetable
      expect(summary.uniqueValues.customer).toBe(3); // CUST-A, B, C

      // Verify top entries has correct sorting and item count
      const categoryEntry = summary.topEntries.find(e => e.column === "category");
      expect(categoryEntry).toBeDefined();
      expect(categoryEntry!.items).toContainEqual({ name: "Fruit", value: 3 });
      expect(categoryEntry!.items).toContainEqual({ name: "Vegetable", value: 1 });

      const productEntry = summary.topEntries.find(e => e.column === "product");
      expect(productEntry).toBeDefined();
      expect(productEntry!.items[0]).toEqual({ name: "Apples", value: 2 });
    });

    it("should detect statistical spikes as trends anomalies when volume exceeds threshold", async () => {
      const records = [];
      // Generate baseline records
      for (let i = 1; i <= 20; i++) {
        records.push({
          date: new Date(`2026-01-${i.toString().padStart(2, "0")}`),
          revenue: 100, // steady baseline
          product: "A",
          quantity: 1
        });
      }
      // Add a massive spike
      records.push({
        date: new Date("2026-01-21"),
        revenue: 2000, // obvious spike
        product: "A",
        quantity: 1
      });

      const summary = await buildSummary(records);
      expect(summary.anomalies.length).toBeGreaterThan(0);
      expect(summary.anomalies[0].label).toBe("2026-01-21");
      expect(summary.anomalies[0].reason).toContain("Significant spike");
    });
  });

  describe("diagnostics.ts - runDataDiagnostics", () => {
    it("should compute accurate data health scores, missing values and duplicate percentages", () => {
      const mockRows = [
        { id: "1", name: "Alice", value: "100" },
        { id: "2", name: "Bob", value: "200" },
        { id: "3", name: "", value: "150" }, // missing name
        { id: "1", name: "Alice", value: "100" } // duplicate of row 1
      ];

      const health = runDataDiagnostics(mockRows);
      expect(health.totalMissing).toBe(1);
      expect(health.duplicatePercentage).toBe(25); // 1 duplicate out of 4 rows
      expect(health.score).toBeLessThan(100);
      expect(health.anomalies.some(a => a.includes("missing"))).toBe(true);
      expect(health.anomalies.some(a => a.includes("duplicate"))).toBe(true);
    });

    it("should spot statistical outliers in numeric columns using Z-scores", () => {
      const rows = [
        { col: "10" },
        { col: "10" },
        { col: "10" },
        { col: "10" },
        { col: "10" },
        { col: "10" },
        { col: "10" },
        { col: "10" },
        { col: "10" },
        { col: "10" },
        { col: "1000" } // outlier with Z-score > 3
      ];

      const health = runDataDiagnostics(rows);
      const colAnomalies = health.anomalies.filter(a => a.includes("outliers"));
      expect(colAnomalies.length).toBeGreaterThan(0);
    });
  });
});
