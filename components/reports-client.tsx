"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "@/lib/client-api";
import { Sidebar } from "@/components/sidebar";
import {
  Menu,
  BarChart3,
  Search,
  Trash2,
  ArrowRight,
  FileSpreadsheet,
  Loader2,
  Calendar,
  FolderOpen,
  Sparkles
} from "lucide-react";

type InsightItem = {
  id: string;
  fileId: string;
  createdAt: string;
  file: { fileName: string };
};

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function ReportsClient({ userEmail }: { userEmail?: string }) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetchJson<{ insights: InsightItem[] }>("/api/insights");
        setInsights(res.insights);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return insights;
    const q = search.toLowerCase();
    return insights.filter((i) => i.file.fileName.toLowerCase().includes(q));
  }, [insights, search]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this insight report?")) return;
    setDeleting(id);
    try {
      await fetchJson(`/api/insights/${id}`, { method: "DELETE" });
      setInsights((prev) => prev.filter((i) => i.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  const totalReports = insights.length;
  const reportsThisWeek = insights.filter((i) => {
    const diff = Date.now() - new Date(i.createdAt).getTime();
    return diff <= 1000 * 60 * 60 * 24 * 7;
  }).length;

  return (
    <div className="app-layout">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} userEmail={userEmail} />

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
            <div>
              <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                Report Library
              </h1>
              <p className="hidden text-xs sm:block" style={{ color: "var(--text-muted)" }}>
                Browse, review, and manage generated analytics narratives
              </p>
            </div>
          </div>
        </header>

        <div className="page-container space-y-6">
          <section className="relative overflow-hidden rounded-[2rem] border border-violet-300/20 bg-gradient-to-r from-violet-500/10 via-indigo-500/10 to-sky-500/10 p-6">
            <div className="absolute -top-10 right-6 h-28 w-28 rounded-full bg-indigo-400/20 blur-3xl" />
            <div className="relative grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/60 bg-white/70 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-700">Total Reports</p>
                <p className="mt-2 text-2xl font-black text-slate-900">{totalReports}</p>
              </div>
              <div className="rounded-2xl border border-white/60 bg-white/70 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-700">This Week</p>
                <p className="mt-2 text-2xl font-black text-slate-900">{reportsThisWeek}</p>
              </div>
              <div className="rounded-2xl border border-white/60 bg-white/70 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-700">Search Ready</p>
                <p className="mt-2 text-sm font-bold text-slate-900">Find reports by source file instantly</p>
              </div>
            </div>
          </section>

          <div className="relative max-w-lg">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: "var(--text-muted)" }}
            />
            <input
              type="text"
              placeholder="Search reports by file name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-9"
              suppressHydrationWarning
            />
          </div>

          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={28} className="animate-spin" style={{ color: "var(--brand-start)" }} />
            </div>
          )}

          {!loading && insights.length === 0 && (
            <div className="card p-12 text-center">
              <FolderOpen size={40} className="mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
              <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>No reports generated yet</h3>
              <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
                Upload a file and run analysis to populate this report library.
              </p>
              <button
                onClick={() => router.push("/dashboard")}
                className="primary-btn mx-auto mt-5 px-6 py-2.5 text-sm"
              >
                Go to Dashboard <ArrowRight size={14} />
              </button>
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((item, index) => (
                <div
                  key={item.id}
                  className="group card card-hover overflow-hidden animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms`, animationFillMode: "both" }}
                >
                  <button
                    onClick={() => router.push(`/insights/${item.id}`)}
                    className="w-full p-5 text-left"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-sky-500/20 text-violet-600">
                        <FileSpreadsheet size={19} />
                      </div>
                      <div className="rounded-full border border-violet-300/30 bg-violet-50/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.15em] text-violet-700">
                        Report
                      </div>
                    </div>
                    <h3 className="mt-3 truncate text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                      {item.file.fileName}
                    </h3>
                    <div className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                      <Calendar size={12} />
                      {formatDate(item.createdAt)}
                    </div>
                  </button>
                  <div className="border-t px-5 py-3" style={{ borderColor: "var(--border)" }}>
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => router.push(`/insights/${item.id}`)}
                        className="inline-flex items-center gap-1 text-xs font-semibold transition-colors hover:opacity-80"
                        style={{ color: "var(--brand-start)" }}
                      >
                        <Sparkles size={12} />
                        Open report
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={deleting === item.id}
                        className="rounded-lg p-1.5 transition-colors hover:bg-red-50"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {deleting === item.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && search && filtered.length !== insights.length && (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Showing {filtered.length} of {insights.length} reports
            </p>
          )}

          {!loading && !filtered.length && insights.length > 0 && (
            <div className="card p-10 text-center">
              <BarChart3 size={30} className="mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                No reports matched your search query.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
