import { AggregatedSummary, InsightPayload } from "@/lib/types";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";

export class ProviderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderUnavailableError";
  }
}

export function getProviderConfig(env: NodeJS.ProcessEnv = process.env) {
  const lumoApiKey = env.LUMO_API_KEY || "";
  const lumoBaseUrl = (env.LUMO_API_BASE_URL || env.LUMO_BASE_URL || "https://api.lumosel.vip").replace(/\/$/, "");
  const kimiApiKey = env.KIMI_API_KEY || env.MOONSHOT_API_KEY || "";
  const geminiApiKey = env.GEMINI_API_KEY || env.GOOGLE_GEMINI_API_KEY || env.GOOGLE_API_KEY || "";
  const groqApiKey = env.GROQ_API_KEY || "";
  const openrouterApiKey = env.OPENROUTER_API_KEY || "";
  // OpenRouter's public chat-completions endpoint is /api/v1, not /v1.
  const openrouterBaseUrl = (env.OPENROUTER_BASE_URL || "https://openrouter.ai/api").replace(/\/$/, "");
  const openrouterModel = env.OPENROUTER_MODEL || "gpt-4o-mini";

  let provider: "lumo" | "kimi" | "gemini" | "openrouter" | "groq" | "none" = "none";

  if (lumoApiKey && lumoBaseUrl) {
    provider = "lumo";
  } else if (kimiApiKey) {
    provider = "kimi";
  } else if (geminiApiKey) {
    provider = "gemini";
  } else if (openrouterApiKey) {
    provider = "openrouter";
  } else if (groqApiKey) {
    provider = "groq";
  }

  return {
    provider,
    lumoApiKey,
    lumoBaseUrl,
    kimiApiKey,
    geminiApiKey,
    groqApiKey,
    openrouterApiKey,
    openrouterBaseUrl,
    openrouterModel
  };
}

