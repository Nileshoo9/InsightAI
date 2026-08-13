import { createDataProfile, type ColumnProfile } from "@/lib/services/profiler";

export type CleaningActionResult = { columnName: string; operation: string; beforeCount: number; afterCount: number; details: Record<string, unknown> };
export type CleaningResult = { rows: Record<string, unknown>[]; actions: CleaningActionResult[]; profile: ReturnType<typeof createDataProfile> };

const empty = (value: unknown) => value === null || value === undefined || String(value).trim() === "";
const normaliseName = (name: string) => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "column";

export function cleanDataset(input: Record<string, unknown>[]): CleaningResult {
  const actions: CleaningActionResult[] = [];
  const nonEmpty = input.filter((row) => Object.values(row).some((value) => !empty(value)));
  if (nonEmpty.length !== input.length) actions.push({ columnName: "*", operation: "remove_empty_rows", beforeCount: input.length, afterCount: nonEmpty.length, details: {} });
  const keys = [...new Set(nonEmpty.flatMap(Object.keys))];
  const usable = keys.filter((key) => nonEmpty.some((row) => !empty(row[key])));
  const dropped = keys.filter((key) => !usable.includes(key));
  if (dropped.length) actions.push({ columnName: dropped.join(", "), operation: "remove_empty_columns", beforeCount: keys.length, afterCount: usable.length, details: { columns: dropped } });
  const nameMap = Object.fromEntries(usable.map((key) => [key, normaliseName(key)]));
  const renamed = usable.filter((key) => key !== nameMap[key]);
  if (renamed.length) actions.push({ columnName: renamed.join(", "), operation: "normalize_column_names", beforeCount: renamed.length, afterCount: renamed.length, details: { mapping: nameMap } });
  const rows = nonEmpty.map((row) => Object.fromEntries(usable.map((key) => [nameMap[key], typeof row[key] === "string" ? row[key].trim() : row[key]])));
  const unique = new Set<string>();
  const deduped = rows.filter((row) => { const hash = JSON.stringify(row); if (unique.has(hash)) return false; unique.add(hash); return true; });
  if (deduped.length !== rows.length) actions.push({ columnName: "*", operation: "remove_duplicates", beforeCount: rows.length, afterCount: deduped.length, details: { removed: rows.length - deduped.length } });
  const profile = createDataProfile(deduped);
  for (const column of profile.columns) fillMissing(deduped, column, actions);
  return { rows: deduped, actions, profile: createDataProfile(deduped) };
}

function fillMissing(rows: Record<string, unknown>[], column: ColumnProfile, actions: CleaningActionResult[]) {
  const missing = rows.filter((row) => empty(row[column.name]));
  if (!missing.length || column.dataType === "date" || column.dataType === "text") return;
  const values = rows.map((row) => row[column.name]).filter((value) => !empty(value));
  let replacement: unknown;
  let strategy: string;
  if (column.dataType === "numeric" && column.median !== null && column.median !== undefined) { replacement = column.median; strategy = "impute_numeric_median"; }
  else { replacement = column.mode ?? "Unknown"; strategy = "impute_categorical_mode"; }
  for (const row of missing) row[column.name] = replacement;
  actions.push({ columnName: column.name, operation: strategy, beforeCount: values.length, afterCount: rows.length, details: { replaced: missing.length, replacement } });
}
