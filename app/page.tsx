import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import Link from "next/link";
import {
  Upload,
  Sparkles,
  BarChart3,
  ArrowRight,
  Shield,
  Zap,
  Globe,
  TrendingUp,
  FileSpreadsheet,
  Brain
} from "lucide-react";

export default async function HomePage() {
  const session = await getSessionFromCookies();
  if (session) redirect("/dashboard");

  return (
    <div className="min-h-screen">
      {/* ── Navbar ──────────────────────── */}
      <nav className="fixed top-0 z-30 w-full border-b backdrop-blur-xl" style={{ background: "var(--bg-glass)", borderColor: "var(--border)" }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="text-base font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
              AI Analyst
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="secondary-btn px-4 py-2 text-sm">
              Sign In
            </Link>
            <Link href="/signup" className="primary-btn px-4 py-2 text-sm">
              Get Started <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────── */}
      <section className="relative overflow-hidden pt-28 pb-20 sm:pt-36 sm:pb-28">
        {/* Background elements */}
        <div className="absolute left-1/4 top-20 h-72 w-72 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="absolute right-1/4 bottom-10 h-60 w-60 rounded-full bg-purple-500/10 blur-3xl" />
        <div className="absolute inset-0 dot-pattern opacity-30" />

        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold" style={{ background: "rgba(99,102,241,0.08)", color: "var(--brand-start)" }}>
            <Sparkles size={14} /> AI-Powered Data Intelligence
          </div>

          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl md:text-6xl" style={{ color: "var(--text-primary)" }}>
            Turn any dataset into{" "}
            <span className="gradient-text">
              instant insights
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed sm:text-lg" style={{ color: "var(--text-secondary)" }}>
            Upload CSV or Excel files and get AI-generated business insights, trend analysis, risk alerts, and actionable recommendations — all in seconds.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/signup" className="primary-btn px-8 py-3.5 text-base">
              Start Analyzing Free <ArrowRight size={18} />
            </Link>
            <Link href="/login" className="secondary-btn px-6 py-3.5 text-base">
              Sign In
            </Link>
          </div>

          <p className="mt-4 text-xs" style={{ color: "var(--text-muted)" }}>
            No credit card required • Supports CSV, XLS, XLSX
          </p>
        </div>
      </section>

      {/* ── How It Works ───────────────── */}
      <section className="py-20" style={{ background: "var(--bg-glass)" }}>
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-extrabold sm:text-4xl" style={{ color: "var(--text-primary)" }}>
              How it works
            </h2>
            <p className="mt-3 text-base" style={{ color: "var(--text-secondary)" }}>
              Three simple steps to unlock your data&apos;s potential
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                step: "01",
                icon: Upload,
                title: "Upload Your Data",
                desc: "Drag and drop any CSV or Excel file. We support all common formats and automatically detect column types."
              },
              {
                step: "02",
                icon: Brain,
                title: "AI Analyzes",
                desc: "Our AI engine processes your data — computing summaries, detecting trends, identifying anomalies, and generating insights."
              },
              {
                step: "03",
                icon: BarChart3,
                title: "Get Insights",
                desc: "View interactive charts, key recommendations, risk alerts, and export reports as CSV or PDF for your team."
              }
            ].map(({ step, icon: Icon, title, desc }, idx) => (
              <div key={step} className="glass-card p-6 text-center animate-slide-up" style={{ animationDelay: `${idx * 150}ms`, animationFillMode: "both" }}>
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "rgba(99,102,241,0.08)" }}>
                  <Icon size={24} style={{ color: "var(--brand-start)" }} />
                </div>
                <div className="mb-2 text-xs font-bold" style={{ color: "var(--brand-start)" }}>
                  STEP {step}
                </div>
                <h3 className="mb-2 text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                  {title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────── */}
      <section className="py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-extrabold sm:text-4xl" style={{ color: "var(--text-primary)" }}>
              Everything you need
            </h2>
            <p className="mt-3 text-base" style={{ color: "var(--text-secondary)" }}>
              Powerful features for data-driven decisions
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: FileSpreadsheet, title: "Multi-Format Upload", desc: "CSV, XLS, XLSX — automatic column detection and normalization" },
              { icon: Sparkles, title: "AI Insights", desc: "GPT-powered analysis with key findings, recommendations, and risk alerts" },
              { icon: TrendingUp, title: "Trend Detection", desc: "Automatic time-series analysis with anomaly detection and growth metrics" },
              { icon: BarChart3, title: "Interactive Charts", desc: "Area charts, bar charts, and pie charts with responsive layouts" },
              { icon: Shield, title: "Secure & Private", desc: "JWT authentication, encrypted cookies, and per-user data isolation" },
              { icon: Globe, title: "Export Anywhere", desc: "Download reports as CSV, print to PDF, and copy key metrics to clipboard" }
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="card card-hover p-5">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "rgba(99,102,241,0.08)" }}>
                  <Icon size={20} style={{ color: "var(--brand-start)" }} />
                </div>
                <h3 className="mb-1 text-base font-bold" style={{ color: "var(--text-primary)" }}>
                  {title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────── */}
      <section className="py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="glass-card-static overflow-hidden p-8 text-center sm:p-12" style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.06), rgba(139,92,246,0.06))" }}>
            <h2 className="text-2xl font-extrabold sm:text-3xl" style={{ color: "var(--text-primary)" }}>
              Ready to analyze your data?
            </h2>
            <p className="mt-3 text-base" style={{ color: "var(--text-secondary)" }}>
              Create a free account and start getting AI-powered insights in seconds.
            </p>
            <div className="mt-8">
              <Link href="/signup" className="primary-btn px-8 py-3.5 text-base">
                Get Started Free <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────── */}
      <footer className="border-t py-8" style={{ borderColor: "var(--border)" }}>
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                AI Analyst
              </span>
            </div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              © {new Date().getFullYear()} AI Data Analyst. Built with Next.js & OpenAI.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
