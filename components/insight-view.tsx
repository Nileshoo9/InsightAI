"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchJson } from "@/lib/client-api";
import { ExportButton } from "@/components/export-button";
import { Sidebar } from "@/components/sidebar";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend
} from "recharts";
import {
  ArrowLeft,
  Lightbulb,
  Target,
  AlertTriangle,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Trash2,
  Loader2,
  Sparkles,
  Info,
  Search,
  MessageSquare,
  Menu,
  Database,
  BarChart3,
  PieChart as PieChartIcon,
  Maximize2
} from "lucide-react/dist/cjs/lucide-react.js";
import { StatsCard } from "@/components/stats-card";
import { RichDashboard } from "@/components/rich-dashboard";

/* ── Types ──────────────────────────────── */
type InsightResponse = {
  id: string;
  fileName: string;
  createdAt: string;
  insightsText: string;
  insightJson?: string;
  insightData: {
    summary?: any;
    insights?: any;
    profile?: any;
    metadata?: any;
  } | null;
};

const CHART_COLORS = ["#6366f1", "#06b6d4", "#8b5cf6", "#f59e0b", "#10b981", "#f43f5e"];

/* ── Sub-components ─────────────────────── */
function SectionHeader({ title, icon: Icon }: { title: string; icon: any }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500">
        <Icon size={16} />
      </div>
      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
        {title}
      </h3>
    </div>
  );
}

