import Papa from "papaparse";
import * as XLSX from "xlsx";
import { ParsedRecord } from "@/lib/types";

type RowInput = Record<string, unknown>;
export type GenericRow = Record<string, string | number | boolean | null>;

function normalizeKey(key: string) {
  return key.trim().toLowerCase().replace(/\s+/g, "_");
}

function findValue(row: RowInput, aliases: string[]) {
  const normalized = Object.entries(row).reduce<Record<string, unknown>>((acc, [k, v]) => {
    acc[normalizeKey(k)] = v;
    return acc;
  }, {});
  for (const alias of aliases) {
    const val = normalized[normalizeKey(alias)];
    if (val !== undefined && val !== null && String(val).trim() !== "") {
      return val;
    }
  }
  return undefined;
}

function parseNumber(value: unknown, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function parseDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const text = String(value ?? "").trim();
  if (!text) return null;
  const d = new Date(text);
  if (!Number.isNaN(d.getTime())) return d;
  const excelSerial = Number(text);
  if (Number.isFinite(excelSerial) && excelSerial > 59) {
    return new Date(Math.round((excelSerial - 25569) * 86400 * 1000));
  }
  return null;
}

export function mapRowsToRecords(rows: RowInput[]) {
  const records: ParsedRecord[] = [];
  for (const row of rows) {
    const dateVal = findValue(row, ["date", "order_date", "created_at", "timestamp"]);
    const revenueVal = findValue(row, ["revenue", "sales", "amount", "total", "total_revenue"]);
    const productVal = findValue(row, ["product", "product_name", "item", "sku"]);
    const quantityVal = findValue(row, ["quantity", "qty", "units"]);
    const categoryVal = findValue(row, ["category", "product_category", "segment"]);
    const customerVal = findValue(row, ["customer", "customer_name", "buyer", "user"]);

    const date = parseDate(dateVal);
    const revenue = parseNumber(revenueVal);
    const product = String(productVal ?? "").trim();
    const quantity = parseNumber(quantityVal, 1);
    const category = categoryVal ? String(categoryVal).trim() : undefined;
    const customer = customerVal ? String(customerVal).trim() : undefined;

    if (!date || !product || !Number.isFinite(revenue) || !Number.isFinite(quantity)) {
      continue;
    }

    records.push({
      date,
      revenue,
      product,
      quantity: Math.max(0, Math.round(quantity)),
      category,
      customer
    });
  }
  return records;
}

function normalizeCell(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return String(value);
}

function normalizeRows(rows: RowInput[]): GenericRow[] {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([k, v]) => [k, normalizeCell(v)])
    )
  );
}

export function parseCsvRows(text: string) {
  const result = Papa.parse<RowInput>(text, {
    header: true,
    skipEmptyLines: true
  });
  if (result.errors.length) {
    throw new Error(`CSV parse failed: ${result.errors[0]?.message || "invalid format"}`);
  }
  return normalizeRows(result.data);
}

export function parseExcelRows(buffer: ArrayBuffer) {
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("Excel file has no sheets");
  }
  const sheet = workbook.Sheets[firstSheetName];
  const jsonRows = XLSX.utils.sheet_to_json<RowInput>(sheet, { defval: null });
  return normalizeRows(jsonRows);
}

export function parseCsvFile(text: string) {
  return mapRowsToRecords(parseCsvRows(text));
}

export function parseExcelFile(buffer: ArrayBuffer) {
  return mapRowsToRecords(parseExcelRows(buffer));
}
