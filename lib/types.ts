export type ParsedRecord = Record<string, any> & {
  date?: Date;
  primaryMetric?: number;
};

export type AggregatedSummary = {
  totalRecords: number;
  primaryMetricTotal?: number;
  secondaryMetricTotal?: number;
  uniqueValues: Record<string, number>;
  topEntries: { column: string; items: { name: string; value: number }[] }[];
  trends: { label: string; value: number; metric: string }[];
  anomalies: { label: string; value: number; reason: string }[];
  domainInfo: {
    name: string;
    description: string;
    suggestedKPIs: string[];
  };
};

export type InsightPayload = {
  executiveSummary: string;
  keyInsights: string[];
  recommendations: string[];
  risks: string[];
  opportunities: string[];
  alerts: string[];
  trends: string[];
};

export type GenericProfile = {
  rowCount: number;
  columnCount: number;
  columns: string[];
  categoricalBreakdown: {
    column: string;
    items: { name: string; value: number }[];
  }[];
  numericSummary: {
    column: string;
    avg: number;
    min: number;
    max: number;
    count: number;
  }[];
  timeSeries: {
    label: string;
    value: number;
    metric: string;
    dateColumn: string;
  }[];
};
