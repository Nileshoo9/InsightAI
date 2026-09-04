"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/client-api";
import { ExportButton } from "@/components/export-button";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Database,
  Download,
  Gauge,
  Lightbulb,
  Menu,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
  Trash2
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

const chartPalette = ["#2563eb", "#06b6d4", "#7c3aed", "#16a34a", "#f59e0b", "#e11d48", "#475569", "#0f766e"];

type Report = {
  version: number;
  domain: { name: string; confidence: number; objective: string };
  executive: { headline: string; summary: string };
  kpis: Array<{ label: string; value: number; unit?: string; context?: string }>;
  charts: Array<{
    id: string;
    type: "line" | "bar" | "donut" | "histogram" | "scatter";
    title: string;
    description: string;
    xColumn?: string;
    yColumn?: string;
    data: Array<Record<string, unknown>>;
  }>;
  findings: string[];
  risks: string[];
  opportunities: string[];
  recommendations: string[];
  dataQuality: { score: number; missingPct: number; duplicatePct: number; warnings: string[] };
  methodology: { rows: number; columns: number; numericMetrics: string[]; dimensions: string[]; dateColumn?: string };
};

type Props = {
  insight: {
    id: string;
    fileId: string;
    fileName: string;
    createdAt: string;
    insightsText: string;
    insightData: any;
  };
  report: Report;
};