async function generateWithLumo(prompt: string, mode: "analysis" | "fast"): Promise<string> {
  const { lumoApiKey, lumoBaseUrl } = getProviderConfig();
  if (!lumoApiKey || !lumoBaseUrl) throw new Error("Lumo API key and base URL must both be configured.");

  const preferred = mode === "analysis"
    ? (process.env.LUMO_MODEL_ANALYSIS || process.env.LUMO_MODEL || "claude-3-5-sonnet-20241022")
    : (process.env.LUMO_MODEL_FAST || process.env.LUMO_MODEL || "claude-3-5-haiku-20241022");

  // Try the preferred model first, then fall back to a small curated list of lower-tier models
  const fallbackCandidates = [preferred, "claude-3-5-haiku-20241022", "claude-3-5-sonnet-20241022", "claude-2.1", "claude-instant-1"]
    .filter(Boolean).map(String);

  let lastError: unknown;

  for (const modelName of fallbackCandidates) {
    let response: Response | undefined;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        response = await fetch(`${lumoBaseUrl}/v1/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": lumoApiKey,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: modelName,
            max_tokens: 4096,
            temperature: 0.1,
            messages: [{ role: "user", content: prompt }]
          })
        });
      } catch (err) {
        lastError = err;
        // network error, try again
        if (attempt === 0) await new Promise((r) => setTimeout(r, 300));
        continue;
      }

      if (!response) continue;

      if (response.ok) {
        const data = await response.json() as { content?: Array<{ type?: string; text?: string }> };
        const content = data.content?.find((part) => part.type === "text")?.text?.trim();
        if (!content) {
          lastError = new Error("Lumo returned an empty response.");
          break; // try next model
        }
        // success
        if (modelName !== preferred) console.info(`[Lumo] Fallback model used: ${modelName}`);
        return content;
      }

      // Non-OK response: read body and decide whether to try a cheaper model
      const bodyText = await response.text();
      lastError = new Error(`Lumo request failed (${response.status}): ${String(bodyText).slice(0, 1000)}`);

      // If the service is explicitly saying the model is paid-only or access denied, try next lower-tier candidate
      const lowerTierCue = /paid plans|upgrade your plan|paid-only|not available on your plan/i;
      if (response.status === 403 && lowerTierCue.test(bodyText)) {
        console.warn(`[Lumo] Model ${modelName} unavailable for current plan; trying next lower-tier model.`);
        continue; // try next modelName in fallbackCandidates
      }

      // For 502/503/504 transient errors, retry current model a bit longer
      if ([502, 503, 504].includes(response.status)) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        continue;
      }

      // For authentication-like errors (401/403 not explicitly paid-only), surface it to caller
      if (response.status === 401 || response.status === 403) {
        const err = new Error(`Lumo request failed (${response.status}): ${bodyText}`) as Error & { status?: number };
        (err as any).status = response.status;
        throw err;
      }

      // Otherwise try the next candidate model
    }
  }

  // All attempts exhausted
  throw lastError instanceof Error ? lastError : new Error("Lumo did not return a usable response.");
}

// OpenRouter provider integration (single-provider approach)
async function generateWithOpenRouter(prompt: string, mode: "analysis" | "fast"): Promise<string> {
  const { openrouterApiKey, openrouterBaseUrl, openrouterModel } = getProviderConfig();
  if (!openrouterApiKey) throw new Error("OpenRouter API key is not configured.");

  const endpoint = `${openrouterBaseUrl}/v1/chat/completions`;
  const model = openrouterModel || "gpt-4o-mini";

  const body = {
    model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1,
    max_tokens: 4096
  } as any;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openrouterApiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    const err = new Error(`OpenRouter request failed (${response.status}): ${text}`) as Error & { status?: number };
    err.status = response.status;
    throw err;
  }

  // Try to extract a textual response from a few possible shapes
  const json = await response.json().catch(() => null);
  if (!json) throw new Error("OpenRouter returned non-JSON response.");

  // Common response shapes: { choices: [{ message: { content: "..." } }] }, or { output: [{ content: [{ type:"text", text:"..." }] }] }
  const choiceText = (json.choices && json.choices[0] && (json.choices[0].message?.content || json.choices[0].message?.content?.text || json.choices[0].text)) || null;
  if (typeof choiceText === "string" && choiceText.trim()) return choiceText.trim();

  const outputText = json.output?.[0]?.content?.[0]?.text || json.output?.[0]?.content?.[0]?.message || null;
  if (typeof outputText === "string" && outputText.trim()) return outputText.trim();

  // Last resort: try top-level text fields
  if (typeof json.text === "string" && json.text.trim()) return json.text.trim();

  // If nothing found, return the stringified JSON as fallback
  return JSON.stringify(json);
}

let geminiClient: GoogleGenerativeAI | null = null;
let geminiApiKeyCache: string | null = null;

function getGeminiClient() {
  const { geminiApiKey } = getProviderConfig();
  if (!geminiApiKey) return null;
  if (!geminiClient || geminiApiKeyCache !== geminiApiKey) {
    geminiClient = new GoogleGenerativeAI(geminiApiKey);
    geminiApiKeyCache = geminiApiKey;
  }
  return geminiClient;
}

async function generateWithKimi(prompt: string, mode: "analysis" | "fast"): Promise<string> {
  const { kimiApiKey } = getProviderConfig();
  if (!kimiApiKey) {
    throw new Error("Kimi API key is not configured.");
  }

  const modelName = process.env.KIMI_MODEL || (mode === "analysis" ? "moonshot-v1-8k" : "moonshot-v1-8k");
  const endpoint = "https://api.moonshot.cn/v1/chat/completions";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${kimiApiKey}`
    },
    body: JSON.stringify({
      model: modelName,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 4096
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Kimi request failed (${response.status}): ${errorText}`);
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("Kimi returned an empty response.");
  }

  return content;
}

async function generateWithGemini(prompt: string, mode: "analysis" | "fast"): Promise<string | null> {
  const client = getGeminiClient();
  if (!client) return null;

  try {
    const modelName = process.env.GEMINI_MODEL || (mode === "analysis" ? "gemini-2.0-flash" : "gemini-2.0-flash");
    const model = client.getGenerativeModel({ model: modelName });
    const result = await model.generateContent(prompt);
    const text = await result.response.text();
    if (text?.trim()) return text.trim();
  } catch (err) {
    console.warn(`[Gemini] fallback unavailable: ${summarizeProviderError(err)}`);
  }

  return null;
}

function isModelNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const maybeErr = err as { status?: unknown; message?: unknown; error?: { code?: string } };
  const status404 = Number(maybeErr.status) === 404;
  const isGroqNotFound = maybeErr.error?.code === "model_not_found";
  const message = typeof maybeErr.message === "string" ? maybeErr.message.toLowerCase() : "";
  return status404 || isGroqNotFound || message.includes("not found") || message.includes("unknown model");
}

function isQuotaOrRateLimitError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const maybeErr = err as { status?: unknown; message?: unknown; error?: { code?: string } };
  const status429 = Number(maybeErr.status) === 429;
  const isGroqRateLimit = maybeErr.error?.code === "rate_limit_exceeded";
  const message = typeof maybeErr.message === "string" ? maybeErr.message.toLowerCase() : "";
  return status429 || isGroqRateLimit || message.includes("quota exceeded") || message.includes("too many requests") || message.includes("rate limit");
}

export function isAuthenticationError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const maybeErr = err as { status?: unknown; message?: unknown; error?: { message?: string; code?: string } };
  const status = Number(maybeErr.status);
  const message = typeof maybeErr.message === "string" ? maybeErr.message.toLowerCase() : "";
  const errorMessage = typeof maybeErr.error?.message === "string" ? maybeErr.error.message.toLowerCase() : "";
  return status === 401 || status === 403 || message.includes("invalid authentication") || message.includes("unauthorized") || errorMessage.includes("invalid authentication") || errorMessage.includes("unauthorized");
}

function summarizeProviderError(err: unknown): string {
  if (!err || typeof err !== "object") return "Unknown provider error";
  const maybeErr = err as { status?: unknown; statusText?: unknown; message?: unknown; error?: { message?: string; code?: string } };
  const status = maybeErr.status ? String(maybeErr.status) : "n/a";
  const statusText = typeof maybeErr.statusText === "string" ? maybeErr.statusText : "unknown";
  const message = maybeErr.error?.message || (typeof maybeErr.message === "string" ? maybeErr.message : "no message");
  const code = maybeErr.error?.code ? `, code=${maybeErr.error.code}` : "";
  return `status=${status}, statusText=${statusText}${code}, message=${message.slice(0, 280)}`;
}

function hasProviderCredentials(): boolean {
  const { lumoApiKey, kimiApiKey, geminiApiKey, groqApiKey, openrouterApiKey } = getProviderConfig();
  return Boolean(lumoApiKey || kimiApiKey || geminiApiKey || groqApiKey || openrouterApiKey);
}

function isNetworkOrTransientProviderError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const maybeErr = err as { status?: unknown; message?: unknown; name?: unknown; cause?: unknown };
  const status = Number(maybeErr.status);
  const message = typeof maybeErr.message === "string" ? maybeErr.message.toLowerCase() : "";
  const name = typeof maybeErr.name === "string" ? maybeErr.name.toLowerCase() : "";
  const causeMessage = typeof maybeErr.cause === "string" ? maybeErr.cause.toLowerCase() : String(maybeErr.cause || "").toLowerCase();

  return (
    status === 408 ||
    status === 429 ||
    [500, 502, 503, 504].includes(status) ||
    name.includes("typeerror") ||
    message.includes("fetch failed") ||
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("temporarily unavailable") ||
    causeMessage.includes("fetch failed") ||
    causeMessage.includes("network")
  );
}

function candidateModels(mode: "analysis" | "fast"): string[] {
  const configuredAnalysis = process.env.GROQ_MODEL_ANALYSIS;
  const configuredFast = process.env.GROQ_MODEL_FAST;
  
  const defaults =
    mode === "analysis"
      ? ["llama-3.3-70b-versatile", "llama-3.1-70b-versatile", "mixtral-8x7b-32768", "llama3-70b-8192"]
      : ["llama-3.1-8b-instant", "llama3-8b-8192", "gemma2-9b-it"];

  const configured = mode === "analysis" ? configuredAnalysis : configuredFast;
  const raw = [configured, ...defaults].filter((m): m is string => Boolean(m && m.trim()));
  return [...new Set(raw)];
}

export async function generateWithModelFallback(mode: "analysis" | "fast", prompt: string): Promise<string> {
  const { provider, lumoApiKey, lumoBaseUrl, kimiApiKey, geminiApiKey, openrouterApiKey } = getProviderConfig();
  const orderedProviders: Array<{ name: string; run: () => Promise<string> }> = [];

  if (provider === "lumo" && lumoApiKey && lumoBaseUrl) {
    orderedProviders.push({ name: "Lumo", run: () => generateWithLumo(prompt, mode) });
  }
  if (provider === "kimi" && kimiApiKey) {
    orderedProviders.push({ name: "Kimi", run: () => generateWithKimi(prompt, mode) });
  }
  if (provider === "gemini" && geminiApiKey) {
    orderedProviders.push({
      name: "Gemini",
      run: async () => {
        const text = await generateWithGemini(prompt, mode);
        if (!text) throw new Error("Gemini returned no usable content.");
        return text;
      }
    });
  }
  if (provider === "openrouter" && openrouterApiKey) {
    orderedProviders.push({ name: "OpenRouter", run: () => generateWithOpenRouter(prompt, mode) });
  }

  if (!orderedProviders.length) {
    const configured = [
      lumoApiKey && lumoBaseUrl ? "Lumo" : null,
      kimiApiKey ? "Kimi" : null,
      geminiApiKey ? "Gemini" : null,
      openrouterApiKey ? "OpenRouter" : null
    ].filter(Boolean);

    if (!configured.length) {
      console.info("[AI] No provider credentials configured; using contextual fallback.");
      throw new ProviderUnavailableError("No AI provider credentials are configured. Using stored context fallback.");
    }

    if (lumoApiKey && lumoBaseUrl) {
      orderedProviders.push({ name: "Lumo", run: () => generateWithLumo(prompt, mode) });
    }
    if (kimiApiKey) {
      orderedProviders.push({ name: "Kimi", run: () => generateWithKimi(prompt, mode) });
    }
    if (geminiApiKey) {
      orderedProviders.push({
        name: "Gemini",
        run: async () => {
          const text = await generateWithGemini(prompt, mode);
          if (!text) throw new Error("Gemini returned no usable content.");
          return text;
        }
      });
    }
    if (openrouterApiKey) {
      orderedProviders.push({ name: "OpenRouter", run: () => generateWithOpenRouter(prompt, mode) });
    }
  }

  let lastError: unknown = null;
  for (const candidate of orderedProviders) {
    try {
      console.log(`[${candidate.name}] Generating report in ${mode} mode.`);
      return await candidate.run();
    } catch (err) {
      lastError = err;
      console.warn(`[${candidate.name}] Provider failed: ${summarizeProviderError(err)}`);
      if (candidate.name !== "OpenRouter" && !isAuthenticationError(err) && !isNetworkOrTransientProviderError(err)) {
        continue;
      }
    }
  }

  if (lastError) {
    if (isAuthenticationError(lastError)) {
      throw new ProviderUnavailableError("Configured AI provider rejected the credentials. Using stored context fallback.");
    }
    if (isNetworkOrTransientProviderError(lastError)) {
      throw new ProviderUnavailableError("AI provider network or transient failure. Using stored context fallback.");
    }
    throw lastError;
  }

  throw new ProviderUnavailableError("AI provider failed or is not available. Using stored context fallback.");
}


export function detectEarlyDomain(columns: string[], rows: Record<string, unknown>[] = []): string {
  const cols = columns.map((c) => c.toLowerCase());
  const textRows = rows.slice(0, 20).map((row) => Object.values(row).join(" ").toLowerCase());
  const combinedText = textRows.join(" ");
  const keywords = {
    Finance: ["revenue", "profit", "cost", "price", "amount", "transaction", "balance", "cash", "income"],
    "E-commerce": ["product", "sku", "qty", "quantity", "order", "shipping", "cart", "customer", "checkout"],
    "Retail Inventory": ["inventory", "stock", "warehouse", "reorder", "on_hand", "brand", "category", "store"],
    Healthcare: ["patient", "diagnosis", "doctor", "treatment", "clinic", "medical", "hospital"],
    Logistics: ["origin", "destination", "tracking", "vessel", "warehouse", "delivery", "shipment"],
    "IoT/Sensor": ["temperature", "humidity", "pressure", "sensor", "device", "reading", "telemetry"],
    "Streaming/Media": ["title", "movie", "show", "series", "episode", "season", "director", "cast", "genre", "listed_in", "duration", "rating", "watch", "view", "play"]
  };

  const scoreDomains = Object.entries(keywords).map(([domain, keys]) => {
    const matchCount = keys.filter((k) => cols.some((c) => c.includes(k)) || combinedText.includes(k)).length;
    return { domain, score: matchCount };
  });

  const best = scoreDomains.sort((a, b) => b.score - a.score)[0];
  if (best && best.score >= 2) return best.domain;

  if (cols.some((c) => /(title|show|movie|episode|season|director|cast|genre|duration|rating)/.test(c)) || /\b(movie|show|series|episode|season|director|cast|genre|duration|rating)\b/.test(combinedText)) {
    return "Streaming/Media";
  }

  return "General Operations";
}

function normalizeTextList(value: unknown, max = 7): string[] {
  if (!Array.isArray(value)) return [];
  const deduped = new Set<string>();
  for (const item of value) {
    const txt = String(item ?? "").replace(/\s+/g, " ").trim();
    if (!txt) continue;
    deduped.add(txt);
    if (deduped.size >= max) break;
  }
  return [...deduped];
}

export function extractJsonObject(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] || text;

  const firstBrace = candidate.indexOf("{");
  if (firstBrace === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = firstBrace; i < candidate.length; i++) {
    const char = candidate[i];

    if (inString) {
      if (escape) {
        escape = false;
      } else if (char === "\\") {
        escape = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return candidate.slice(firstBrace, i + 1);
      }
    }
  }

  return null;
}

function inferTrendNarrative(summary: AggregatedSummary): string {
  if (summary.trends.length < 2) return "Trend signal is limited due to insufficient time-series points.";

  const first = summary.trends[0].value;
  const last = summary.trends[summary.trends.length - 1].value;
  if (first === 0) return "Trend signal is present but baseline starts at zero, so growth rate is unstable.";

  const changePct = ((last - first) / Math.abs(first)) * 100;
  if (changePct > 8) return `Momentum is improving (+${changePct.toFixed(1)}% over the observed period).`;
  if (changePct < -8) return `Performance is declining (${changePct.toFixed(1)}% over the observed period).`;
  return `Performance appears relatively stable (${changePct.toFixed(1)}% change across the observed period).`;
}

function buildDeterministicInsights(summary: AggregatedSummary, userPrompt?: string): InsightPayload {
  const primaryMetric = summary.domainInfo.suggestedKPIs[0] || "primary metric";
  const topDimension = summary.topEntries[0];
  const anomalyReasons = normalizeTextList(summary.anomalies.map((a) => a.reason), 4);
  const trendNarrative = inferTrendNarrative(summary);

  const keyInsights: string[] = [
    `${summary.totalRecords.toLocaleString()} records were analyzed for this report.`,
    trendNarrative
  ];

  if (typeof summary.primaryMetricTotal === "number") {
    keyInsights.push(
      `Total ${primaryMetric} across the dataset is ${summary.primaryMetricTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}.`
    );
  }

  if (topDimension?.items?.length) {
    const leaders = topDimension.items
      .slice(0, 3)
      .map((i) => `${i.name} (${i.value.toLocaleString()})`)
      .join(", ");
    keyInsights.push(`Top ${topDimension.column} segments: ${leaders}.`);
  }

  if (!keyInsights.length) {
    keyInsights.push("Dataset profile is available, but there are limited high-confidence signals in the current data.");
  }

  const risks = [
    ...anomalyReasons,
    ...(summary.totalRecords < 50 ? ["Small sample size may reduce confidence in directional conclusions."] : [])
  ].slice(0, 5);

  const recommendations = [
    userPrompt?.trim()
      ? `Make the next decision around your goal: ${userPrompt.trim()}. Focus on the highest-impact metric first.`
      : "Pick one KPI as the decision metric and review it weekly so leadership can react quickly to changes.",
    topDimension?.column
      ? `Investigate the top ${topDimension.column} segments first; they appear to be the main driver of performance and should be protected or scaled.`
      : "Segment the data by the biggest dimensions so leaders can see where the signal is coming from.",
    anomalyReasons.length
      ? "Validate anomaly periods before you act on forecasts so the team does not overreact to noise."
      : "Set threshold-based alerts so unusual movement is visible before it turns into a bigger issue."
  ].slice(0, 4);

  const opportunities = [
    topDimension?.items?.[0]
      ? `Replicate the winning pattern in ${topDimension.items[0].name} across lower-performing segments to lift the whole portfolio.`
      : "Turn the strongest observed patterns into repeatable playbooks that can be reused across teams.",
    summary.domainInfo.suggestedKPIs.length > 1
      ? `Create an executive KPI stack around ${summary.domainInfo.suggestedKPIs.slice(0, 2).join(" and ")} so decisions are grounded in the same numbers.`
      : "Add supporting KPIs to make the story easier for leadership to understand and act on."
  ];

  const alerts = anomalyReasons.length ? anomalyReasons : ["No critical statistical anomalies were detected in the summarized data."];

  const trends = summary.trends
    .slice(-6)
    .map((t) => `${t.label}: ${t.value.toLocaleString(undefined, { maximumFractionDigits: 2 })} (${t.metric})`);

  return {
    executiveSummary: `Reviewed ${summary.totalRecords.toLocaleString()} records for ${summary.domainInfo.name}. ${trendNarrative} The implication is clear: focus attention on the strongest drivers, confirm anomalies, and act on the next best opportunity before momentum changes.`,
    keyInsights,
    recommendations,
    risks,
    opportunities,
    alerts,
    trends
  };
}

function sanitizeInsightPayload(raw: unknown, summary: AggregatedSummary, userPrompt?: string): InsightPayload {
  const fallback = buildDeterministicInsights(summary, userPrompt);
  if (!raw || typeof raw !== "object") return fallback;

  const value = raw as Record<string, unknown>;
  const executiveSummary = String(value.executiveSummary || "").trim() || fallback.executiveSummary;

  const keyInsights = normalizeTextList(value.keyInsights, 6);
  const recommendations = normalizeTextList(value.recommendations, 5);
  const risks = normalizeTextList(value.risks, 5);
  const opportunities = normalizeTextList(value.opportunities, 5);
  const alerts = normalizeTextList(value.alerts, 6);
  const trends = normalizeTextList(value.trends, 7);

  return {
    executiveSummary,
    keyInsights: keyInsights.length ? keyInsights : fallback.keyInsights,
    recommendations: recommendations.length ? recommendations : fallback.recommendations,
    risks: risks.length ? risks : fallback.risks,
    opportunities: opportunities.length ? opportunities : fallback.opportunities,
    alerts: alerts.length ? alerts : fallback.alerts,
    trends: trends.length ? trends : fallback.trends
  };
}

function heuristicGenericInsights(
  rows: Record<string, unknown>[],
  profile: any,
  userPrompt?: string
): InsightPayload & { domainColor?: string; domainEmoji?: string; domainName?: string } {
  const rowCount = rows.length;
  // The profiler exposes column objects; domain detection needs their names.
  const columnNames = Array.isArray(profile?.columns)
    ? profile.columns.map((column: unknown) => typeof column === "string" ? column : String((column as { name?: unknown })?.name || ""))
    : [];
  const domainName = detectEarlyDomain(columnNames, rows);
  const meta = profile?.metadata || {};

  const topCategory = profile?.categoricalBreakdown?.[0];
  const topCategoryItems = Array.isArray(topCategory?.items) ? topCategory.items.slice(0, 3) : [];
  const numericLeads = Array.isArray(profile?.numericSummary) ? profile.numericSummary.slice(0, 3) : [];
  const timeSeries = Array.isArray(profile?.timeSeries) ? profile.timeSeries : [];

  const mainMetric = meta.topDriver?.metric || numericLeads[0]?.column || "Volume";
  const driverCol = meta.topDriver?.dimension || topCategory?.column || "Category";

  let trendMessage = "Temporal analysis is limited; add a date/time column for velocity tracking.";
  if (timeSeries.length >= 2) {
    const first = Number(timeSeries[0]?.value || 0);
    const last = Number(timeSeries[timeSeries.length - 1]?.value || 0);
    const pct = first === 0 ? 0 : ((last - first) / Math.abs(first)) * 100;
    trendMessage = `Observed performance for ${mainMetric} moved ${pct >= 0 ? "up" : "down"} by ${Math.abs(pct).toFixed(1)}% over the latest reporting cycle.`;
  }

  const executiveSummary = `Comprehensive ${domainName} review across ${rowCount.toLocaleString()} transactions. ` +
    (meta.topDriver 
      ? `Analysis indicates that ${meta.topDriver.topSegment} (${meta.topDriver.dimension}) is the primary driver, accounting for ${meta.topDriver.concentration.toFixed(1)}% of total observed volume. ` 
      : `Broad dataset distribution detected with primary focus on ${mainMetric}. `) +
    trendMessage;

  return {
    domainName,
    domainEmoji: "📉",
    domainColor: "#0ea5e9",
    executiveSummary,
    keyInsights: [
      `Total throughput: ${rowCount.toLocaleString()} business events captured across ${profile?.columnCount || 0} dimensions.`,
      meta.topDriver 
        ? `High concentration detected: ${meta.topDriver.topSegment} dominates the ${meta.topDriver.dimension} landscape with ${meta.topDriver.concentration.toFixed(1)}% share.`
        : `Primary categorical influence stems from ${driverCol}, led by ${topCategoryItems.map((i: any) => i.name).join(", ")}.`,
      numericLeads.length
        ? `Statistical Baseline: ${numericLeads.map((n: any) => `${n.column} normalized avg is ${Number(n.avg).toLocaleString(undefined, { maximumFractionDigits: 1 })}`).join(" | ")}.`
        : "Numeric volatility is dispersed across the dataset.",
      trendMessage
    ],
    recommendations: [
      userPrompt?.trim()
        ? `ACTION: Align secondary metrics to the specific goal: "${userPrompt.trim()}".`
        : "ACTION: Establish a baseline for the top segments and track variance weekly.",
      `STRATEGY: Scale operations in ${topCategoryItems[0]?.name || "top segments"} while investigating mid-tier churn.`,
      "HYPOTHESIS: Validate if recent shift in " + mainMetric + " is tied to specific external events or data entry lags."
    ],
    risks: [
      rowCount < 200 ? "WARNING: Low data density may produce unstable directional signals." : "STABILITY: Monitor outlier variance in " + mainMetric + " to prevent forecasting bias.",
      "COMPLIANCE: Verify data integrity for " + (columnNames[0] || "primary columns") + " before executive sign-off."
    ],
    opportunities: [
      meta.topDriver
        ? `GROWTH: Expand ${meta.topDriver.topSegment} strategies to adjacent segments in the ${meta.topDriver.dimension} group.`
        : "EFFICIENCY: Optimize the long-tail segments to improve overall average performance.",
      "AUTOMATION: Implement real-time threshold alerts for " + mainMetric + " to reduce reaction time to market shifts."
    ],
    alerts: ["This report reflects a point-in-time heuristic profile. Professional data audit recommended for fiscal decisions."],
    trends: [trendMessage]
  };
}

export async function generateInsights(summary: AggregatedSummary, userPrompt?: string): Promise<InsightPayload> {
  if (!hasProviderCredentials()) return buildDeterministicInsights(summary, userPrompt);

  const prompt = `
You are the Chief Information Officer (CIO) providing a high-stakes strategic briefing to the Board of Directors.
Your analysis must be sharp, evidence-backed, and immediately actionable.

Domain: ${summary.domainInfo.name}
Metadata: ${summary.domainInfo.description}
User Strategic Objective: "${userPrompt || "Produce a high-fidelity roadmap for growth and risk mitigation."}"

DATA CONTEXT:
${JSON.stringify(summary, null, 2)}

BOARDROOM DELIVERY RULES:
1) **Lead with Numbers**: Every insight MUST start with a hard numeric fact (e.g., "$2.4M in total concentration..." or "14% period decline...").
2) **Decision-Ready**: Each bullet must explain what changed, why it matters, and what action should follow.
3) **Logic Chain**: Use the 'Observation -> Impact -> Action' structure for every bullet.
4) **Eliminate Fluff**: Do not say "Analysis shows" or "It is important to note." Speak decisively.
5) **Strategic Impact**: Focus on revenue, risk exposure, and operational efficiency.
6) **Format**: Return ONLY valid JSON.

