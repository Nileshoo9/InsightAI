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

    const search = new URLSearchParams(parsed.search);
    if (!search.has("connection_limit")) search.set("connection_limit", "5");
    if (!search.has("pool_timeout")) search.set("pool_timeout", "15");
    parsed.search = search.toString();

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

/** Validate server secrets without ever exposing their values. Gemini is optional. */
export function validateServerEnvironment() {
  const databaseUrl = requireDatabaseUrl();
  const jwtSecret = process.env.JWT_SECRET?.trim();
  if (!jwtSecret || jwtSecret.length < 32 || /replace|change[-_ ]?me|development-secret|^secret$/i.test(jwtSecret)) {
    throw new Error("JWT_SECRET must be a unique random value with at least 32 characters");
  }
  return { databaseUrl, geminiEnabled: Boolean(process.env.GEMINI_API_KEY?.trim()) };
}
