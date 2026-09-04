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

const DOMAIN_RULES: Record<IndustryDomain, string[]> = {
  "Sales & Retail": ["sales", "revenue", "order", "product", "sku", "quantity", "qty", "cart", "customer", "discount", "unit_price", "selling_price"],
  "Finance & Banking": ["account", "balance", "transaction", "debit", "credit", "loan", "interest", "payment", "portfolio", "investment", "profit", "expense", "income"],
  Healthcare: ["patient", "diagnosis", "symptom", "disease", "treatment", "doctor", "physician", "hospital", "clinic", "medication", "admission", "discharge", "blood", "heart_rate"],
  Education: ["student", "grade", "marks", "score", "gpa", "course", "subject", "teacher", "attendance", "exam", "semester", "school", "college", "university", "enrollment"],
  "Human Resources": ["employee", "salary", "department", "designation", "job_title", "hire_date", "termination", "attrition", "performance", "manager", "tenure", "leave"],
  "Marketing & Customer": ["campaign", "lead", "conversion", "click", "impression", "ctr", "engagement", "channel", "customer", "segment", "churn", "retention"],
  "Logistics & Supply Chain": ["shipment", "tracking", "delivery", "carrier", "warehouse", "supplier", "freight", "route", "origin", "destination", "dispatch", "inventory", "stock"],
  "Manufacturing & Operations": ["machine", "production", "defect", "downtime", "quality", "factory", "batch", "cycle", "output", "maintenance", "work_order"],
  "IoT & Sensors": ["sensor", "device", "temperature", "humidity", "pressure", "voltage", "reading", "telemetry", "accelerometer", "battery"],
  "Media & Entertainment": ["movie", "film", "show", "episode", "stream", "watch", "view", "rating", "genre", "duration", "subscriber"],
  "Real Estate": ["property", "listing", "bedroom", "bathroom", "rent", "mortgage", "square_feet", "area", "agent", "listing_price"],
  "General Analytics": []
};

const GENERIC_STOP_WORDS = new Set([
  "id", "date", "time", "timestamp", "name", "description", "status", "type", "code", "number", "value"
]);

function normalize(value: string) {
  return value.toLowerCase().trim().replace(/[\s-]+/g, "_");
}

function tokenScore(column: string, keywords: string[]) {
  const c = normalize(column);
  return keywords.reduce((score, keyword) => {
    const k = normalize(keyword);
    if (c === k) return score + 4;
    if (c.includes(k)) return score + 2;
    return score;
  }, 0);
}

export function detectIndustryDomain(columns: string[], sampleRows: Record<string, unknown>[] = []) {
  const scores = Object.entries(DOMAIN_RULES).map(([domain, keywords]) => {
    let score = columns.reduce((sum, column) => sum + tokenScore(column, keywords), 0);

    // A small amount of value-level evidence helps distinguish ambiguous schemas.
    for (const row of sampleRows.slice(0, 30)) {
      for (const [column, value] of Object.entries(row)) {
        if (value === null || value === undefined) continue;
        const text = String(value).toLowerCase();
        const columnScore = tokenScore(column, keywords);
        if (columnScore === 0) continue;
        if (keywords.some((k) => text.includes(k.replace(/_/g, " ")))) score += 0.5;
      }
    }

    return { domain: domain as IndustryDomain, score };
  }).sort((a, b) => b.score - a.score);

  const winner = scores[0];
  const second = scores[1];
  const totalEvidence = columns.filter((c) => !GENERIC_STOP_WORDS.has(normalize(c))).length;
  const confidence = winner.score <= 0
    ? 0.25
    : Math.min(0.99, 0.45 + Math.min(0.45, winner.score / Math.max(8, totalEvidence * 3)) + (winner.score - (second?.score || 0) > 4 ? 0.08 : 0));

  return {
    domain: winner?.domain || "General Analytics",
    confidence: Number(confidence.toFixed(2)),
    ranked: scores.slice(0, 5)
  };
}

export function getDomainLanguage(domain: IndustryDomain) {
  const copy: Record<IndustryDomain, { label: string; objective: string; kpis: string[] }> = {
    "Sales & Retail": { label: "Sales & Retail Analytics", objective: "Revenue, demand, product and customer performance", kpis: ["Revenue", "Orders", "Units", "Average Order Value"] },
    "Finance & Banking": { label: "Financial Analytics", objective: "Financial performance, exposure and transaction behavior", kpis: ["Transaction Value", "Average Value", "Balance", "Profit"] },
    Healthcare: { label: "Healthcare Analytics", objective: "Patient, clinical, operational and outcome patterns", kpis: ["Patients", "Clinical Volume", "Average Value", "Outcome Rate"] },
    Education: { label: "Education Analytics", objective: "Student performance, attendance and academic outcomes", kpis: ["Students", "Average Score", "Attendance", "Pass Rate"] },
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