Schema:
{
  "executiveSummary": "A dense, 3-sentence strategic narrative. Focus on the 'So What?'.",
  "keyInsights": ["Factual Bullet with Reason & Impact"],
  "recommendations": ["Direct Strategic Actions"],
  "risks": ["Financial or Operational Exposure Points"],
  "opportunities": ["Growth or Efficiency Deltas identified in the data"],
  "alerts": ["Critical Threshold violations"],
  "trends": ["Velocity and Directional signals with specific percentages"]
}
`.trim();


  try {
    const text = await generateWithModelFallback("analysis", prompt);
    const json = extractJsonObject(text);
    if (!json) return buildDeterministicInsights(summary, userPrompt);

    const parsed = JSON.parse(json);
    return sanitizeInsightPayload(parsed, summary, userPrompt);
  } catch (err) {
    console.warn("Groq Insight fallback activated:", summarizeProviderError(err));
    return buildDeterministicInsights(summary, userPrompt);
  }
}

export async function generateGenericInsights(
  rows: Record<string, unknown>[],
  profile: any,
  userPrompt?: string
): Promise<InsightPayload & { domainColor?: string; domainEmoji?: string; domainName?: string }> {
  if (!rows.length) {
    return heuristicGenericInsights(rows, profile, userPrompt);
  }

  if (!hasProviderCredentials()) {
    return heuristicGenericInsights(rows, profile, userPrompt);
  }

  // Build a bounded, column-limited, and truncated sample to avoid prompt overflow
  const maxCols = Math.min(Array.isArray(profile?.columns) ? profile.columns.length : Object.keys(rows[0] || {}).length, 30);
  const columns = Array.isArray(profile?.columns) && profile.columns.length
    ? profile.columns.slice(0, maxCols)
    : Object.keys(rows[0] || {}).slice(0, maxCols);

  const truncateCell = (v: unknown, maxLen = 150) => {
    if (v === null || v === undefined) return v;
    if (typeof v === "string") return v.length > maxLen ? `${v.slice(0, maxLen - 3)}...` : v;
    return v;
  };

  let rowsToInclude = Math.min(100, rows.length);
  let sampleObj = rows.slice(0, rowsToInclude).map((r) =>
    Object.fromEntries(columns.map((c: string) => [c, truncateCell(r[c])]))
  );
  let serialized = JSON.stringify(sampleObj, null, 2);
  const maxChars = 32000; // rough guard against token overflow
  while (serialized.length > maxChars && rowsToInclude > 5) {
    rowsToInclude = Math.max(5, Math.floor(rowsToInclude * 0.6));
    sampleObj = rows.slice(0, rowsToInclude).map((r) =>
      Object.fromEntries(columns.map((c: string) => [c, truncateCell(r[c])]))
    );
    serialized = JSON.stringify(sampleObj, null, 2);
  }

  if (rowsToInclude < Math.min(100, rows.length)) {
    console.warn(`[AI] Reduced generic sample to ${rowsToInclude} rows (approx ${serialized.length} chars) to avoid prompt overflow.`);
  }

  const sample = serialized;

  const metadata = JSON.stringify(
    {
      columns: columns,
      numericSummary: profile.numericSummary?.slice?.(0, 30) || [],
      categoricalBreakdown: profile.categoricalBreakdown?.slice?.(0, 12) || [],
      timeSeriesPreview: profile.timeSeries?.slice?.(-20) || [],
      extractedMetadata: profile.metadata || {}
    },
    null,
    2
  );

  const prompt = `
