import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

function normalizeDatabaseUrl(url: string) {
  if (!url) return url;

  try {
    const parsed = new URL(url);
    if (parsed.username) {
      parsed.username = encodeURIComponent(decodeURIComponent(parsed.username));
    }
    if (parsed.password) {
      parsed.password = encodeURIComponent(decodeURIComponent(parsed.password));
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

export function requireDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not configured");
  }

  return normalizeDatabaseUrl(url);
}

export function getDatabaseUrl() {
  return requireDatabaseUrl();
}
