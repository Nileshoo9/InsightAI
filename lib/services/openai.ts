import { AggregatedSummary, InsightPayload } from "@/lib/types";
import Groq from "groq-sdk";

const groqApiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || "";
const groq = new Groq({ apiKey: groqApiKey });

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

function summarizeProviderError(err: unknown): string {
  if (!err || typeof err !== "object") return "Unknown provider error";
  const maybeErr = err as { status?: unknown; statusText?: unknown; message?: unknown; error?: { message?: string } };
  const status = maybeErr.status ? String(maybeErr.status) : "n/a";
  const statusText = typeof maybeErr.statusText === "string" ? maybeErr.statusText : "unknown";
  const message = maybeErr.error?.message || (typeof maybeErr.message === "string" ? maybeErr.message : "no message");
  return `status=${status}, statusText=${statusText}, message=${message.slice(0, 280)}`;
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
  const models = candidateModels(mode);
  let lastError: unknown;

  if (!groqApiKey) {
    console.error("[Groq] API key is missing");
    throw new Error("Groq API key is missing. Please check your environment variables.");
  }

  console.log(`[Groq] Generating in ${mode} mode with models: ${models.join(", ")}`);

  for (const modelName of models) {
    try {
      console.log(`[Groq] Attempting ${modelName}...`);
      const completion = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: modelName,
        temperature: 0.1,
        max_tokens: 4096,
      });
      
      const content = completion.choices[0]?.message?.content || "";
      if (content) {
        console.log(`[Groq] Success with ${modelName}`);
        return content;
      }
      console.warn(`[Groq] Empty response from ${modelName}`);
    } catch (err) {
      lastError = err;
      const summary = summarizeProviderError(err);
      console.error(`[Groq] Failed with ${modelName}: ${summary}`);
      
      if (isModelNotFoundError(err)) {
        console.warn(`[Groq] Model unavailable (${modelName}). Trying fallback...`);
        continue;
      }
      if (isQuotaOrRateLimitError(err)) {
        console.warn(`[Groq] Rate-limited (${modelName}). Trying fallback...`);
        continue;
      }
      // Re-throw if it's not a fallback-worthy error
      throw err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("No available Groq models responded successfully.");
}


function detectEarlyDomain(columns: string[]): string {
  const cols = columns.map((c) => c.toLowerCase());
  const keywords = {
    Finance: ["revenue", "profit", "cost", "price", "amount", "transaction", "balance"],
    "E-commerce": ["product", "sku", "qty", "quantity", "order", "shipping", "cart"],
    "Retail Inventory": ["inventory", "stock", "brand", "rating", "warehouse", "reorder", "on_hand", "category"],
    Healthcare: ["patient", "diagnosis", "doctor", "treatment", "clinic", "medical"],
    Logistics: ["origin", "destination", "tracking", "vessel", "warehouse", "delivery"],
    "IoT/Sensor": ["temperature", "humidity", "pressure", "sensor", "device", "reading"],
    "Streaming/Media": ["watch", "view", "play", "title", "rating", "episode", "season"]
  };

  for (const [domain, keys] of Object.entries(keywords)) {
    if (keys.some((k) => cols.some((c) => c.includes(k)))) return domain;
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
      ? `Prioritize decisions tied to your goal: ${userPrompt.trim()}.`
      : "Prioritize one KPI and track it weekly to validate trend direction.",
    topDimension?.column
      ? `Run a deep-dive on the top ${topDimension.column} segments to identify what drives variance.`
      : "Segment the dataset by major dimensions (category, region, or customer type) for clearer root-cause analysis.",
    anomalyReasons.length
      ? "Investigate anomaly periods before acting on forecasts to avoid distorted decisions."
      : "Create threshold alerts to detect sudden spikes or drops earlier."
  ].slice(0, 4);

  const opportunities = [
    topDimension?.items?.[0]
      ? `Scale what is working in ${topDimension.items[0].name}, then replicate the pattern in mid-tier segments.`
      : "Identify repeatable patterns among top-performing rows and turn them into operating playbooks.",
    summary.domainInfo.suggestedKPIs.length > 1
      ? `Build a KPI stack around ${summary.domainInfo.suggestedKPIs.slice(0, 2).join(" and ")} for stronger executive visibility.`
      : "Add supporting KPIs to improve explainability for leadership decisions."
  ];

  const alerts = anomalyReasons.length ? anomalyReasons : ["No critical statistical anomalies were detected in the summarized data."];

  const trends = summary.trends
    .slice(-6)
    .map((t) => `${t.label}: ${t.value.toLocaleString(undefined, { maximumFractionDigits: 2 })} (${t.metric})`);

  return {
    executiveSummary: `Analyzed ${summary.totalRecords.toLocaleString()} records for ${summary.domainInfo.name}. ${trendNarrative}`,
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
  const domainName = detectEarlyDomain(profile?.columns || []);
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
      "COMPLIANCE: Verify data integrity for " + (profile.columns[0] || "primary columns") + " before executive sign-off."
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
  if (!groqApiKey) return buildDeterministicInsights(summary, userPrompt);

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
2) **Logic Chain**: Use the 'Observation -> Impact -> Action' structure for every bullet.
3) **Eliminate Fluff**: Do not say "Analysis shows" or "It is important to note." Speak decisively.
4) **Strategic Impact**: Focus on revenue, risk exposure, and operational efficiency.
5) **Format**: Return ONLY valid JSON.

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

  if (!groqApiKey) {
    return heuristicGenericInsights(rows, profile, userPrompt);
  }

  const sample = JSON.stringify(rows.slice(0, 100), null, 2);
  const metadata = JSON.stringify({
      columns: profile.columns,
      numericSummary: profile.numericSummary,
      categoricalBreakdown: profile.categoricalBreakdown,
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
2) Executive Summary: High-level narrative for Board review. 
3) Key Insights: 4-6 evidence-backed findings. MUST include numeric values from the profile.
4) Strategic roadmap: Specific operational suggestions based on the identified segments.

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
    if (!json) throw new Error("No JSON found");

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
    console.warn("Groq Generic fallback activated:", summarizeProviderError(err));
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
  if (!userPrompt.trim()) return { isFiltered: false };
  if (!groqApiKey) return heuristicIntentFromPrompt(userPrompt, metadata);

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