You are a Senior Strategic Analyst. Produce a high-fidelity business intelligence brief from the provided dataset profile.

METADATA & STATISTICAL PROFILE:
${metadata}

DATA SAMPLE (Top 100 rows):
${sample}

USER FOCUS: "${userPrompt || "Discover high-impact business drivers."}"

TASKS:
1) Infer the Business Domain (e.g. FinTech, Global Logistics, Inventory Management).
2) Executive Summary: Write a concise, decision-ready narrative for leadership. Make it clear what is changing, why it matters, and what should happen next.
3) Key Insights: 4-6 evidence-backed findings. MUST include numeric values from the profile and each should explain the business implication.
4) Strategic roadmap: Specific operational suggestions based on the identified segments, with clear owners and likely business impact.

FORMAT: Return ONLY JSON.

Schema:
{
  "domainName": "Business vertical name",
  "domainEmoji": "Single emoji",
  "domainColor": "Hex code (vibrant)",
  "executiveSummary": "Narrative",
  "keyInsights": ["Point 1...", "Point 2..."],
  "recommendations": ["..."],
  "risks": ["..."],
  "opportunities": ["..."],
  "alerts": ["..."],
  "trends": ["..."]
}
`.trim();


  try {
    const text = await generateWithModelFallback("analysis", prompt);
    const json = extractJsonObject(text);
    if (!json) {
      console.error("AI did not return parsable JSON for generic insights. Sample rows included:", rowsToInclude, "rows; prompt chars:", prompt.length);
      console.error("LLM response snippet:", String(text).slice(0, 800));
      throw new Error("No JSON found");
    }

    const parsed = JSON.parse(json) as Record<string, unknown>;
    const fallback = heuristicGenericInsights(rows, profile, userPrompt);

    return {
      ...sanitizeInsightPayload(
        parsed,
        {
          totalRecords: rows.length,
          uniqueValues: {},
          topEntries: [],
          trends: [],
          anomalies: [],
          domainInfo: {
            name: String(parsed.domainName || fallback.domainName || "General Operations"),
            description: "AI-generated generic profile analysis",
            suggestedKPIs: []
          }
        },
        userPrompt
      ),
      domainName: String(parsed.domainName || fallback.domainName || "General Operations"),
      domainEmoji: String(parsed.domainEmoji || fallback.domainEmoji || "📈"),
      domainColor: String(parsed.domainColor || fallback.domainColor || "#0ea5e9")
    };
  } catch (err) {
    console.warn("[AI] Generic deterministic fallback activated:", summarizeProviderError(err));
    return heuristicGenericInsights(rows, profile, userPrompt);
  }
}

function heuristicIntentFromPrompt(
  userPrompt: string,
  metadata: { categories: string[]; products: string[] }
): { isFiltered: boolean; categories?: string[]; products?: string[]; searchQuery?: string } {
  const prompt = userPrompt.toLowerCase();
  const categories = metadata.categories.filter((c) => prompt.includes(c.toLowerCase()));
  const products = metadata.products.filter((p) => prompt.includes(p.toLowerCase()));

  const quoted = userPrompt.match(/"([^"]+)"|'([^']+)'/g)?.[0]?.replace(/^['"]|['"]$/g, "");
  const hasFilterCue = /\b(only|for|where|filter|segment|category|product|item|sku)\b/i.test(userPrompt);

  return {
    isFiltered: Boolean(categories.length || products.length || quoted || hasFilterCue),
    categories: categories.length ? categories : undefined,
    products: products.length ? products : undefined,
    searchQuery: quoted || undefined
  };
}

export async function parseAnalysisIntent(
  userPrompt: string,
  metadata: { categories: string[]; products: string[] }
): Promise<{ isFiltered: boolean; categories?: string[]; products?: string[]; searchQuery?: string }> {
  const { provider } = getProviderConfig();

  if (!userPrompt.trim()) return { isFiltered: false };
  if (provider === "none") return heuristicIntentFromPrompt(userPrompt, metadata);

  const prompt = `