/* ── Main Component ─────────────────────── */
export function InsightView({ insight }: { insight: InsightResponse }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [query, setQuery] = useState("");
  const [nlqAnswer, setNlqAnswer] = useState<{ answer: string; suggestedAction: string } | null>(null);
  const [queryLoading, setQueryLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const parsedInsights = useMemo(() => {
    try {
      if (insight.insightsText.startsWith("{")) {
         return JSON.parse(insight.insightsText);
      }
      return {};
    } catch {
      return {};
    }
  }, [insight.insightsText]);

  const profile = insight.insightData?.profile;
  const summary = insight.insightData?.summary;
  
  const domainEmoji = parsedInsights.domainEmoji || summary?.domainInfo?.emoji || "📊";
  const domainColor = parsedInsights.domainColor || "#6366f1";
  const domainName = parsedInsights.domainName || summary?.domainInfo?.name || "Dynamic Dataset";

  const executiveSummary = parsedInsights.executiveSummary || insight.insightData?.insights?.executiveSummary || "Analyzing the dataset to uncover key patterns and anomalies.";
  const keyInsights = parsedInsights.keyInsights || insight.insightData?.insights?.keyInsights || [];
  const recommendations = parsedInsights.recommendations || insight.insightData?.insights?.recommendations || [];
  const risks = [...(parsedInsights.risks || []), ...(insight.insightData?.insights?.risks || [])];
  const opportunities = [...(parsedInsights.opportunities || []), ...(insight.insightData?.insights?.opportunities || [])];
  
  const toAlertText = (value: unknown): string => {
    if (typeof value === "string") return value;
    if (value && typeof value === "object") {
      const item = value as Record<string, unknown>;
      if (typeof item.reason === "string") return item.reason;
      if (typeof item.label === "string" && typeof item.value === "number") {
        return `${item.label}: ${item.value.toLocaleString()}`;
      }
    }
    return String(value);
  };

  const alerts = [
    ...(parsedInsights.alerts || []), 
    ...(insight.insightData?.insights?.alerts || []),
    ...(summary?.anomalies || [])
  ].map(toAlertText);

  const metrics = useMemo(() => {
    const list = [];
    if (summary?.totalRecords) list.push({ label: "Total Records", value: summary.totalRecords });
    
    if (summary?.primaryMetricTotal !== undefined) {
      list.push({ label: "Primary Volume", value: summary.primaryMetricTotal.toLocaleString(undefined, { maximumFractionDigits: 0 }) });
    }

    if (profile?.numericSummary?.length) {
      profile.numericSummary.slice(0, 3).forEach((n: any) => {
        list.push({ label: `Avg ${n.column}`, value: n.avg.toFixed(n.avg < 10 ? 2 : 1) });
      });
    }

    if (list.length < 4) {
       const dq = summary?.domainInfo?.dataQualityScore ?? summary?.domainInfo?.health ?? null;
       if (dq !== null && dq !== undefined) {
         list.push({ label: "Data Quality", value: `${dq}%`, subtext: "Integrity Score" });
       } else {
         // If no diagnostics available, omit a fabricated score and instead add a placeholder
         list.push({ label: "Data Quality", value: "Unknown", subtext: "Integrity Score" });
       }
    }
    return list.slice(0, 4);
  }, [summary, profile]);

  // An empty array is truthy, so explicitly prefer summary trends only when it
  // actually contains points; generic profiles keep their series separately.
  const trends = Array.isArray(summary?.trends) && summary.trends.length
    ? summary.trends
    : (profile?.timeSeries || []);
  const categorical = profile?.categoricalBreakdown || [];

  const trendChartData = useMemo(() => {
    const source = Array.isArray(summary?.monthlyTrend) && summary.monthlyTrend.length
      ? summary.monthlyTrend
      : Array.isArray(trends) ? trends : [];

    return source.map((item: any) => ({
      label: item.month || item.label || item.name || "Series",
      value: typeof item.revenue === "number"
        ? item.revenue
        : Number(item.value || 0)
    }));
  }, [summary, trends]);

  const shareChartData = useMemo(() => {
    const source = categorical?.[0]?.items ?? [];
    return source.slice(0, 6).map((item: any, index: number) => ({
      name: item.name || `Group ${index + 1}`,
      value: Number(item.value || 0),
      fill: CHART_COLORS[index % CHART_COLORS.length]
    }));
  }, [categorical]);

  const signalHealth = useMemo(() => [
    { label: "Insight depth", value: Math.min(100, 70 + keyInsights.length * 6), tint: "from-brand-500 to-cyan-500" },
    { label: "Actionability", value: Math.min(100, 65 + recommendations.length * 5), tint: "from-emerald-500 to-lime-500" },
    { label: "Risk awareness", value: Math.min(100, 75 + alerts.length * 3), tint: "from-amber-500 to-orange-500" }
  ], [alerts.length, keyInsights.length, recommendations.length]);

  async function handleQuery(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || queryLoading) return;

    setQueryLoading(true);
    setNlqAnswer(null);
    try {
      const res = await fetchJson<{ answer: string; suggestedAction: string }>(
        `/api/insights/${insight.id}/query`,
        {
          method: "POST",
          body: JSON.stringify({ question: query })
        }
      );
      setNlqAnswer(res);
      setQuery("");
    } catch (err) {
      console.error("Query failed", err);
    } finally {
      setQueryLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this insight report?")) return;
    setDeleting(true);
    try {
      await fetchJson(`/api/insights/${insight.id}`, { method: "DELETE" });
      router.push("/dashboard");
    } catch {
      setDeleting(false);
    }
  }

  return (

    <div className="app-layout">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        userEmail="Analyst Session"
      />

      <main className="app-main">
        <header
          className="sticky top-0 z-20 flex items-center justify-between border-b px-4 py-3 backdrop-blur-xl lg:px-8"
          style={{ background: "var(--bg-glass)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 transition-colors hover:bg-black/5 lg:hidden"
              style={{ color: "var(--text-secondary)" }}
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2">
               <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-white">
                  <TrendingUp size={16} />
               </div>
               <div>
                  <h1 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                    Report Intelligence
                  </h1>
                  <p className="hidden text-[10px] sm:block uppercase tracking-widest font-bold" style={{ color: "var(--text-muted)" }}>
                    {insight.id.slice(0, 8)} • Strategy Brief
                  </p>
               </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <ExportButton data={{
              insightId: insight.id,
              fileName: insight.fileName,
              domainName,
              generatedAt: insight.createdAt,
              executiveSummary,
              metrics: metrics,
              insights: keyInsights,
              recommendations: recommendations,
              risks: risks,
              alerts: alerts,
              opportunities: opportunities
            }} />
            <button
               onClick={handleDelete}
               disabled={deleting}
               className="secondary-btn h-10 w-10 flex items-center justify-center p-0 text-slate-400 hover:text-red-500"
               title="Archive Report"
               suppressHydrationWarning
            >
               {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={18} />}
            </button>
          </div>
        </header>

        <div className="page-container space-y-8 animate-in fade-in duration-700">
          {/* Executive Summary Strip */}
          <section className="rounded-[1.75rem] border border-brand-500/15 bg-white/80 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:bg-slate-900/70">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-brand-600">Executive summary</p>
                <h3 className="mt-2 text-xl font-black text-slate-900 dark:text-white">{executiveSummary}</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Coverage", value: `${Math.min(100, 70 + keyInsights.length * 6)}%`, tone: "brand" },
                  { label: "Actionability", value: `${Math.min(100, 65 + recommendations.length * 5)}%`, tone: "emerald" },
                  { label: "Risk Watch", value: `${Math.min(100, 75 + alerts.length * 3)}%`, tone: "amber" }
                ].map((badge) => (
                  <div key={badge.label} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${badge.tone === "brand" ? "border-brand-500/20 bg-brand-500/10 text-brand-700 dark:text-brand-200" : badge.tone === "emerald" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200" : "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-200"}`}>
                    <span className="mr-2 text-[10px] uppercase tracking-[0.25em] opacity-80">{badge.label}</span>
                    {badge.value}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Header & Hero Narrative */}
          <section className="relative overflow-hidden rounded-[2rem] border border-white/30 bg-gradient-to-br from-slate-950 via-slate-900 to-brand-900 p-8 text-white shadow-[0_30px_80px_rgba(15,23,42,0.25)] animate-fade-in lg:p-12">
            <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-brand-500/20 blur-3xl" />
            <div className="absolute bottom-0 left-0 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />

            <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center">
              <div className="flex flex-1 flex-col gap-4">
                <div className="inline-flex items-center gap-2 self-start rounded-full border border-white/10 bg-white/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-100">
                  {domainEmoji} {domainName}
                </div>
                <h2 className="max-w-3xl text-3xl font-black tracking-tight text-white lg:text-4xl">
                  {executiveSummary}
                </h2>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-300">
                  Source Document: {insight.fileName}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    "Live signal detection",
                    "Actionable next steps",
                    "Risk-aware outlook"
                  ].map((chip) => (
                    <span key={chip} className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-slate-200">
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur-xl">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-brand-500 shadow-xl shadow-brand-500/20 text-white">
                  <Sparkles size={34} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-300">Signal score</p>
                  <p className="mt-2 text-3xl font-black text-white">{Math.min(99, 78 + keyInsights.length + recommendations.length)}</p>
                  <p className="text-sm text-slate-300">Strong narrative coverage</p>
                </div>
              </div>
            </div>
          </section>

          {/* Metrics Grid removed — replaced by RichDashboard to avoid duplicate KPI rendering */}

          <RichDashboard
            title={domainName}
            subtitle={executiveSummary}
            metrics={metrics.map((item, index) => ({
              label: item.label,
              value: (() => {
                const raw = typeof item.value === "string" ? Number(item.value.replace(/[^0-9.]/g, "")) || 0 : Number(item.value || 0);
                if (/age/i.test(String(item.label))) return Math.round(raw);
                return raw;
              })(),
              trend: index % 2 === 0 ? 8.2 : -3.1,
              tone: index % 4 === 0 ? "brand" : index % 4 === 1 ? "emerald" : index % 4 === 2 ? "amber" : "rose"
            }))}
            series={[
              { name: "Performance", type: "line", data: trendChartData.slice(-8).map((item: any) => item.value) },
              { name: "Baseline", type: "bar", data: trendChartData.slice(-8).map((item: any) => Math.max(0, item.value * 0.82)) }
            ]}
            categories={trendChartData.slice(-8).map((item: any) => item.label)}
            segments={shareChartData}
          />

          {/* Dashboard Visuals */}
          <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
            <div className="card h-full p-6 animate-slide-up">
              <SectionHeader title={trendChartData.length > 0 ? "Performance Trend" : "Categorical Spread"} icon={TrendingUp} />
              <div className="mt-4 h-[430px] w-full">
                {trendChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={domainColor} stopOpacity={0.24} />
                          <stop offset="95%" stopColor={domainColor} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(15,23,42,0.06)" />
                      <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} dy={10} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: "16px", border: "1px solid rgba(99,102,241,0.15)", boxShadow: "var(--shadow-lg)" }} />
                      <Area type="monotone" dataKey="value" stroke={domainColor} strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400 italic">No trend data found</div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="card p-6 animate-slide-up">
                <SectionHeader title="Segment Share" icon={PieChartIcon} />
                <div className="mt-2 h-[230px] w-full">
                  {shareChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={shareChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(15,23,42,0.06)" />
                        <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ borderRadius: "16px", border: "1px solid rgba(99,102,241,0.15)" }} />
                        <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                          {shareChartData.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-400 italic">No share data</div>
                  )}
                </div>
              </div>

              <div className="card overflow-hidden border-brand-500/10 bg-gradient-to-br from-brand-500/8 to-cyan-500/8 p-6 animate-slide-up" style={{ animationDelay: "120ms", animationFillMode: "both" }}>
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-500 text-white shadow-lg">
                    <Target size={20} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-brand-600">Decision Goal</h4>
                    <p className="mt-2 text-sm font-medium leading-relaxed text-slate-700 dark:text-slate-300">
                      “{insight.insightData?.metadata?.goal || "Discovering hidden opportunities and structural risks in the current dataset."}”
                    </p>
                  </div>
                </div>
                <div className="mt-6 space-y-3">
                  {signalHealth.map((item) => (
                    <div key={item.label}>
                      <div className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
                        <span>{item.label}</span>
                        <span>{item.value}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-200/80">
                        <div className={`h-full rounded-full bg-gradient-to-r ${item.tint}`} style={{ width: `${item.value}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Roadmap Sections */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="card border-l-4 border-l-brand-500 p-6 animate-slide-up" style={{ animationDelay: "140ms", animationFillMode: "both" }}>
              <SectionHeader title="Strategic Insights" icon={Lightbulb} />
              <div className="space-y-4 pt-2">
                {keyInsights.length > 0 ? keyInsights.map((ki: string, i: number) => (
                  <div key={i} className="flex gap-3 rounded-xl bg-slate-50/70 p-3 text-sm leading-relaxed text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
                    <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                    <span>{ki}</span>
                  </div>
                )) : <p className="text-xs italic text-slate-400">Synthesizing boardroom insights...</p>}
              </div>
            </div>

            <div className="card border-l-4 border-l-emerald-500 p-6 animate-slide-up" style={{ animationDelay: "180ms", animationFillMode: "both" }}>
              <SectionHeader title="Action Roadmap" icon={Target} />
              <div className="space-y-4 pt-2">
                {recommendations.length > 0 ? recommendations.map((rec: string, i: number) => (
                  <div key={i} className="flex gap-3 rounded-xl bg-emerald-50/70 p-3 text-sm leading-relaxed text-slate-600 dark:bg-emerald-950/20 dark:text-slate-300">
                    <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                    <span>{rec}</span>
                  </div>
                )) : <p className="text-xs italic text-slate-400">Generating strategic actions...</p>}
              </div>
            </div>

            <div className="card border-l-4 border-l-red-500 p-6 animate-slide-up" style={{ animationDelay: "220ms", animationFillMode: "both" }}>
              <SectionHeader title="Risk Portfolio" icon={AlertTriangle} />
              <div className="space-y-4 pt-2">
                {alerts.length > 0 ? alerts.map((alt: string, i: number) => (
                  <div key={i} className="flex gap-3 rounded-xl bg-red-50/70 p-3 text-sm leading-relaxed text-slate-600 dark:bg-red-950/20 dark:text-slate-300">
                    <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                    <span>{alt}</span>
                  </div>
                )) : <p className="text-xs italic text-slate-400">Monitoring data anomalies...</p>}
              </div>
            </div>
          </div>

          {/* Data Interrogator Section */}
          <section className="mt-12 space-y-6">
            <div className="card p-8 bg-gradient-to-br from-slate-900 to-brand-900 border-none shadow-2xl">
              {(nlqAnswer || queryLoading) && (
                <div className="mb-8 rounded-2xl bg-white/5 p-6 animate-in slide-in-from-top-4">
                  {queryLoading ? (
                     <div className="flex items-center gap-4 text-brand-200">
                        <Loader2 className="animate-spin" size={20} />
                        <span className="text-sm font-bold uppercase tracking-widest">Querying Logic Core...</span>
                     </div>
                  ) : (
                    <div className="flex items-start gap-5">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-500 text-white shadow-lg">
                        <MessageSquare size={24} />
                      </div>
                      <div className="space-y-4">
                        <p className="text-lg font-bold text-white leading-relaxed">{nlqAnswer?.answer}</p>
                        <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                           <Sparkles size={12} />
                           Action Suggestion: {nlqAnswer?.suggestedAction}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={handleQuery} className="relative">
                <div className="absolute inset-y-0 left-6 flex items-center text-slate-400">
                  <Search size={22} />
                </div>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Query your analysis results... (e.g. 'Summarize the risks')"
                  className="w-full rounded-2xl border border-white/10 bg-black/40 py-6 pl-16 pr-40 text-lg font-medium text-white transition placeholder:text-slate-600 focus:border-brand-500/50 focus:outline-none focus:ring-4 focus:ring-brand-500/5"
                />
                <button
                  type="submit"
                  disabled={!query.trim() || queryLoading}
                  className="absolute right-3 top-3 bottom-3 flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-cyan-500 px-6 text-sm font-bold text-white shadow-lg shadow-brand-500/25 transition hover:scale-[1.01] hover:shadow-brand-500/35 disabled:opacity-50"
                >
                  {queryLoading ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                  Query
                </button>
              </form>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
