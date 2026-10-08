export type IndustryDomain =
  | "Sales & Retail"
  | "Finance & Banking"
  | "Healthcare"
  | "Education"
  | "Human Resources"
  | "Marketing & Customer"
  | "Logistics & Supply Chain"
  | "Manufacturing & Operations"
  | "IoT & Sensors"
  | "Media & Entertainment"
  | "Real Estate"
  | "General Analytics";

export interface DomainDetectionResult {
  domain: IndustryDomain;
  confidence: number;
  matchedSignals: string[];
  objective: string;
  ranked: { domain: IndustryDomain; score: number }[];
}

const DOMAIN_RULES: Record<IndustryDomain, string[]> = {
  "Sales & Retail": ["sales", "revenue", "order", "product", "sku", "quantity", "qty", "cart", "discount", "unit_price", "selling_price", "purchase", "orders_total", "net_sales", "revenue_total"],
  "Finance & Banking": ["account", "balance", "transaction", "debit", "credit", "loan", "interest", "payment", "portfolio", "investment", "profit", "expense", "income", "cashflow", "cash_flow", "ledger", "liquidity", "liquidity_ratio", "invoice", "invoice_total", "payroll", "working_capital", "debt_coverage", "net_income", "profit_margin", "financial", "bank", "risk_score", "balance_sheet"],
  Healthcare: ["patient", "diagnosis", "symptom", "disease", "treatment", "doctor", "physician", "hospital", "clinic", "medication", "admission", "discharge", "blood", "heart_rate", "provider", "encounter", "care_plan", "readmission", "outcome", "clinical", "episode", "procedure"],
  Education: ["student", "studentid", "student_name", "grade", "marks", "score", "math", "mathematics", "biology", "physics", "chemistry", "english", "gpa", "cgpa", "course", "subject", "teacher", "attendance", "absence", "exam", "pass", "fail", "semester", "term", "class", "faculty", "department", "school", "college", "university", "academic", "enrollment", "programme", "course_name", "attendance_rate", "exam_score"],
  "Human Resources": ["employee", "salary", "designation", "job_title", "hire_date", "termination", "attrition", "performance", "manager", "tenure", "leave", "bonus", "benefits", "headcount", "payroll", "compensation", "team", "workforce", "retention"],
  "Marketing & Customer": ["campaign", "lead", "conversion", "click", "impression", "ctr", "engagement", "channel", "customer", "segment", "churn", "retention", "acquisition", "lifetime_value", "audience", "marketing"],
  "Logistics & Supply Chain": ["shipment", "tracking", "delivery", "carrier", "warehouse", "supplier", "freight", "route", "origin", "destination", "dispatch", "inventory", "stock", "fulfillment", "warehouse_movement", "on_time_delivery", "transfer"],
  "Manufacturing & Operations": ["machine", "production", "defect", "downtime", "quality", "factory", "batch", "cycle", "output", "maintenance", "work_order", "yield", "throughput", "line", "efficiency"],
  "IoT & Sensors": ["sensor", "device", "temperature", "humidity", "pressure", "voltage", "reading", "telemetry", "accelerometer", "battery", "signal", "reading_value", "device_id"],
  "Media & Entertainment": ["movie", "film", "show", "episode", "stream", "watch", "view", "rating", "genre", "duration", "subscriber", "playlist", "channel", "audience"],
  "Real Estate": ["property", "listing", "bedroom", "bathroom", "rent", "mortgage", "square_feet", "area", "agent", "listing_price", "location", "occupancy", "square_footage"],
  "General Analytics": []
};

const GENERIC_STOP_WORDS = new Set([
  "id", "date", "time", "timestamp", "name", "description", "status", "type", "code", "number", "value"
]);

function normalize(value: unknown): string {
  return String(value ?? "").toLowerCase().trim().replace(/[\s_-]+/g, " ");
}

function compact(value: string) {
  return value.replace(/\s+/g, "");
}

function tokenScore(column: unknown, keywords: readonly unknown[]) {
  const c = normalize(column);
  const compactColumn = compact(c);

  return keywords.reduce<number>((score, keyword) => {
    const k = normalize(keyword);
    if (!k) return score;
    const compactKeyword = compact(k);
    if (c === k || compactColumn === compactKeyword) return score + 5;
    if (c.includes(k) || compactColumn.includes(compactKeyword)) return score + 2;
    return score;
  }, 0);
}