Analyze the user's intent for a dataset query.

Available categories: [${metadata.categories.slice(0, 60).join(", ")}]
Top products/items: [${metadata.products.slice(0, 60).join(", ")}]
User prompt: "${userPrompt}"

Return ONLY JSON:
{ "isFiltered": boolean, "categories": string[], "products": string[], "searchQuery": string | null }
`.trim();

  try {
    const text = await generateWithModelFallback("fast", prompt);
    const json = extractJsonObject(text);
    if (!json) return heuristicIntentFromPrompt(userPrompt, metadata);

    const parsed = JSON.parse(json) as {
      isFiltered?: boolean;
      categories?: unknown;
      products?: unknown;
      searchQuery?: unknown;
    };

    const matchedCategories = normalizeTextList(parsed.categories, 12).filter((c) =>
      metadata.categories.some((m) => m.toLowerCase() === c.toLowerCase())
    );
    const matchedProducts = normalizeTextList(parsed.products, 20).filter((p) =>
      metadata.products.some((m) => m.toLowerCase() === p.toLowerCase())
    );
    const searchQuery = typeof parsed.searchQuery === "string" ? parsed.searchQuery.trim() : undefined;

    const isFiltered =
      Boolean(parsed.isFiltered) ||
      matchedCategories.length > 0 ||
      matchedProducts.length > 0 ||
      Boolean(searchQuery);

    return {
      isFiltered,
      categories: matchedCategories.length ? matchedCategories : undefined,
      products: matchedProducts.length ? matchedProducts : undefined,
      searchQuery: searchQuery || undefined
    };
  } catch {
    return heuristicIntentFromPrompt(userPrompt, metadata);
  }
}
