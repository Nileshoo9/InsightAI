import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { ParsedRecord } from "@/lib/types";

type RowInput = Record<string, unknown>;
export type GenericRow = Record<string, string | number | boolean | null>;
export type WorkbookSheet = { name: string; rows: GenericRow[] };

const EMPTY = new Set(["", "null", "undefined", "n/a", "na"]);

function cell(value: unknown): GenericRow[string] {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (["string", "number", "boolean"].includes(typeof value)) return value as GenericRow[string];
  return JSON.stringify(value);
}

function normalizedHeaders(keys: string[]): string[] {
  const used = new Map<string, number>();
  return keys.map((key, index) => {
    const base = String(key || `column_${index + 1}`).trim().replace(/\s+/g, " ") || `column_${index + 1}`;
    const count = used.get(base) || 0;
    used.set(base, count + 1);
    return count ? `${base}_${count + 1}` : base;
  });
}

export function normalizeRows(rows: RowInput[]): GenericRow[] {
  const keys = normalizedHeaders([...new Set(rows.flatMap((row) => Object.keys(row || {})))]);
  const originalKeys = [...new Set(rows.flatMap((row) => Object.keys(row || {})))];
  return rows
    .map((row) => Object.fromEntries(originalKeys.map((key, index) => [keys[index], cell(row?.[key])])) as GenericRow)
    .filter((row) => Object.values(row).some((value) => !EMPTY.has(String(value ?? "").trim().toLowerCase())));
}

export function parseCsvRows(text: string): GenericRow[] {
  // PapaParse detects delimiters from its built-in candidates when none is supplied.
  const result = Papa.parse<RowInput>(text.replace(/^\uFEFF/, ""), { header: true, skipEmptyLines: "greedy", dynamicTyping: false });
  const fatal = result.errors.find((error) => error.code === "UndetectableDelimiter" || error.type === "Quotes");
  if (fatal) throw new Error(`CSV parse failed: ${fatal.message}`);
  return normalizeRows(result.data);
}

export function parseExcelWorkbook(buffer: ArrayBuffer): WorkbookSheet[] {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  if (!workbook.SheetNames.length) throw new Error("Excel file has no sheets");
  return workbook.SheetNames.map((name) => ({
    name,
    rows: normalizeRows(XLSX.utils.sheet_to_json<RowInput>(workbook.Sheets[name], { defval: null, raw: false }))
  }));
}

export function parseExcelRows(buffer: ArrayBuffer, sheetName?: string): GenericRow[] {
  const sheets = parseExcelWorkbook(buffer);
  const selected = sheetName ? sheets.find((sheet) => sheet.name === sheetName) : sheets[0];
  if (!selected) throw new Error("Selected Excel sheet was not found");
  return selected.rows;
}

function flatten(value: unknown, prefix = "", out: RowInput = {}): RowInput {
  if (Array.isArray(value)) {
    out[prefix || "value"] = JSON.stringify(value);
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as RowInput)) flatten(child, prefix ? `${prefix}.${key}` : key, out);
  } else {
    out[prefix || "value"] = value;
  }
  return out;
}

/** Accepts arrays of objects and common wrapper objects such as { data: [...] }. */
export function parseJsonRows(text: string): GenericRow[] {
  let input: unknown;
  try { input = JSON.parse(text); } catch { throw new Error("JSON parse failed: invalid JSON"); }
  const root = Array.isArray(input) ? input : input && typeof input === "object"
    ? Object.values(input as RowInput).find(Array.isArray) ?? [input]
    : [];
  if (!Array.isArray(root)) throw new Error("JSON must contain an array of records or an object with an array property");
  return normalizeRows(root.filter((item): item is RowInput => Boolean(item && typeof item === "object" && !Array.isArray(item))).map((item) => flatten(item)));
}

// Compatibility helpers for historical reports; new uploads never persist this sales-only shape.
export function shouldUseStructuredParser(rows: RowInput[]) {
  const keys = Object.keys(rows[0] || {}).join(" ").toLowerCase();
  return /(revenue|sales|amount)/.test(keys) && /(product|sku|item)/.test(keys) && !/(movie|director|episode)/.test(keys);
}
export function mapRowsToRecords(rows: RowInput[]): ParsedRecord[] {
  const aliases = (row: RowInput, names: string[]) => {
    const entries = Object.entries(row).map(([key, value]) => [key.toLowerCase().replace(/\s+/g, "_"), value] as const);
    return names.map((name) => entries.find(([key]) => key === name)?.[1]).find((value) => !empty(value));
  };
  const empty = (value: unknown) => value === null || value === undefined || String(value).trim() === "";
  return rows.flatMap((row) => {
    const rawDate = aliases(row, ["date", "order_date", "created_at", "timestamp"]);
    const text = String(rawDate ?? "");
    let date = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(text) ? new Date(text) : new Date(NaN);
    const serial = Number(text);
    if (Number.isNaN(date.getTime()) && serial >= 25569 && serial <= 90000) date = new Date((serial - 25569) * 86400000);
    const revenue = Number(String(aliases(row, ["revenue", "sales", "amount", "total_revenue"]) ?? "").replace(/[^0-9.-]/g, ""));
    const product = String(aliases(row, ["product", "product_name", "item", "sku"]) ?? "").trim();
    const quantity = Number(aliases(row, ["quantity", "qty", "units"]) ?? 1);
    if (Number.isNaN(date.getTime()) || date.getUTCFullYear() < 1990 || date.getUTCFullYear() > 2100 || !product || !Number.isFinite(revenue) || !Number.isFinite(quantity)) return [];
    const category = aliases(row, ["category", "product_category", "segment"]);
    const customer = aliases(row, ["customer", "customer_name", "buyer", "user"]);
    return [{ date, revenue, product, quantity, ...(category ? { category: String(category) } : {}), ...(customer ? { customer: String(customer) } : {}) }];
  });
}