function number(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatValue(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400"><Icon size={17} /></div>
        <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-800 dark:text-slate-100">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function IndustryReport({ insight, report }: Props) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const exportData = useMemo(() => ({
    insightId: insight.id,
    fileName: insight.fileName,
    domainName: report.domain.name,
    generatedAt: insight.createdAt,
    executiveSummary: `${report.executive.headline} ${report.executive.summary}`,
    metrics: report.kpis.map((k) => ({ label: k.label, value: k.value })),
    insights: report.findings,
    recommendations: report.recommendations,
    risks: report.risks,
    opportunities: report.opportunities,
    alerts: report.dataQuality.warnings
  }), [insight, report]);

  async function deleteReport() {
    if (!confirm("Delete this report?")) return;
    setDeleting(true);
    try {
      await fetchJson(`/api/insights/${insight.id}`, { method: "DELETE" });
      router.push("/dashboard");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90 lg:px-8">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button className="rounded-xl p-2 lg:hidden" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
            <button className="hidden items-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 lg:flex dark:hover:bg-slate-900" onClick={() => router.push("/dashboard")}>
              <ArrowLeft size={16} /> Dashboard
            </button>
            <div className="hidden h-7 w-px bg-slate-200 lg:block dark:bg-slate-800" />
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-600">InsightAI • Executive Intelligence</p>
              <h1 className="truncate text-sm font-bold text-slate-900 dark:text-white">{insight.fileName}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ExportButton data={exportData} />
            <button onClick={deleteReport} disabled={deleting} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:border-red-200 hover:text-red-500 dark:border-slate-800 dark:bg-slate-900">
              <Trash2 size={17} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] space-y-6 px-4 py-6 lg:px-8 lg:py-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-blue-200/60 bg-gradient-to-br from-blue-700 via-indigo-700 to-slate-900 p-7 text-white shadow-xl lg:p-10">
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/15 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em]">{report.domain.name}</span>
                <span className="rounded-full bg-emerald-400/15 px-3 py-1.5 text-[10px] font-bold text-emerald-200">{Math.round(report.domain.confidence * 100)}% domain confidence</span>
              </div>
              <h2 className="max-w-4xl text-3xl font-black tracking-tight lg:text-5xl">{report.executive.headline}</h2>
              <p className="mt-4 max-w-4xl text-sm leading-7 text-blue-100 lg:text-base">{report.executive.summary}</p>
              <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-blue-200">Reporting objective • {report.domain.objective}</p>
            </div>
            <div className="hidden h-24 w-24 items-center justify-center rounded-3xl border border-white/15 bg-white/10 lg:flex"><Sparkles size={40} /></div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {report.kpis.map((kpi, index) => (
            <div key={`${kpi.label}-${index}`} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{kpi.label}</p>
                <div className="rounded-xl bg-blue-500/10 p-2 text-blue-600"><Gauge size={16} /></div>
              </div>
              <p className="mt-4 text-3xl font-black tracking-tight text-slate-950 dark:text-white">{formatValue(kpi.value)}{kpi.unit || ""}</p>
              <p className="mt-2 text-xs text-slate-500">{kpi.context || "Calculated from the source dataset"}</p>
            </div>
          ))}
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
          {report.charts.filter((c) => c.type === "line").slice(0, 1).map((chart) => (
            <Section key={chart.id} icon={TrendingUp} title="Performance Trend">
              <p className="mb-4 text-xs text-slate-500">{chart.description}</p>
              <div className="h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chart.data} margin={{ left: 0, right: 12, top: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,.22)" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Section>
          ))}
          {report.charts.find((c) => c.type === "line") === undefined && (
            <Section icon={TrendingUp} title="Performance Trend"><div className="flex h-[360px] items-center justify-center text-sm text-slate-400">No reliable time dimension was detected.</div></Section>
          )}

          {report.charts.filter((c) => c.type === "bar").slice(0, 1).map((chart) => (
            <Section key={chart.id} icon={BarChart3} title={chart.title}>
              <p className="mb-4 text-xs text-slate-500">{chart.description}</p>
              <div className="h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart.data} margin={{ left: 0, right: 12, top: 8, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,.22)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} angle={-20} textAnchor="end" />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[7, 7, 0, 0]}>{chart.data.map((_, i) => <Cell key={i} fill={chartPalette[i % chartPalette.length]} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Section>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {report.charts.filter((c) => c.type === "bar").slice(1, 2).map((chart) => (
            <Section key={chart.id} icon={BarChart3} title={chart.title}>
              <p className="mb-4 text-xs text-slate-500">{chart.description}</p>
              <div className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={chart.data}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,.22)" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="value" radius={[7,7,0,0]} /></BarChart></ResponsiveContainer></div>
            </Section>
          ))}
          {report.charts.filter((c) => c.type === "donut").slice(0, 1).map((chart) => (
            <Section key={chart.id} icon={Target} title={chart.title}>
              <div className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chart.data} dataKey="value" nameKey="name" innerRadius={70} outerRadius={105} paddingAngle={3}>{chart.data.map((_, i) => <Cell key={i} fill={chartPalette[i % chartPalette.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
            </Section>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Section icon={Lightbulb} title="Key Findings"><div className="space-y-4">{report.findings.map((item, i) => <div key={i} className="flex gap-3"><span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-black text-blue-600 dark:bg-blue-500/10">{i + 1}</span><p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{item}</p></div>)}</div></Section>
          <Section icon={ShieldAlert} title="Risk & Control"><div className="space-y-3">{report.risks.map((item, i) => <div key={i} className="rounded-2xl border border-amber-200/70 bg-amber-50/60 p-4 text-sm leading-6 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100"><AlertTriangle size={15} className="mb-2" />{item}</div>)}</div></Section>
          <Section icon={TrendingUp} title="Opportunities"><div className="space-y-3">{report.opportunities.map((item, i) => <div key={i} className="rounded-2xl border border-emerald-200/70 bg-emerald-50/60 p-4 text-sm leading-6 text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-100"><CheckCircle2 size={15} className="mb-2" />{item}</div>)}</div></Section>
        </div>

        <Section icon={Target} title="Recommended Action Plan">
          <div className="grid gap-3 md:grid-cols-3">{report.recommendations.map((item, i) => <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">Priority {i + 1}</p><p className="mt-2 text-sm font-semibold leading-6 text-slate-700 dark:text-slate-200">{item}</p></div>)}</div>
        </Section>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <Section icon={Database} title="Data Quality">
            <div className="flex items-end gap-4"><div><p className="text-5xl font-black text-slate-950 dark:text-white">{report.dataQuality.score}</p><p className="text-xs font-bold uppercase tracking-widest text-slate-500">Quality score / 100</p></div><div className="flex-1"><div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-blue-600" style={{ width: `${report.dataQuality.score}%` }} /></div><p className="mt-2 text-xs text-slate-500">Missing: {report.dataQuality.missingPct}% • Duplicate signal: {report.dataQuality.duplicatePct}%</p></div></div>
            <div className="mt-5 space-y-2">{report.dataQuality.warnings.length ? report.dataQuality.warnings.map((w, i) => <p key={i} className="text-xs leading-5 text-slate-600 dark:text-slate-300">• {w}</p>) : <p className="text-sm text-emerald-600">No major data-quality warnings were triggered.</p>}</div>
          </Section>
          <Section icon={Database} title="Analytical Methodology">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div><p className="text-xs text-slate-500">Rows analyzed</p><p className="mt-1 text-lg font-black">{formatValue(report.methodology.rows)}</p></div>
              <div><p className="text-xs text-slate-500">Columns</p><p className="mt-1 text-lg font-black">{formatValue(report.methodology.columns)}</p></div>
              <div><p className="text-xs text-slate-500">Numeric metrics</p><p className="mt-1 text-lg font-black">{report.methodology.numericMetrics.length}</p></div>
              <div><p className="text-xs text-slate-500">Dimensions</p><p className="mt-1 text-lg font-black">{report.methodology.dimensions.length}</p></div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-950"><b>Date field:</b> {report.methodology.dateColumn || "Not detected"}</div><div className="rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-950"><b>Measures:</b> {report.methodology.numericMetrics.slice(0, 4).join(", ") || "None"}</div></div>
          </Section>
        </div>

        <footer className="flex flex-col justify-between gap-2 border-t border-slate-200 py-5 text-xs text-slate-400 sm:flex-row dark:border-slate-800">
          <span>InsightAI Industry Report v{report.version} • Source: {insight.fileName}</span>
          <span>Generated {new Date(insight.createdAt).toLocaleString()}</span>
        </footer>
      </main>
    </div>
  );
}
