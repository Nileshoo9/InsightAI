import { GoogleGenerativeAI } from "@google/generative-ai";
import type { InsightPayload } from "@/lib/types";

const DEFAULT_MODELS = ["gemini-3.6-flash"];

function configuredModels() {
  const configured = process.env.GEMINI_MODEL?.trim();
  return [...new Set([configured, ...DEFAULT_MODELS].filter(
    (model): model is string => {
      if (!model) return false;
      return model === "gemini-3.6-flash";
    }
  ))];
}
function isExpectedProviderFailure(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return /\b(400|401|403|404|408|429|500|502|503)\b|api key|quota|rate limit|timeout|timed out|network|fetch|model.*not found/.test(message);
}

export async function generateAIInsights(context: Record<string, unknown>): Promise<InsightPayload | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;

  const prompt = `You are an analytical writing assistant. Interpret the supplied deterministic dataset analysis.
Never invent metrics, rename columns, or change the detected domain. Return only valid JSON with these arrays:
{"executiveSummary":"string","keyInsights":["string"],"recommendations":["string"],"risks":["string"],"opportunities":["string"],"alerts":["string"],"trends":["string"]}

ANALYSIS CONTEXT:
${JSON.stringify(context)}`;

  try {
    const client = new GoogleGenerativeAI(apiKey);
    for (const modelName of configuredModels()) {
      try {
        const model = client.getGenerativeModel({ model: modelName });
        const result = await Promise.race([
          model.generateContent(prompt),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Gemini request timed out")), 20_000))
        ]);
        const text = result.response.text().trim();
        const json = text.match(/\{[\s\S]*\}/)?.[0];
        if (!json) continue;
        const parsed = JSON.parse(json) as Record<string, unknown>;
        const list = (value: unknown) => Array.isArray(value) ? value.map(String).filter(Boolean).slice(0, 7) : [];
        if (!String(parsed.executiveSummary || "").trim()) continue;
        return {
          executiveSummary: String(parsed.executiveSummary),
          keyInsights: list(parsed.keyInsights),
          recommendations: list(parsed.recommendations),
          risks: list(parsed.risks),
          opportunities: list(parsed.opportunities),
          alerts: list(parsed.alerts),
          trends: list(parsed.trends)
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "provider error";
        if (modelName === configuredModels().at(-1)) console.warn("Gemini insight enrichment unavailable:", message);
          if (!isExpectedProviderFailure(error)) throw error;
      }
    }
    return null;
  } catch (error) {
    if (!isExpectedProviderFailure(error)) throw error;
    console.warn("Gemini insight enrichment unavailable:", error instanceof Error ? error.message : "provider error");
    return null;
  }
}