export function detectIndustryDomain(columns: unknown[], sampleRows: Record<string, unknown>[] = []): DomainDetectionResult {
  const validRows = sampleRows.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
  const ranked = Object.entries(DOMAIN_RULES).map(([domain, keywords]): { domain: IndustryDomain; score: number } => {
    let score = columns.reduce<number>((sum, column) => sum + tokenScore(column, keywords), 0);

    // A small amount of value-level evidence helps distinguish ambiguous schemas.
    for (const row of validRows.slice(0, 30)) {
      for (const [column, value] of Object.entries(row)) {
        if (value === null || value === undefined) continue;
        const text = String(value).toLowerCase();
        const columnScore = tokenScore(column, keywords);
        if (columnScore === 0) continue;
        if (keywords.some((k) => text.includes(k.replace(/_/g, " ")))) score += 0.75;
      }
    }

    return { domain: domain as IndustryDomain, score };
  }).sort((a, b) => b.score - a.score);

  const winner = ranked[0];
  const second = ranked[1];
  const totalEvidence = columns.filter((c) => !GENERIC_STOP_WORDS.has(normalize(c))).length;
  const rawConfidence = winner.score <= 0
    ? 0
    : Math.min(0.99, 0.45 + Math.min(0.45, winner.score / Math.max(8, totalEvidence * 3)) + (winner.score - (second?.score || 0) > 4 ? 0.08 : 0));
  const confidence = rawConfidence < 0.58 || winner.score - (second?.score || 0) < 2 ? 0.25 : rawConfidence;
  const domain = confidence === 0.25 ? "General Analytics" : winner.domain;
  const signals = columns
    .filter((column): column is string => typeof column === "string" && tokenScore(column, DOMAIN_RULES[domain]) > 0);
  const language = getDomainLanguage(domain);

  return {
    domain,
    confidence: Number(confidence.toFixed(2)),
    matchedSignals: signals,
    objective: language.objective,
    ranked: ranked.slice(0, 5)
  };
}

export function getDomainLanguage(domain: IndustryDomain) {
  const copy: Record<IndustryDomain, { label: string; objective: string; kpis: string[] }> = {
    "Sales & Retail": { label: "Sales & Retail Analytics", objective: "Revenue, demand, product and customer performance", kpis: ["Revenue", "Orders", "Units", "Average Order Value"] },
    "Finance & Banking": { label: "Financial Analytics", objective: "Financial performance, exposure and transaction behavior", kpis: ["Transaction Value", "Average Value", "Balance", "Profit"] },
    Healthcare: { label: "Healthcare Analytics", objective: "Patient, clinical, operational and outcome patterns", kpis: ["Patients", "Clinical Volume", "Average Value", "Outcome Rate"] },
    Education: { label: "Education Analytics", objective: "Analyze student academic performance, attendance, and outcomes.", kpis: ["Students", "Average Score", "Attendance", "Pass Rate"] },
    "Human Resources": { label: "Workforce Analytics", objective: "Workforce composition, performance, retention and compensation", kpis: ["Employees", "Average Salary", "Tenure", "Attrition"] },
    "Marketing & Customer": { label: "Marketing & Customer Analytics", objective: "Acquisition, engagement, conversion, retention and customer value", kpis: ["Leads", "Conversion", "Engagement", "Retention"] },
    "Logistics & Supply Chain": { label: "Supply Chain Analytics", objective: "Flow, delivery, inventory and supplier performance", kpis: ["Shipments", "Delivery Time", "Inventory", "On-Time Rate"] },
    "Manufacturing & Operations": { label: "Operations Analytics", objective: "Production, quality, throughput and operational efficiency", kpis: ["Output", "Defect Rate", "Downtime", "Efficiency"] },
    "IoT & Sensors": { label: "IoT & Sensor Analytics", objective: "Telemetry, device health, trends and threshold anomalies", kpis: ["Readings", "Average Reading", "Peak", "Anomaly Rate"] },
    "Media & Entertainment": { label: "Media Analytics", objective: "Audience engagement, content performance and consumption", kpis: ["Views", "Watch Time", "Rating", "Subscribers"] },
    "Real Estate": { label: "Real Estate Analytics", objective: "Property inventory, pricing, demand and location performance", kpis: ["Listings", "Average Price", "Price per Area", "Demand"] },
    "General Analytics": { label: "General Analytics", objective: "Data quality, distributions, relationships and measurable patterns", kpis: ["Records", "Numeric Metrics", "Coverage", "Variability"] }
  };
  return copy[domain];
}
